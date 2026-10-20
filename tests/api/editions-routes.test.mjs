// Edition routes: /api/editions/[id] (+ status, enrollments, reviews) and the
// class ↔ edition link. Authorization, envelope and HTTP status codes.
import { beforeEach, describe, expect, it } from "vitest";
import * as editionRoute from "@/app/api/editions/[id]/route";
import * as statusRoute from "@/app/api/editions/[id]/status/route";
import * as enrollmentsRoute from "@/app/api/editions/[id]/enrollments/route";
import * as enrollmentRoute from "@/app/api/editions/[id]/enrollments/[userId]/route";
import * as reviewsRoute from "@/app/api/editions/[id]/reviews/route";
import * as classEditionRoute from "@/app/api/classes/[id]/edition/route";
import * as classesRoute from "@/app/api/classes/route";
import {
  callRoute,
  createAdmin,
  createClass,
  createCourseDoc,
  createEdition,
  createUser,
  daysFromNow,
  enrollInEditionDoc,
  ObjectId,
  resetDb,
  setSession,
} from "../helpers.mjs";

let db, admin, user, other, course;

beforeEach(async () => {
  db = await resetDb();
  admin = await createAdmin(db);
  user = await createUser(db);
  other = await createUser(db);
  course = await createCourseDoc(db, { title: "Meta Ads", createdBy: admin._id });
  setSession(null);
});

const params = (edition) => ({ id: edition._id.toString() });
const enrollmentParams = (edition, student) => ({ id: edition._id.toString(), userId: student._id.toString() });
const notificationsOf = (u) => db.collection("notifications").find({ userId: u._id }).toArray();

/** Edition with one class `days` from now (negative = already finished). */
async function editionWithClass(overrides = {}, { days = 7, classOverrides = {} } = {}) {
  const edition = await createEdition(db, course, overrides);
  const cls = await createClass(db, {
    editionId: edition._id,
    status: "enrolled",
    start_date: daysFromNow(days),
    duration: 60,
    ...classOverrides,
  });
  return { edition, cls };
}

describe("GET/PATCH/DELETE /api/editions/[id]", () => {
  it("GET: a published edition is public (no paid count); a draft only for admins and enrollees", async () => {
    const { edition } = await editionWithClass();
    await enrollInEditionDoc(db, other, edition, "paid");
    const pub = await callRoute(editionRoute.GET, { params: params(edition) });
    expect(pub.status).toBe(200);
    expect(pub.json.data).toMatchObject({
      label: expect.stringMatching(/^[A-ZÁÉÍÓÚ][a-záéíóú]+ \d{4}$/),
      enrollmentCount: 1,
      course: { title: "Meta Ads" },
    });
    expect(pub.json.data).not.toHaveProperty("paidCount");
    expect(pub.json.data).not.toHaveProperty("number");
    expect(pub.json.data).not.toHaveProperty("adminNumber");

    const draft = await createEdition(db, course, { status: "draft" });
    expect((await callRoute(editionRoute.GET, { params: params(draft) })).status).toBe(404);
    setSession(user);
    expect((await callRoute(editionRoute.GET, { params: params(draft) })).status).toBe(404);
    await enrollInEditionDoc(db, user, draft, "pending");
    expect((await callRoute(editionRoute.GET, { params: params(draft) })).json.data.userPaymentStatus).toBe("pending");
    setSession(admin);
    expect((await callRoute(editionRoute.GET, { params: params(draft) })).json.data).toHaveProperty("paidCount", 0);

    expect((await callRoute(editionRoute.GET, { params: { id: "nope" } })).status).toBe(400);
    expect((await callRoute(editionRoute.GET, { params: { id: new ObjectId().toString() } })).status).toBe(404);
  });

  it("PATCH: user 403; admin edits a draft (capacity 0 = no limit); a published edition → 400", async () => {
    const draft = await createEdition(db, course, { status: "draft", price: 100, max_participants: 5 });
    const patch = (edition, body) => callRoute(editionRoute.PATCH, { method: "PATCH", body, params: params(edition) });
    setSession(user);
    expect((await patch(draft, { price: 1, max_participants: 0 })).status).toBe(403);

    setSession(admin);
    const res = await patch(draft, { price: 3000, max_participants: 0 });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ message: "Edición actualizada con éxito", data: { price: 3000, max_participants: null } });
    expect(await db.collection("courseEditions").findOne({ _id: draft._id })).toMatchObject({
      price: 3000,
      max_participants: null,
    });
    expect((await patch(draft, { price: -5 })).status).toBe(400);

    const { edition: published } = await editionWithClass({ price: 100 });
    expect((await patch(published, { price: 200, max_participants: 0 })).status).toBe(400);
    expect((await db.collection("courseEditions").findOne({ _id: published._id })).price).toBe(100);
  });

  it("DELETE: a published edition → 400; a draft is deleted and its enrollees notified", async () => {
    const { edition: published } = await editionWithClass();
    const remove = (edition) => callRoute(editionRoute.DELETE, { method: "DELETE", params: params(edition) });
    setSession(user);
    expect((await remove(published)).status).toBe(403);
    setSession(admin);
    expect((await remove(published)).status).toBe(400);

    const { edition: draft } = await editionWithClass(
      { status: "draft" },
      { classOverrides: { start_date: new Date("2030-09-10T22:00:00Z") } },
    );
    await enrollInEditionDoc(db, user, draft, "pending");
    const res = await remove(draft);
    expect(res.status).toBe(200);
    expect(res.json.message).toBe("Edición eliminada con éxito");
    expect(await db.collection("courseEditions").countDocuments({ _id: draft._id })).toBe(0);
    expect(await db.collection("classes").countDocuments({ editionId: draft._id })).toBe(0);
    expect(await db.collection("courseEnrollments").countDocuments({ editionId: draft._id })).toBe(0);
    const [notice] = await notificationsOf(user);
    expect(notice).toMatchObject({ type: "course.cancelled", relatedType: "edition" });
    expect(notice.message).toContain("Meta Ads · Septiembre 2030");
    expect(notice.message).not.toMatch(/Edición \d/);
  });
});

