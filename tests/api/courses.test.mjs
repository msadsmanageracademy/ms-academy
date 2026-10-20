// Course routes: /api/courses, /api/courses/[id] and /api/courses/[id]/editions
// (authorization, envelope and the PATCH status/content split), plus the removed routes.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import * as coursesRoute from "@/app/api/courses/route";
import * as courseRoute from "@/app/api/courses/[id]/route";
import * as editionsRoute from "@/app/api/courses/[id]/editions/route";
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

let db, admin, user, other;

beforeEach(async () => {
  db = await resetDb();
  admin = await createAdmin(db);
  user = await createUser(db);
  other = await createUser(db);
  setSession(null);
});

const params = (course) => ({ id: course._id.toString() });

/** Active course with a published edition open to enrollment (one class in `days`). */
async function openCourse(overrides = {}, { days = 7, edition = {} } = {}) {
  const course = await createCourseDoc(db, overrides);
  const open = await createEdition(db, course, edition);
  await createClass(db, { editionId: open._id, status: "enrolled", start_date: daysFromNow(days) });
  return { course, edition: open };
}

describe("POST /api/courses", () => {
  const body = {
    title: "Meta Ads",
    short_description: "Short description",
    full_description: "Full description",
    max_participants: 0,
    price: 100,
  };

  it("anonymous 401, user 403, admin 201 with an active course and its first edition", async () => {
    expect((await callRoute(coursesRoute.POST, { method: "POST", body })).status).toBe(401);
    setSession(user);
    expect((await callRoute(coursesRoute.POST, { method: "POST", body })).status).toBe(403);

    setSession(admin);
    const res = await callRoute(coursesRoute.POST, { method: "POST", body: { ...body, status: "archived" } });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ success: true, message: "Curso creado con éxito" });
    expect(Object.keys(res.json.data).sort()).toEqual(["_id", "editionId"]);
    const course = await db.collection("courses").findOne({ _id: new ObjectId(res.json.data._id) });
    expect(course).toMatchObject({ title: "Meta Ads", status: "active" });
    expect(course).not.toHaveProperty("price");
    const edition = await db.collection("courseEditions").findOne({ _id: new ObjectId(res.json.data.editionId) });
    expect(edition).toMatchObject({ status: "draft", price: 100, max_participants: null });
    expect(edition).not.toHaveProperty("number");
    expect(edition.courseId.equals(course._id)).toBe(true);
  });

  it("validation errors are 400 with details and write nothing", async () => {
    setSession(admin);
    const res = await callRoute(coursesRoute.POST, { method: "POST", body: { ...body, title: "x", price: -1 } });
    expect(res.status).toBe(400);
    expect(Array.isArray(res.json.details)).toBe(true);
    expect(await db.collection("courses").countDocuments()).toBe(0);
    expect(await db.collection("courseEditions").countDocuments()).toBe(0);
  });
});

describe("GET /api/courses", () => {
  it("the public catalog lists active courses with an open edition, without paid counts", async () => {
    const { course, edition } = await openCourse({ title: "Open" });
    await enrollInEditionDoc(db, other, edition, "paid");
    await openCourse({ title: "Archived", status: "archived" });
    await createEdition(db, await createCourseDoc(db, { title: "Draft only" }), { status: "draft" });

    const res = await callRoute(coursesRoute.GET, { path: "/api/courses" });
    expect(res.status).toBe(200);
    expect(res.json.data.map((c) => c.title)).toEqual(["Open"]);
    const [row] = res.json.data;
    expect(row._id).toBe(course._id.toString());
    expect(row.openEdition).toMatchObject({
      _id: edition._id.toString(),
      label: expect.stringMatching(/^[A-ZÁÉÍÓÚ][a-záéíóú]+ \d{4}$/),
      enrollmentCount: 1,
    });
    expect(row.openEdition).not.toHaveProperty("number");
    expect(row.openEdition).not.toHaveProperty("adminNumber");
    expect(row.openEdition).not.toHaveProperty("paidCount");
    expect(row.openEdition).not.toHaveProperty("userPaymentStatus");
  });

  it("includes the user's own payment status in the open edition", async () => {
    const { edition } = await openCourse();
    await enrollInEditionDoc(db, user, edition, "pending");
    setSession(user);
    const [row] = (await callRoute(coursesRoute.GET, { path: "/api/courses" })).json.data;
    expect(row.openEdition.userPaymentStatus).toBe("pending");
  });

  it("showAll: anonymous 401, user 403, admin gets every course card", async () => {
    const path = "/api/courses?showAll=true";
    expect((await callRoute(coursesRoute.GET, { path })).status).toBe(401);
    setSession(user);
    expect((await callRoute(coursesRoute.GET, { path })).status).toBe(403);

    await openCourse({ title: "Open" });
    await createEdition(db, await createCourseDoc(db, { title: "Archived", status: "archived" }), { status: "draft" });
    setSession(admin);
    const res = await callRoute(coursesRoute.GET, { path });
    expect(res.status).toBe(200);
    expect(res.json.data.map((c) => c.title).sort()).toEqual(["Archived", "Open"]);
    const open = res.json.data.find((c) => c.title === "Open");
    expect(open).toMatchObject({ status: "active", editionCount: 1, current: { adminNumber: 1 } });
  });
});

