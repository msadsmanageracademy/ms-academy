// Edition service (src/server/courses/editions.js): creation under concurrency, copy of
// price/capacity/classes, editing, publishing, deletion, reads by id and authorization.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Collection } from "mongodb";
import {
  createEdition,
  deleteEdition,
  getAdminEdition,
  getEditionDetail,
  setEditionStatus,
  updateEdition,
} from "@/server/courses/editions";
import { setCourseStatus } from "@/server/courses/service";
import { deleteClassCalendarEvent } from "@/server/classes/calendar";
import { RESTRICTED_CLASS_FIELDS } from "@/server/classes/service";
import {
  ObjectId,
  createAdmin,
  createClass,
  createCourseDoc,
  createEdition as createEditionDoc,
  createUser,
  daysFromNow,
  enrollInEditionDoc,
  resetDb,
} from "../helpers.mjs";

vi.mock("@/server/classes/calendar", async (importOriginal) => ({
  ...(await importOriginal()),
  deleteClassCalendarEvent: vi.fn(async () => {}),
}));

let db, admin, student, course;

const actorOf = (u) => ({ id: u._id.toString(), role: u.role, name: u.first_name, email: u.email });
const asAdmin = () => actorOf(admin);

function failOn(method, collectionName, error = new Error(`simulated ${method} failure`)) {
  const original = Collection.prototype[method];
  vi.spyOn(Collection.prototype, method).mockImplementation(function (...args) {
    if (this.collectionName === collectionName) return Promise.reject(error);
    return original.apply(this, args);
  });
}

const findEdition = (id) => db.collection("courseEditions").findOne({ _id: new ObjectId(String(id)) });

beforeEach(async () => {
  db = await resetDb();
  admin = await createAdmin(db, { first_name: "Admin" });
  student = await createUser(db, { first_name: "Student" });
  course = await createCourseDoc(db, { title: "Meta Ads" });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(deleteClassCalendarEvent).mockClear();
});

describe("createEdition", () => {
  it("concurrent creations each create one draft edition, none with a number", async () => {
    await createEditionDoc(db, course);
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => createEdition(asAdmin(), course._id.toString())));

    expect(new Set(results.map((r) => r._id)).size).toBe(5);
    for (const result of results) expect(Object.keys(result)).toEqual(["_id"]);
    const editions = await db.collection("courseEditions").find({ courseId: course._id }).toArray();
    expect(editions).toHaveLength(6);
    for (const edition of editions) expect(edition).not.toHaveProperty("number");
    expect(editions.filter((e) => e.status === "draft")).toHaveLength(5);
  });

  it("copies price, capacity and classes (without dates) of the most recently created edition", async () => {
    // The older edition starts LATER than the newest one: creation order decides, not dates
    const older = await createEditionDoc(db, course, {
      price: 1000,
      max_participants: 10,
      createdAt: new Date("2030-01-01T00:00:00Z"),
    });
    await createClass(db, { editionId: older._id, status: "enrolled", title: "Vieja", start_date: daysFromNow(60) });
    const last = await createEditionDoc(db, course, {
      price: 2500,
      max_participants: 20,
      createdAt: new Date("2030-02-01T00:00:00Z"),
    });
    const original = await createClass(db, {
      editionId: last._id,
      status: "enrolled",
      title: "Pixel y conversiones",
      short_description: "Cómo medir campañas",
      duration: 90,
      start_date: daysFromNow(-5),
      participants: [student._id],
      googleEventId: "evt",
      googleEventUrl: "https://calendar.google.com/event?eid=abc",
      googleMeetLink: "https://meet.google.com/abc-defg-hij",
      calendarEventLink: "https://calendar.google.com/x",
      recording_url: "https://example.test/recording",
      resources: [{ title: "Slides", url: "https://example.test/slides" }],
    });
    await createClass(db, { editionId: last._id, status: "enrolled", title: "Segunda", start_date: daysFromNow(-4) });

    const result = await createEdition(asAdmin(), course._id.toString());
    expect(result).toEqual({ _id: expect.any(String) });
    const created = await findEdition(result._id);
    expect(created).toMatchObject({ status: "draft", price: 2500, max_participants: 20 });
    expect(created).not.toHaveProperty("number");
    expect(created.courseId.equals(course._id)).toBe(true);

    const copies = await db.collection("classes").find({ editionId: created._id }).sort({ title: 1 }).toArray();
    expect(copies.map((c) => c.title)).toEqual(["Pixel y conversiones", "Segunda"]);
    const copy = copies[0];
    expect(copy).toMatchObject({
      short_description: "Cómo medir campañas",
      duration: 90,
      start_date: null,
      status: "enrolled",
      max_participants: null,
    });
    expect(copy._id.equals(original._id)).toBe(false);
    expect(copy).not.toHaveProperty("participants");
    for (const field of RESTRICTED_CLASS_FIELDS) expect(copy).not.toHaveProperty(field);
    // The original edition keeps its classes as they were
    const kept = await db.collection("classes").findOne({ _id: original._id });
    expect(kept).toMatchObject({ googleMeetLink: "https://meet.google.com/abc-defg-hij" });
    expect(kept.editionId.equals(last._id)).toBe(true);
  });

  it("a failure while copying the classes leaves no new edition", async () => {
    const last = await createEditionDoc(db, course);
    await createClass(db, { editionId: last._id, status: "enrolled" });
    failOn("insertMany", "classes");

    await expect(createEdition(asAdmin(), course._id.toString())).rejects.toThrow("simulated");
    expect(await db.collection("courseEditions").countDocuments({ courseId: course._id })).toBe(1);
    expect(await db.collection("classes").countDocuments()).toBe(1);
  });

  it("404 for unknown courses, 400 for invalid ids or courses without editions, admin only", async () => {
    await expect(createEdition(asAdmin(), new ObjectId().toString())).rejects.toMatchObject({ status: 404 });
    await expect(createEdition(asAdmin(), "nope")).rejects.toMatchObject({ status: 400 });
    await expect(createEdition(asAdmin(), course._id.toString())).rejects.toMatchObject({ status: 400 });
    await expect(createEdition(null, course._id.toString())).rejects.toMatchObject({ status: 401 });
    await expect(createEdition(actorOf(student), course._id.toString())).rejects.toMatchObject({ status: 403 });
  });
});