describe("PUT /api/editions/[id]/status", () => {
  const setStatus = (edition, status) =>
    callRoute(statusRoute.PUT, { method: "PUT", body: { status }, params: params(edition) });

  it("publishing requires classes, all dated, starting in the future", async () => {
    const edition = await createEdition(db, course, { status: "draft" });
    setSession(user);
    expect((await setStatus(edition, "published")).status).toBe(403);

    setSession(admin);
    let res = await setStatus(edition, "published");
    expect(res.status).toBe(400);
    expect(res.json.message).toMatch(/sin clases/);
    await createClass(db, { editionId: edition._id, status: "enrolled", start_date: null });
    expect((await setStatus(edition, "published")).json.message).toMatch(/no tienen fecha/);
    await db.collection("classes").updateMany({ editionId: edition._id }, { $set: { start_date: daysFromNow(2) } });
    res = await setStatus(edition, "published");
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ message: "Estado actualizado", data: { status: "published" } });
    expect((await setStatus(edition, "other")).status).toBe(400);

    // Back to draft while still upcoming
    expect((await setStatus(edition, "draft")).status).toBe(200);
    expect((await db.collection("courseEditions").findOne({ _id: edition._id })).status).toBe("draft");
  });

  it("an edition of an archived course cannot be published", async () => {
    await db.collection("courses").updateOne({ _id: course._id }, { $set: { status: "archived" } });
    const { edition } = await editionWithClass({ status: "draft" });
    setSession(admin);
    const res = await setStatus(edition, "published");
    expect(res.status).toBe(400);
    expect(res.json.message).toMatch(/archivado/);
  });
});

