// Course service (src/server/courses/service.js): create (course + Edition 1), edit,
// archive/reactivate, delete, admin cards and course page metrics, public detail.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Collection } from "mongodb";
import {
  createCourse,
  deleteCourse,
  getAdminCourse,
  getCourseDetail,
  listAdminCourses,
  setCourseStatus,
  updateCourse,
} from "@/server/courses/service";
import { deleteClassCalendarEvent } from "@/server/classes/calendar";
import {
  ObjectId,
  createAdmin,
  createClass,
  createCourseDoc,
  createEdition,
  createUser,
  daysFromNow,
  enrollInEditionDoc,
  resetDb,
} from "../helpers.mjs";
import { forAll, gen } from "../support/random.mjs";

// Calendar is external: only check that the events of deleted classes are removed
vi.mock("@/server/classes/calendar", async (importOriginal) => ({
  ...(await importOriginal()),
  deleteClassCalendarEvent: vi.fn(async () => {}),
}));

let db, admin, student;

const actorOf = (u) => ({ id: u._id.toString(), role: u.role, name: u.first_name, email: u.email });

const content = {
  title: "Meta Ads",
  short_description: "Campañas que convierten",
  full_description: "Todo lo necesario para planificar campañas.",
};

/** Failing `method` on one collection only (the rest keeps working). */
function failOn(method, collectionName) {
  const original = Collection.prototype[method];
  vi.spyOn(Collection.prototype, method).mockImplementation(function (...args) {
    if (this.collectionName === collectionName) return Promise.reject(new Error(`simulated ${method} failure`));
    return original.apply(this, args);
  });
}

// Edition classes: "completed" (past), "in-progress" (past + future), "upcoming" (future)
async function scheduleEdition(edition, timeStatus, extra = {}) {
  const dates = {
    completed: [daysFromNow(-30), daysFromNow(-20)],
    "in-progress": [daysFromNow(-3), daysFromNow(4)],
    upcoming: [daysFromNow(10), daysFromNow(17)],
  }[timeStatus];
  for (const start_date of dates) {
    await createClass(db, { editionId: edition._id, status: "enrolled", start_date, ...extra });
  }
}