describe("updateEdition", () => {
  it("edits price and capacity of a draft (capacity 0 → no limit)", async () => {
    const edition = await createEditionDoc(db, course, { status: "draft", max_participants: 5 });
    const result = await updateEdition(asAdmin(), edition._id.toString(), { price: 3000, max_participants: 0 });
    expect(result).toMatchObject({ price: 3000, max_participants: null });
    expect(await findEdition(edition._id)).toMatchObject({ price: 3000, max_participants: null });
  });

  it("a published edition keeps its price and capacity", async () => {
    const edition = await createEditionDoc(db, course, { price: 1000, max_participants: 5 });
    await expect(
      updateEdition(asAdmin(), edition._id.toString(), { price: 1, max_participants: 1 }),
    ).rejects.toMatchObject({ status: 400, message: "No se pueden editar el precio ni el cupo de una edición publicada" });
    expect(await findEdition(edition._id)).toMatchObject({ price: 1000, max_participants: 5 });
  });

  it("validates, 404s and is admin only", async () => {
    const edition = await createEditionDoc(db, course, { status: "draft" });
    const id = edition._id.toString();
    await expect(updateEdition(asAdmin(), id, { price: -1 })).rejects.toMatchObject({ status: 400 });
    await expect(updateEdition(asAdmin(), new ObjectId().toString(), { price: 1 })).rejects.toMatchObject({
      status: 404,
    });
    await expect(updateEdition(asAdmin(), "nope", { price: 1 })).rejects.toMatchObject({
      status: 400,
      message: "ID de edición inválido",
    });
    await expect(updateEdition(actorOf(student), id, { price: 1 })).rejects.toMatchObject({ status: 403 });
  });
});