describe("/api/editions/[id]/enrollments", () => {
  const signUp = (edition) => callRoute(enrollmentsRoute.POST, { method: "POST", params: params(edition) });

  it("POST: anonymous 401, admin 403, draft 400, user 201 pending", async () => {
    const { edition } = await editionWithClass();
    expect((await signUp(edition)).status).toBe(401);
    setSession(admin);
    expect((await signUp(edition)).status).toBe(403);
    setSession(user);
    expect((await signUp(await createEdition(db, course, { status: "draft" }))).status).toBe(400);
    const res = await signUp(edition);
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ success: true, data: { paymentStatus: "pending" } });
  });

  it("prevents duplicates and does not exceed capacity with concurrent requests", async () => {
    const { edition } = await editionWithClass({ max_participants: 2 });
    setSession(user);
    const duplicates = await Promise.all([1, 2, 3].map(() => signUp(edition)));
    expect(duplicates.filter((r) => r.status === 201)).toHaveLength(1);

    const students = await Promise.all([1, 2, 3, 4].map(() => createUser(db)));
    // The mocked auth() reads the session synchronously when each handler starts
    const results = await Promise.all(
      students.map((student) => {
        setSession(student);
        return signUp(edition);
      }),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await db.collection("courseEnrollments").countDocuments({ editionId: edition._id })).toBe(2);
  });

  it("GET: user 403; admin gets contact data and payment status", async () => {
    const { edition } = await editionWithClass();
    await enrollInEditionDoc(db, user, edition, "pending");
    setSession(user);
    expect((await callRoute(enrollmentsRoute.GET, { params: params(edition) })).status).toBe(403);
    setSession(admin);
    const res = await callRoute(enrollmentsRoute.GET, { params: params(edition) });
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual([
      expect.objectContaining({ _id: user._id.toString(), email: user.email, paymentStatus: "pending" }),
    ]);
  });

  it("PATCH confirms the payment (admin only); then the student sees the Meet link", async () => {
    const { edition } = await editionWithClass({}, { classOverrides: { googleMeetLink: "https://meet.google.com/x" } });
    await enrollInEditionDoc(db, user, edition, "pending");
    const confirm = (body = { paymentStatus: "paid" }) =>
      callRoute(enrollmentRoute.PATCH, { method: "PATCH", body, params: enrollmentParams(edition, user) });
    const myClass = async () =>
      (await callRoute(classesRoute.GET, { path: "/api/classes?myClasses=true" })).json.data[0];

    setSession(user);
    expect((await confirm()).status).toBe(403);
    expect((await myClass()).googleMeetLink).toBeUndefined();

    setSession(admin);
    expect((await confirm({ paymentStatus: "pending" })).status).toBe(400);
    const res = await confirm();
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ message: "Pago confirmado. ¡Inscripción completa!", data: { paymentStatus: "paid" } });
    expect((await confirm()).status).toBe(400);

    setSession(user);
    expect((await myClass()).googleMeetLink).toBe("https://meet.google.com/x");
  });

  it("DELETE: the student cancels (unpaid), the admin removes; paid enrollments stay", async () => {
    const { edition } = await editionWithClass();
    await enrollInEditionDoc(db, user, edition, "pending");
    await enrollInEditionDoc(db, other, edition, "paid");
    const remove = (student) =>
      callRoute(enrollmentRoute.DELETE, { method: "DELETE", params: enrollmentParams(edition, student) });

    setSession(user);
    expect((await remove(other)).status).toBe(403);
    const cancelled = await remove(user);
    expect(cancelled.status).toBe(200);
    expect(cancelled.json.message).toBe("Inscripción cancelada con éxito");

    setSession(admin);
    expect((await remove(user)).status).toBe(404);
    expect((await remove(other)).status).toBe(403);
    await enrollInEditionDoc(db, user, edition, "pending");
    const removed = await remove(user);
    expect(removed.status).toBe(200);
    expect(removed.json.message).toBe("Participante removido con éxito");
    expect(await db.collection("courseEnrollments").countDocuments({ editionId: edition._id })).toBe(1);
  });
});