describe("GET /api/courses/[id]", () => {
  it("visible when listed; a course without published editions only for admins and enrollees", async () => {
    const { course, edition } = await openCourse();
    const listed = await callRoute(courseRoute.GET, { params: params(course) });
    expect(listed.status).toBe(200);
    expect(listed.json.data.openEdition._id).toBe(edition._id.toString());
    expect(listed.json.data).not.toHaveProperty("createdBy");

    const hidden = await createCourseDoc(db);
    const draft = await createEdition(db, hidden, { status: "draft" });
    setSession(user);
    expect((await callRoute(courseRoute.GET, { params: params(hidden) })).status).toBe(404);
    await enrollInEditionDoc(db, user, draft, "pending");
    expect((await callRoute(courseRoute.GET, { params: params(hidden) })).status).toBe(200);
    setSession(admin);
    expect((await callRoute(courseRoute.GET, { params: params(hidden) })).json.data.openEdition).toBeNull();
  });

  it("invalid id 400, unknown course 404", async () => {
    expect((await callRoute(courseRoute.GET, { params: { id: "nope" } })).status).toBe(400);
    expect((await callRoute(courseRoute.GET, { params: { id: new ObjectId().toString() } })).status).toBe(404);
  });
});

describe("PATCH /api/courses/[id]", () => {
  const content = { title: "Renamed", short_description: "New short text", full_description: "New full text" };
  const patch = (course, body) => callRoute(courseRoute.PATCH, { method: "PATCH", body, params: params(course) });
  const statusOf = async (course) => (await db.collection("courses").findOne({ _id: course._id })).status;

  it("rejects regular users", async () => {
    const course = await createCourseDoc(db);
    setSession(user);
    expect((await patch(course, content)).status).toBe(403);
    expect((await patch(course, { status: "archived" })).status).toBe(403);
    expect(await statusOf(course)).toBe("active");
  });

  it("edits the content even with a published edition", async () => {
    const { course } = await openCourse();
    setSession(admin);
    const res = await patch(course, content);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ success: true, message: "Curso actualizado con éxito" });
    expect(await db.collection("courses").findOne({ _id: course._id })).toMatchObject(content);
  });

  it("{ status } alone archives and reactivates the course", async () => {
    const course = await createCourseDoc(db);
    await createEdition(db, course, { status: "draft" });
    setSession(admin);
    const archived = await patch(course, { status: "archived" });
    expect(archived.status).toBe(200);
    expect(archived.json).toMatchObject({ message: "Estado actualizado", data: { status: "archived" } });
    expect(await statusOf(course)).toBe("archived");
    expect((await patch(course, { status: "active" })).status).toBe(200);
    expect(await statusOf(course)).toBe("active");
    expect((await patch(course, { status: "published" })).status).toBe(400);
  });

  it("status mixed with other fields → 400 and nothing changes", async () => {
    const course = await createCourseDoc(db, { title: "Original" });
    setSession(admin);
    const res = await patch(course, { ...content, status: "archived" });
    expect(res.status).toBe(400);
    expect(await db.collection("courses").findOne({ _id: course._id })).toMatchObject({
      title: "Original",
      status: "active",
    });
  });

  it("archiving is blocked while an edition is published and upcoming", async () => {
    const { course } = await openCourse();
    setSession(admin);
    const res = await patch(course, { status: "archived" });
    expect(res.status).toBe(400);
    expect(res.json.success).toBe(false);
    expect(await statusOf(course)).toBe("active");
  });
});