describe("setEditionStatus", () => {
  const publish = (edition) => setEditionStatus(asAdmin(), edition._id.toString(), { status: "published" });

  it("publishes a draft of an active course whose classes are all dated in the future", async () => {
    const edition = await createEditionDoc(db, course, { status: "draft" });
    await createClass(db, { editionId: edition._id, status: "enrolled", start_date: daysFromNow(3) });
    expect(await publish(edition)).toMatchObject({ status: "published" });
    expect((await findEdition(edition._id)).status).toBe("published");
  });

  it("refuses with the first unmet reason and leaves the status unchanged", async () => {
    const archived = await createCourseDoc(db, { status: "archived" });
    const ofArchived = await createEditionDoc(db, archived, { status: "draft" });
    await createClass(db, { editionId: ofArchived._id, status: "enrolled", start_date: daysFromNow(3) });
    await expect(publish(ofArchived)).rejects.toMatchObject({
      status: 400,
      message: "No se puede publicar una edición de un curso archivado",
    });

    const empty = await createEditionDoc(db, course, { status: "draft" });
    await expect(publish(empty)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("sin clases asignadas"),
    });

    const undated = await createEditionDoc(db, course, { status: "draft" });
    await createClass(db, { editionId: undated._id, status: "enrolled", start_date: daysFromNow(3) });
    await createClass(db, { editionId: undated._id, status: "enrolled", start_date: null });
    await expect(publish(undated)).rejects.toMatchObject({
      status: 400,
      message: "No se puede publicar: 1 clase(s) no tienen fecha asignada",
    });

    const started = await createEditionDoc(db, course, { status: "draft" });
    await createClass(db, { editionId: started._id, status: "enrolled", start_date: daysFromNow(-1) });
    await expect(publish(started)).rejects.toMatchObject({
      status: 400,
      message: "No se puede publicar una edición cuya primera clase ya comenzó",
    });

    for (const edition of [ofArchived, empty, undated, started]) {
      expect((await findEdition(edition._id)).status).toBe("draft");
    }
  });

  it("unpublishes an upcoming edition but not one in progress", async () => {
    const upcoming = await createEditionDoc(db, course);
    await createClass(db, { editionId: upcoming._id, status: "enrolled", start_date: daysFromNow(3) });
    await setEditionStatus(asAdmin(), upcoming._id.toString(), { status: "draft" });
    expect((await findEdition(upcoming._id)).status).toBe("draft");

    const live = await createEditionDoc(db, course);
    await createClass(db, { editionId: live._id, status: "enrolled", start_date: daysFromNow(-2) });
    await createClass(db, { editionId: live._id, status: "enrolled", start_date: daysFromNow(2) });
    await expect(setEditionStatus(asAdmin(), live._id.toString(), { status: "draft" })).rejects.toMatchObject({
      status: 400,
      message: "No se puede despublicar una edición que está en curso en este momento",
    });
    expect((await findEdition(live._id)).status).toBe("published");
  });

  it("validates the status, 404s and is admin only", async () => {
    const edition = await createEditionDoc(db, course, { status: "draft" });
    const id = edition._id.toString();
    await expect(setEditionStatus(asAdmin(), id, { status: "archived" })).rejects.toMatchObject({
      status: 400,
      message: "Estado inválido",
    });
    await expect(
      setEditionStatus(asAdmin(), new ObjectId().toString(), { status: "draft" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(setEditionStatus(null, id, { status: "draft" })).rejects.toMatchObject({ status: 401 });
    await expect(setEditionStatus(actorOf(student), id, { status: "draft" })).rejects.toMatchObject({ status: 403 });
  });

  it("archiving the course while publishing an edition never leaves both done", async () => {
    for (let round = 0; round < 8; round++) {
      const target = await createCourseDoc(db, { title: `Curso ${round}` });
      const edition = await createEditionDoc(db, target, { status: "draft" });
      await createClass(db, { editionId: edition._id, status: "enrolled", start_date: daysFromNow(3) });

      const [archived, published] = await Promise.allSettled([
        setCourseStatus(asAdmin(), target._id.toString(), { status: "archived" }),
        publish(edition),
      ]);
      const courseStatus = (await db.collection("courses").findOne({ _id: target._id })).status;
      const editionStatus = (await findEdition(edition._id)).status;

      // Whichever runs second sees the first one's result and is refused
      expect([archived.status, published.status].filter((s) => s === "fulfilled")).toHaveLength(1);
      expect([courseStatus, editionStatus]).not.toEqual(["archived", "published"]);
      expect(courseStatus).toBe(archived.status === "fulfilled" ? "archived" : "active");
      expect(editionStatus).toBe(published.status === "fulfilled" ? "published" : "draft");
    }
  });
});

describe("deleteEdition", () => {
  it("refuses a published edition and leaves its data intact", async () => {
    const edition = await createEditionDoc(db, course);
    await createClass(db, { editionId: edition._id, status: "enrolled" });
    await enrollInEditionDoc(db, student, edition, "pending");

    await expect(deleteEdition(asAdmin(), edition._id.toString())).rejects.toMatchObject({
      status: 400,
      message: "No se puede eliminar una edición publicada. Despublicala primero.",
    });
    expect(await findEdition(edition._id)).not.toBeNull();
    expect(await db.collection("classes").countDocuments({ editionId: edition._id })).toBe(1);
    expect(await db.collection("courseEnrollments").countDocuments({ editionId: edition._id })).toBe(1);
  });

  it("deletes a draft with its classes, enrollments and reviews, then notifies the enrollees", async () => {
    const kept = await createEditionDoc(db, course);
    const keptClass = await createClass(db, { editionId: kept._id, status: "enrolled" });
    const edition = await createEditionDoc(db, course, { status: "draft" });
    const evented = await createClass(db, {
      editionId: edition._id,
      status: "enrolled",
      start_date: new Date("2030-09-10T22:00:00Z"),
      googleEventId: "evt",
      createdBy: admin._id,
    });
    const other = await createUser(db, { first_name: "Otro" });
    await enrollInEditionDoc(db, student, edition, "pending");
    await enrollInEditionDoc(db, other, edition, "paid");
    await db.collection("reviews").insertOne({
      userId: other._id,
      courseId: course._id,
      editionId: edition._id,
      rating: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await deleteEdition(asAdmin(), edition._id.toString());
    expect(await findEdition(edition._id)).toBeNull();
    expect(await db.collection("classes").countDocuments({ editionId: edition._id })).toBe(0);
    expect(await db.collection("courseEnrollments").countDocuments({ editionId: edition._id })).toBe(0);
    expect(await db.collection("reviews").countDocuments({ editionId: edition._id })).toBe(0);
    // The other edition is untouched
    expect(await findEdition(kept._id)).not.toBeNull();
    expect(await db.collection("classes").countDocuments({ _id: keptClass._id })).toBe(1);

    const notifications = await db.collection("notifications").find({}).toArray();
    expect(notifications.map((n) => n.userId.toString()).sort()).toEqual(
      [student._id.toString(), other._id.toString()].sort(),
    );
    for (const n of notifications) {
      expect(n).toMatchObject({
        type: "course.cancelled",
        relatedType: "edition",
        message: 'La edición "Meta Ads · Septiembre 2030" fue eliminada y se canceló tu inscripción',
      });
      expect(n.message).not.toMatch(/Edición \d/);
      expect(Object.keys(n.metadata)).toEqual(["courseId"]);
      expect(n.relatedId.equals(edition._id)).toBe(true);
      expect(n.metadata.courseId.equals(course._id)).toBe(true);
    }

    const calls = vi.mocked(deleteClassCalendarEvent).mock.calls.map(([cls]) => cls);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ googleEventId: "evt" });
    expect(calls[0]._id.equals(evented._id)).toBe(true);
  });

  it("a failure halfway deletes nothing and notifies nobody", async () => {
    const edition = await createEditionDoc(db, course, { status: "draft" });
    await createClass(db, { editionId: edition._id, status: "enrolled" });
    await enrollInEditionDoc(db, student, edition, "pending");
    failOn("deleteMany", "reviews");

    await expect(deleteEdition(asAdmin(), edition._id.toString())).rejects.toThrow("simulated");
    expect(await findEdition(edition._id)).not.toBeNull();
    expect(await db.collection("classes").countDocuments({ editionId: edition._id })).toBe(1);
    expect(await db.collection("courseEnrollments").countDocuments({ editionId: edition._id })).toBe(1);
    expect(await db.collection("notifications").countDocuments()).toBe(0);
    expect(deleteClassCalendarEvent).not.toHaveBeenCalled();
  });

  it("404s and is admin only", async () => {
    const edition = await createEditionDoc(db, course, { status: "draft" });
    await expect(deleteEdition(asAdmin(), new ObjectId().toString())).rejects.toMatchObject({ status: 404 });
    await expect(deleteEdition(null, edition._id.toString())).rejects.toMatchObject({ status: 401 });
    await expect(deleteEdition(actorOf(student), edition._id.toString())).rejects.toMatchObject({ status: 403 });
    expect(await findEdition(edition._id)).not.toBeNull();
  });
});

describe("reads", () => {
  it("getAdminEdition: edition by id, course, counts, label and its admin number (Edición N de M)", async () => {
    const first = await createEditionDoc(db, course, { price: 1200 });
    await createClass(db, { editionId: first._id, status: "enrolled", start_date: daysFromNow(-10) });
    await enrollInEditionDoc(db, student, first, "paid");
    await createEditionDoc(db, course, { status: "draft" });
    await createEditionDoc(db, course, { status: "draft" });

    const edition = await getAdminEdition(asAdmin(), course._id.toString(), first._id.toString());
    expect(edition).toMatchObject({
      adminNumber: 1,
      editionCount: 3,
      label: expect.stringMatching(/^[A-ZÁÉÍÓÚ][a-záéíóú]+ \d{4}$/),
      price: 1200,
      timeStatus: "completed",
      amount_of_classes: 1,
      enrollmentCount: 1,
      paidCount: 1,
      avgRating: null,
      reviewCount: 0,
      course: { title: "Meta Ads", status: "active" },
    });
    expect(edition).not.toHaveProperty("number");
    expect(edition._id.equals(first._id)).toBe(true);
    // Undated drafts come last, by creation
    const [, second] = await db.collection("courseEditions").find({ courseId: course._id }).sort({ _id: 1 }).toArray();
    expect(await getAdminEdition(asAdmin(), course._id.toString(), second._id.toString())).toMatchObject({
      adminNumber: 2,
      editionCount: 3,
      label: "Sin fecha",
    });
  });

  it("getAdminEdition: 404 for an edition of another course or unknown ids, 400 for malformed ids, admin only", async () => {
    const edition = await createEditionDoc(db, course);
    const other = await createCourseDoc(db, { title: "Google Ads" });
    const foreign = await createEditionDoc(db, other);
    const id = course._id.toString();

    await expect(getAdminEdition(asAdmin(), id, foreign._id.toString())).rejects.toMatchObject({ status: 404 });
    await expect(getAdminEdition(asAdmin(), id, new ObjectId().toString())).rejects.toMatchObject({ status: 404 });
    await expect(
      getAdminEdition(asAdmin(), new ObjectId().toString(), edition._id.toString()),
    ).rejects.toMatchObject({ status: 404 });
    for (const bad of ["1", "abc", ""]) {
      await expect(getAdminEdition(asAdmin(), id, bad)).rejects.toMatchObject({ status: 400 });
    }
    await expect(getAdminEdition(asAdmin(), "nope", edition._id.toString())).rejects.toMatchObject({ status: 400 });
    await expect(getAdminEdition(actorOf(student), id, edition._id.toString())).rejects.toMatchObject({
      status: 403,
    });
  });

  it("getEditionDetail: published editions are public (no paid count); drafts only for admins and enrollees", async () => {
    const published = await createEditionDoc(db, course, { createdBy: admin._id });
    await enrollInEditionDoc(db, await createUser(db), published, "paid");
    const anonymous = await getEditionDetail(null, published._id.toString());
    expect(anonymous).toMatchObject({
      label: expect.any(String),
      enrollmentCount: 1,
      course: { title: "Meta Ads" },
    });
    expect(anonymous).not.toHaveProperty("paidCount");
    // The edition number is admin-only
    expect(anonymous).not.toHaveProperty("adminNumber");
    expect(anonymous).not.toHaveProperty("editionCount");
    expect(await getEditionDetail(asAdmin(), published._id.toString())).toMatchObject({
      adminNumber: 1,
      editionCount: 1,
    });
    expect(anonymous).not.toHaveProperty("createdBy");
    expect(anonymous).not.toHaveProperty("userPaymentStatus");
    expect((await getEditionDetail(asAdmin(), published._id.toString())).paidCount).toBe(1);

    const draft = await createEditionDoc(db, course, { status: "draft" });
    await expect(getEditionDetail(null, draft._id.toString())).rejects.toMatchObject({ status: 404 });
    await expect(getEditionDetail(actorOf(student), draft._id.toString())).rejects.toMatchObject({ status: 404 });
    await enrollInEditionDoc(db, student, draft, "pending");
    const enrolled = await getEditionDetail(actorOf(student), draft._id.toString());
    expect(enrolled).toMatchObject({ userPaymentStatus: "pending" });
    expect(enrolled).not.toHaveProperty("adminNumber");
    await expect(getEditionDetail(null, "nope")).rejects.toMatchObject({ status: 400 });
  });
});