const review = (user, course, edition, rating) =>
  db.collection("reviews").insertOne({
    userId: user._id,
    courseId: course._id,
    editionId: edition._id,
    rating,
    comment: "Muy bueno",
    firstName: user.first_name,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

beforeEach(async () => {
  db = await resetDb();
  admin = await createAdmin(db, { first_name: "Admin" });
  student = await createUser(db, { first_name: "Student" });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(deleteClassCalendarEvent).mockClear();
});

describe("createCourse", () => {
  it("Feature: course-editions, Property 8: Crear curso crea su primera edición", async () => {
    const inputGen = gen.record({
      title: gen.string({ min: 3, max: 30 }),
      short_description: gen.string({ min: 10, max: 60 }),
      full_description: gen.string({ min: 10, max: 120 }),
      price: gen.oneOf(gen.constant(0), gen.int(1, 200000), gen.pick([1500.5, 49990])),
      max_participants: gen.oneOf(gen.constant(0), gen.constant(null), gen.int(1, 60)),
    });

    await forAll(inputGen, async (input) => {
      const result = await createCourse(actorOf(admin), input);
      const courseId = new ObjectId(result._id);
      expect(Object.keys(result).sort()).toEqual(["_id", "editionId"]);

      const course = await db.collection("courses").findOne({ _id: courseId });
      expect(course).toMatchObject({
        title: input.title,
        short_description: input.short_description,
        full_description: input.full_description,
        status: "active",
      });
      expect(course.createdBy.equals(admin._id)).toBe(true);
      // Content only: no price, capacity, type or series link on the course
      expect(Object.keys(course).sort()).toEqual(
        ["_id", "createdAt", "createdBy", "full_description", "short_description", "status", "title", "updatedAt"],
      );

      const editions = await db.collection("courseEditions").find({ courseId }).toArray();
      expect(editions).toHaveLength(1);
      expect(editions[0]._id.toString()).toBe(result.editionId);
      expect(editions[0]).not.toHaveProperty("number");
      expect(editions[0]).toMatchObject({
        status: "draft",
        price: input.price,
        max_participants: input.max_participants || null,
      });
    });
    // 100 DB-backed runs: a few seconds alone, much slower while the whole suite runs in parallel
  }, 60_000);

  it("is all or nothing: if the first edition fails, no course is left", async () => {
    failOn("insertOne", "courseEditions");
    await expect(createCourse(actorOf(admin), { ...content, price: 1000 })).rejects.toThrow("simulated");
    expect(await db.collection("courses").countDocuments()).toBe(0);
    expect(await db.collection("courseEditions").countDocuments()).toBe(0);
  });

  it("validates the input (400 with the issues) and is admin only", async () => {
    await expect(createCourse(actorOf(admin), { ...content, price: -1 })).rejects.toMatchObject({
      status: 400,
      details: [expect.objectContaining({ message: "Debe ingresar 0 o mayor" })],
    });
    await expect(createCourse(actorOf(admin), { title: "M", price: 0 })).rejects.toMatchObject({ status: 400 });
    await expect(createCourse(null, { ...content, price: 0 })).rejects.toMatchObject({ status: 401 });
    await expect(createCourse(actorOf(student), { ...content, price: 0 })).rejects.toMatchObject({ status: 403 });
    expect(await db.collection("courses").countDocuments()).toBe(0);
  });
});

describe("updateCourse", () => {
  it("edits title and descriptions even with a published edition; price and capacity are not course fields", async () => {
    const course = await createCourseDoc(db);
    const edition = await createEdition(db, course, { price: 1000 });
    await scheduleEdition(edition, "upcoming");

    await updateCourse(actorOf(admin), course._id.toString(), { ...content, price: 5 });
    const saved = await db.collection("courses").findOne({ _id: course._id });
    expect(saved).toMatchObject(content);
    expect(saved).not.toHaveProperty("price");
    expect((await db.collection("courseEditions").findOne({ _id: edition._id })).price).toBe(1000);
  });

  it("rejects status changes, invalid content and unknown courses", async () => {
    const course = await createCourseDoc(db);
    const id = course._id.toString();
    await expect(updateCourse(actorOf(admin), id, { ...content, status: "archived" })).rejects.toMatchObject({
      status: 400,
    });
    await expect(updateCourse(actorOf(admin), id, { ...content, title: "M" })).rejects.toMatchObject({ status: 400 });
    await expect(updateCourse(actorOf(admin), new ObjectId().toString(), content)).rejects.toMatchObject({
      status: 404,
    });
    await expect(updateCourse(actorOf(admin), "nope", content)).rejects.toMatchObject({
      status: 400,
      message: "ID de curso inválido",
    });
    await expect(updateCourse(actorOf(student), id, content)).rejects.toMatchObject({ status: 403 });
    expect((await db.collection("courses").findOne({ _id: course._id })).status).toBe("active");
  });
});

describe("setCourseStatus", () => {
  it("cannot archive while an edition is published and upcoming or in progress", async () => {
    for (const timeStatus of ["upcoming", "in-progress"]) {
      const course = await createCourseDoc(db);
      await scheduleEdition(await createEdition(db, course), timeStatus);
      await expect(
        setCourseStatus(actorOf(admin), course._id.toString(), { status: "archived" }),
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("No se puede archivar") });
      expect((await db.collection("courses").findOne({ _id: course._id })).status).toBe("active");
    }
  });

  it("archives with finished or draft editions only, and reactivates", async () => {
    const course = await createCourseDoc(db);
    await scheduleEdition(await createEdition(db, course), "completed");
    // A draft with future classes does not block archiving
    await scheduleEdition(await createEdition(db, course, { status: "draft" }), "upcoming");
    const id = course._id.toString();

    expect(await setCourseStatus(actorOf(admin), id, { status: "archived" })).toMatchObject({ status: "archived" });
    expect((await db.collection("courses").findOne({ _id: course._id })).status).toBe("archived");
    await setCourseStatus(actorOf(admin), id, { status: "active" });
    expect((await db.collection("courses").findOne({ _id: course._id })).status).toBe("active");
  });

  it("validates the status and is admin only", async () => {
    const course = await createCourseDoc(db);
    const id = course._id.toString();
    await expect(setCourseStatus(actorOf(admin), id, { status: "published" })).rejects.toMatchObject({
      status: 400,
      message: "Estado inválido",
    });
    await expect(
      setCourseStatus(actorOf(admin), new ObjectId().toString(), { status: "archived" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(setCourseStatus(null, id, { status: "archived" })).rejects.toMatchObject({ status: 401 });
    await expect(setCourseStatus(actorOf(student), id, { status: "archived" })).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("deleteCourse", () => {
  it("refuses courses with enrollments in any edition and leaves everything intact", async () => {
    const course = await createCourseDoc(db);
    await createEdition(db, course);
    const second = await createEdition(db, course, { status: "draft" });
    await createClass(db, { editionId: second._id, status: "enrolled" });
    await enrollInEditionDoc(db, student, second, "pending");

    await expect(deleteCourse(actorOf(admin), course._id.toString())).rejects.toMatchObject({
      status: 400,
      message: "No se puede eliminar un curso que tiene inscriptos. Archivalo en su lugar.",
    });
    expect(await db.collection("courses").countDocuments({ _id: course._id })).toBe(1);
    expect(await db.collection("courseEditions").countDocuments({ courseId: course._id })).toBe(2);
    expect(await db.collection("classes").countDocuments({ editionId: second._id })).toBe(1);
  });

  it("deletes the course, its editions, classes and reviews; Calendar events go after the commit", async () => {
    const course = await createCourseDoc(db);
    const first = await createEdition(db, course);
    const second = await createEdition(db, course, { status: "draft" });
    const withEvent = await createClass(db, {
      editionId: first._id,
      status: "enrolled",
      googleEventId: "evt-1",
      createdBy: admin._id,
    });
    await createClass(db, { editionId: second._id, status: "enrolled" });
    await review(student, course, first, 5);

    const other = await createCourseDoc(db, { title: "Otro" });
    const otherEdition = await createEdition(db, other);
    await createClass(db, { editionId: otherEdition._id, status: "enrolled" });
    const standalone = await createClass(db);

    await deleteCourse(actorOf(admin), course._id.toString());
    expect(await db.collection("courses").countDocuments({ _id: course._id })).toBe(0);
    expect(await db.collection("courseEditions").countDocuments({ courseId: course._id })).toBe(0);
    expect(await db.collection("classes").countDocuments({ editionId: { $in: [first._id, second._id] } })).toBe(0);
    expect(await db.collection("reviews").countDocuments({ courseId: course._id })).toBe(0);
    // Other courses and standalone classes are untouched
    expect(await db.collection("courseEditions").countDocuments({ courseId: other._id })).toBe(1);
    expect(await db.collection("classes").countDocuments({ _id: standalone._id })).toBe(1);
    expect(await db.collection("classes").countDocuments({ editionId: otherEdition._id })).toBe(1);

    const calls = vi.mocked(deleteClassCalendarEvent).mock.calls.map(([cls]) => cls);
    expect(calls).toHaveLength(2);
    const evented = calls.find((cls) => cls._id.equals(withEvent._id));
    expect(evented).toMatchObject({ googleEventId: "evt-1" });
    expect(evented.createdBy.equals(admin._id)).toBe(true);
  });

  it("a failure halfway leaves the course untouched and no Calendar event is deleted", async () => {
    const course = await createCourseDoc(db);
    const edition = await createEdition(db, course, { status: "draft" });
    await createClass(db, { editionId: edition._id, status: "enrolled", googleEventId: "evt" });
    failOn("deleteMany", "courseEditions");

    await expect(deleteCourse(actorOf(admin), course._id.toString())).rejects.toThrow("simulated");
    expect(await db.collection("courses").countDocuments({ _id: course._id })).toBe(1);
    expect(await db.collection("classes").countDocuments({ editionId: edition._id })).toBe(1);
    expect(deleteClassCalendarEvent).not.toHaveBeenCalled();
  });

  it("is admin only and 404s on unknown courses", async () => {
    const course = await createCourseDoc(db);
    await expect(deleteCourse(null, course._id.toString())).rejects.toMatchObject({ status: 401 });
    await expect(deleteCourse(actorOf(student), course._id.toString())).rejects.toMatchObject({ status: 403 });
    await expect(deleteCourse(actorOf(admin), new ObjectId().toString())).rejects.toMatchObject({ status: 404 });
  });
});

describe("course metrics", () => {
  let course, first, second, third, users;

  beforeEach(async () => {
    users = await Promise.all([1, 2, 3, 4, 5, 6].map((n) => createUser(db, { first_name: `Alumno ${n}` })));
    course = await createCourseDoc(db, { title: "Meta Ads" });
    first = await createEdition(db, course, { price: 1000, createdAt: daysFromNow(-60) });
    second = await createEdition(db, course, { price: 1500, createdAt: daysFromNow(-10) });
    third = await createEdition(db, course, { price: 2000, status: "draft" });
    await scheduleEdition(first, "completed");
    await scheduleEdition(second, "in-progress");
    await createClass(db, { editionId: second._id, status: "enrolled", start_date: daysFromNow(8) });
    await createClass(db, { editionId: third._id, status: "enrolled", start_date: null });

    await enrollInEditionDoc(db, users[0], first, "paid");
    await enrollInEditionDoc(db, users[1], first, "paid");
    await enrollInEditionDoc(db, users[2], first, "pending");
    await enrollInEditionDoc(db, users[3], second, "paid");
    await review(users[0], course, first, 5);
    await review(users[1], course, first, 4);
    await review(users[3], course, second, 3);
  });

  it("getAdminCourse: per-edition counts and ratings, course-wide metrics", async () => {
    const result = await getAdminCourse(actorOf(admin), course._id.toString());
    expect(result).toMatchObject({ title: "Meta Ads", status: "active" });
    expect(
      result.editions.map((e) => [e.adminNumber, e.timeStatus, e.amount_of_classes, e.enrollmentCount, e.paidCount, e.avgRating, e.reviewCount]),
    ).toEqual([
      [1, "completed", 2, 3, 2, 4.5, 2],
      [2, "in-progress", 3, 1, 1, 3, 1],
      [3, null, 1, 0, 0, null, 0],
    ]);
    expect(result.metrics).toEqual({
      editionCount: 3,
      timesTaught: 2,
      enrolledCount: 4,
      paidCount: 3,
      // Per edition: 1000 × 2 + 1500 × 1 (never course price × total)
      estimatedRevenue: 3500,
      avgRating: 4,
      reviewCount: 3,
      // Classes of the current edition (in progress), not a sum over editions
      classesPerEdition: 3,
    });
  });

  it("classes per edition fall back to the chronologically last edition when none is current", async () => {
    const other = await createCourseDoc(db, { title: "Sin actual" });
    const done = await createEdition(db, other);
    await scheduleEdition(done, "completed");
    const draft = await createEdition(db, other, { status: "draft" });
    for (let i = 0; i < 4; i++) await createClass(db, { editionId: draft._id, status: "enrolled", start_date: null });

    const result = await getAdminCourse(actorOf(admin), other._id.toString());
    expect(result.metrics).toMatchObject({ timesTaught: 1, classesPerEdition: 4, avgRating: null, reviewCount: 0 });
  });

  it("listAdminCourses: one card per course with current/latest edition and metrics, sorted", async () => {
    const old = await createCourseDoc(db, { title: "Viejo" });
    await scheduleEdition(await createEdition(db, old, { createdAt: daysFromNow(-400) }), "completed");
    const fresh = await createCourseDoc(db, { title: "Nuevo", status: "archived" });
    await createEdition(db, fresh, { status: "draft", createdAt: daysFromNow(-1) });
    const upcoming = await createCourseDoc(db, { title: "Próximo" });
    await scheduleEdition(await createEdition(db, upcoming), "upcoming");

    const cards = await listAdminCourses(actorOf(admin));
    // Current edition first (by start), then by latest date (newest first)
    expect(cards.map((c) => c.title)).toEqual(["Meta Ads", "Próximo", "Nuevo", "Viejo"]);

    const meta = cards[0];
    expect(meta).toMatchObject({
      status: "active",
      editionCount: 3,
      timesTaught: 2,
      paidCount: 3,
      avgRating: 4,
      reviewCount: 3,
      classesPerEdition: 3,
    });
    expect(meta.current).toMatchObject({ adminNumber: 2, timeStatus: "in-progress", enrollmentCount: 1, paidCount: 1 });
    expect(meta.latest).toMatchObject({ adminNumber: 3, label: "Sin fecha", status: "draft", start_date: null });
    expect(meta.lastDate).toBeTruthy();
    expect(cards[2]).toMatchObject({ status: "archived", current: null, timesTaught: 0, avgRating: null });
    expect(cards[2].lastDate).toBeTruthy();
  });

  it("courses without a current edition are ordered by their latest date, ties by title", async () => {
    await db.collection("courses").deleteMany({});
    const date = new Date("2025-03-01T12:00:00Z");
    for (const title of ["Zeta", "Alfa", "Beta"]) {
      const c = await createCourseDoc(db, { title });
      await createEdition(db, c, { status: "draft", createdAt: title === "Beta" ? new Date("2025-05-01T12:00:00Z") : date });
    }
    const cards = await listAdminCourses(actorOf(admin));
    expect(cards.map((c) => c.title)).toEqual(["Beta", "Alfa", "Zeta"]);
  });

  it("admin only; unknown or invalid ids", async () => {
    await expect(listAdminCourses(null)).rejects.toMatchObject({ status: 401 });
    await expect(listAdminCourses(actorOf(student))).rejects.toMatchObject({ status: 403 });
    await expect(getAdminCourse(actorOf(student), course._id.toString())).rejects.toMatchObject({ status: 403 });
    await expect(getAdminCourse(actorOf(admin), new ObjectId().toString())).rejects.toMatchObject({ status: 404 });
    await expect(getAdminCourse(actorOf(admin), "nope")).rejects.toMatchObject({ status: 400 });
  });
});

describe("getCourseDetail (public)", () => {
  it("shows an active course with its open edition and course-wide ratings", async () => {
    const course = await createCourseDoc(db, { createdBy: admin._id });
    const done = await createEdition(db, course);
    await scheduleEdition(done, "completed");
    const next = await createEdition(db, course, { price: 2500, max_participants: 20 });
    await scheduleEdition(next, "upcoming");
    await review(await createUser(db), course, done, 4);
    await enrollInEditionDoc(db, student, next, "pending");

    const anonymous = await getCourseDetail(null, course._id.toString());
    expect(anonymous).toMatchObject({ avgRating: 4, reviewCount: 1 });
    expect(anonymous).not.toHaveProperty("createdBy");
    expect(anonymous.openEdition).toMatchObject({
      label: expect.stringMatching(/^[A-ZÁÉÍÓÚ][a-záéíóú]+ \d{4}( \(2\))?$/),
      price: 2500,
      max_participants: 20,
      amount_of_classes: 2,
      enrollmentCount: 1,
      timeStatus: "upcoming",
    });
    expect(anonymous.openEdition._id.equals(next._id)).toBe(true);
    expect(anonymous.openEdition).not.toHaveProperty("userPaymentStatus");
    expect(anonymous.openEdition).not.toHaveProperty("paidCount");
    expect(anonymous.openEdition).not.toHaveProperty("number");
    expect(anonymous.openEdition).not.toHaveProperty("adminNumber");

    const mine = await getCourseDetail(actorOf(student), course._id.toString());
    expect(mine.openEdition.userPaymentStatus).toBe("pending");
  });

  it("hides archived courses and courses without published editions, except to admins and enrollees", async () => {
    const archived = await createCourseDoc(db, { status: "archived" });
    const finished = await createEdition(db, archived);
    await scheduleEdition(finished, "completed");
    const drafts = await createCourseDoc(db);
    await createEdition(db, drafts, { status: "draft" });

    for (const course of [archived, drafts]) {
      await expect(getCourseDetail(null, course._id.toString())).rejects.toMatchObject({ status: 404 });
      await expect(getCourseDetail(actorOf(student), course._id.toString())).rejects.toMatchObject({ status: 404 });
      const forAdmin = await getCourseDetail(actorOf(admin), course._id.toString());
      expect(forAdmin.openEdition).toBeNull();
    }

    await enrollInEditionDoc(db, student, finished, "paid");
    const enrolled = await getCourseDetail(actorOf(student), archived._id.toString());
    expect(enrolled).toMatchObject({ status: "archived", openEdition: null });
    await expect(getCourseDetail(null, new ObjectId().toString())).rejects.toMatchObject({ status: 404 });
  });
});