describe("DELETE /api/courses/[id]", () => {
  const remove = (course) => callRoute(courseRoute.DELETE, { method: "DELETE", params: params(course) });

  it("user 403; with enrollees 400; without them deletes the course and its editions", async () => {
    const { course, edition } = await openCourse();
    await enrollInEditionDoc(db, other, edition, "pending");
    setSession(user);
    expect((await remove(course)).status).toBe(403);
    setSession(admin);
    const blocked = await remove(course);
    expect(blocked.status).toBe(400);
    expect(blocked.json.message).toMatch(/Archivalo en su lugar/);

    await db.collection("courseEnrollments").deleteMany({});
    const res = await remove(course);
    expect(res.status).toBe(200);
    expect(res.json.message).toBe("Curso eliminado con éxito");
    expect(await db.collection("courses").countDocuments()).toBe(0);
    expect(await db.collection("courseEditions").countDocuments()).toBe(0);
    expect(await db.collection("classes").countDocuments()).toBe(0);
  });
});

describe("/api/courses/[id]/editions", () => {
  it("GET: anonymous 401, user 403, admin gets the editions with their counts", async () => {
    const { course, edition } = await openCourse();
    await createEdition(db, course, { status: "draft" });
    await enrollInEditionDoc(db, user, edition, "paid");
    expect((await callRoute(editionsRoute.GET, { params: params(course) })).status).toBe(401);
    setSession(user);
    expect((await callRoute(editionsRoute.GET, { params: params(course) })).status).toBe(403);

    setSession(admin);
    const res = await callRoute(editionsRoute.GET, { params: params(course) });
    expect(res.status).toBe(200);
    // Chronological: the dated edition first, the undated draft last
    expect(res.json.data.map((e) => e.adminNumber)).toEqual([1, 2]);
    expect(res.json.data[1].label).toBe("Sin fecha");
    expect(res.json.data[0]).toMatchObject({ enrollmentCount: 1, paidCount: 1, status: "published" });
    expect((await callRoute(editionsRoute.GET, { params: { id: new ObjectId().toString() } })).status).toBe(404);
  });

  it("POST: user 403; admin 201 creates the next draft edition with the last price", async () => {
    const { course } = await openCourse({}, { edition: { price: 2500, max_participants: 15 } });
    setSession(user);
    expect((await callRoute(editionsRoute.POST, { method: "POST", params: params(course) })).status).toBe(403);

    setSession(admin);
    const res = await callRoute(editionsRoute.POST, { method: "POST", params: params(course) });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ success: true, message: "Edición creada con éxito" });
    expect(Object.keys(res.json.data)).toEqual(["_id"]);
    const created = await db.collection("courseEditions").findOne({ _id: new ObjectId(res.json.data._id) });
    expect(created).toMatchObject({ status: "draft", price: 2500, max_participants: 15 });
    expect(created).not.toHaveProperty("number");
    // The class is copied without a date
    expect(await db.collection("classes").findOne({ editionId: created._id })).toMatchObject({ start_date: null });
    expect((await callRoute(editionsRoute.POST, { method: "POST", params: { id: new ObjectId().toString() } })).status).toBe(404);
  });
});

describe("removed routes", () => {
  it.each([
    "src/app/api/courses/[id]/clone",
    "src/app/api/courses/[id]/status",
    "src/app/api/courses/[id]/enrollments",
    "src/app/api/courses/[id]/reviews",
    "src/app/api/classes/[id]/course",
  ])("%s has no route handler (Next.js answers 404)", (dir) => {
    expect(existsSync(resolve(process.cwd(), dir, "route.js"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), dir))).toBe(false);
  });
});