describe("/api/editions/[id]/reviews", () => {
  const review = (edition, body = { rating: 4, comment: "Muy bueno" }) =>
    callRoute(reviewsRoute.POST, { method: "POST", body, params: params(edition) });
  const list = (edition, query = "") =>
    callRoute(reviewsRoute.GET, { path: `/api/editions/${edition._id}/reviews${query}`, params: params(edition) });

  it("POST: 401 anonymous, 403 unpaid or not finished, 200 upsert for a paid enrollee", async () => {
    const { edition: finished } = await editionWithClass({}, { days: -10 });
    const { edition: upcoming } = await editionWithClass();
    await enrollInEditionDoc(db, user, finished, "paid");
    await enrollInEditionDoc(db, user, upcoming, "paid");
    await enrollInEditionDoc(db, other, finished, "pending");

    expect((await review(finished)).status).toBe(401);
    setSession(other);
    expect((await review(finished)).status).toBe(403);
    setSession(user);
    expect((await review(upcoming)).status).toBe(403);
    expect((await review(finished, { rating: 9 })).status).toBe(400);
    const saved = await review(finished);
    expect(saved.status).toBe(200);
    expect(saved.json).toMatchObject({ success: true, message: "Reseña guardada", data: { rating: 4 } });
    await review(finished, { rating: 5 });
    const stored = await db.collection("reviews").find({}).toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ rating: 5 });
    expect(stored[0].courseId.equals(course._id)).toBe(true);
  });

  it("GET: paginated (?page=), only the edition's reviews, garbage page → 1, no user ids", async () => {
    const sep = (day) => ({ classOverrides: { start_date: new Date(Date.UTC(2030, 8, day, 22)) } });
    const { edition } = await editionWithClass({}, sep(2));
    const { edition: second } = await editionWithClass({}, sep(20));
    const base = Date.now() - 86400000;
    await db.collection("reviews").insertMany([
      ...Array.from({ length: 12 }, (_, i) => ({
        courseId: course._id,
        editionId: edition._id,
        userId: new ObjectId(),
        rating: 4,
        comment: `Review ${i}`,
        firstName: "ana@example.test",
        createdAt: new Date(base + i * 1000),
      })),
      { courseId: course._id, editionId: second._id, userId: new ObjectId(), rating: 2, createdAt: new Date() },
    ]);

    const first = await list(edition);
    expect(first.status).toBe(200);
    expect(first.json.data).toMatchObject({ page: 1, totalPages: 2, total: 12 });
    expect(first.json.data.items).toHaveLength(10);
    expect(first.json.data.items[0]).toMatchObject({
      comment: "Review 11",
      editionLabel: "Septiembre 2030",
      firstName: "Alumno/a",
    });
    expect(first.json.data.items[0]).not.toHaveProperty("editionNumber");
    expect(first.json.data.items[0]).not.toHaveProperty("userId");

    const page2 = await list(edition, "?page=2");
    expect(page2.json.data).toMatchObject({ page: 2, total: 12 });
    expect(page2.json.data.items.map((r) => r.comment)).toEqual(["Review 1", "Review 0"]);
    expect((await list(edition, "?page=abc")).json.data.page).toBe(1);
    expect((await list(edition, "?page=99")).json.data.page).toBe(2);
    expect((await list(second)).json.data).toMatchObject({ total: 1, items: [{ editionLabel: "Septiembre 2030 (2)" }] });

    expect((await callRoute(reviewsRoute.GET, { params: { id: "nope" } })).status).toBe(400);
    expect((await callRoute(reviewsRoute.GET, { params: { id: new ObjectId().toString() } })).status).toBe(404);
  });
});

describe("/api/classes/[id]/edition", () => {
  const link = (cls, body) => callRoute(classEditionRoute.PUT, { method: "PUT", body, params: { id: cls._id.toString() } });
  const unlink = (cls) => callRoute(classEditionRoute.DELETE, { method: "DELETE", params: { id: cls._id.toString() } });

  it("PUT links a draft class to an edition and DELETE unlinks it (admin only)", async () => {
    const edition = await createEdition(db, course, { status: "draft" });
    const cls = await createClass(db, { status: "draft", createdBy: admin._id });
    setSession(user);
    expect((await link(cls, { editionId: edition._id.toString() })).status).toBe(403);
    expect((await unlink(cls)).status).toBe(403);

    setSession(admin);
    expect((await link(cls, {})).status).toBe(400);
    expect((await link(cls, { editionId: new ObjectId().toString() })).status).toBe(404);
    const linked = await link(cls, { editionId: edition._id.toString() });
    expect(linked.status).toBe(200);
    expect(linked.json).toMatchObject({
      message: "Clase vinculada a la edición",
      data: { editionId: edition._id.toString(), status: "enrolled" },
    });
    // GET /api/classes?editionId= returns the edition's classes to admins
    const listed = await callRoute(classesRoute.GET, { path: `/api/classes?editionId=${edition._id}` });
    expect(listed.json.data.map((c) => c._id)).toEqual([cls._id.toString()]);

    const unlinked = await unlink(cls);
    expect(unlinked.status).toBe(200);
    expect(unlinked.json).toMatchObject({ message: "Clase desvinculada de la edición", data: { status: "draft" } });
    expect((await db.collection("classes").findOne({ _id: cls._id })).editionId).toBeUndefined();
    expect((await unlink(cls)).status).toBe(400);
  });

  it("GET /api/classes?editionId= is admin only", async () => {
    const edition = await createEdition(db, course);
    const path = `/api/classes?editionId=${edition._id}`;
    expect((await callRoute(classesRoute.GET, { path })).status).toBe(401);
    setSession(user);
    expect((await callRoute(classesRoute.GET, { path })).status).toBe(403);
  });
});
