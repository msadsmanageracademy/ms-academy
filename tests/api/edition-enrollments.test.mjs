// Edition enrollments (src/server/courses/enrollments.js): pre-enrollment, capacity under
// concurrency, payment, cancellation/removal, "Mis cursos", notifications and the
// dashboard summary.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmEditionPayment,
  enrollInEdition,
  listEditionEnrollments,
  listMyEditions,
  removeEditionEnrollment,
} from "@/server/courses/enrollments";
import { deleteCourse } from "@/server/courses/service";
import { getDashboardSummary } from "@/app/dashboard/_lib/summary";
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

vi.mock("@/server/classes/calendar", async (importOriginal) => ({
  ...(await importOriginal()),
  deleteClassCalendarEvent: vi.fn(async () => {}),
}));

let db, admin, ana, bruno, course;

const actorOf = (u) => ({ id: u._id.toString(), role: u.role, name: u.first_name, email: u.email });
const findEnrollments = (edition) => db.collection("courseEnrollments").find({ editionId: edition._id }).toArray();

/** Published edition with one future class (open to enrollment). */
async function openEdition(overrides = {}, start = daysFromNow(10)) {
  const edition = await createEdition(db, course, { createdBy: admin._id, ...overrides });
  await createClass(db, { editionId: edition._id, status: "enrolled", start_date: start });
  return edition;
}

beforeEach(async () => {
  db = await resetDb();
  admin = await createAdmin(db, { first_name: "Admin" });
  ana = await createUser(db, { first_name: "Ana", last_name: "Pérez" });
  bruno = await createUser(db, { first_name: "Bruno", last_name: "Gómez" });
  course = await createCourseDoc(db, { title: "Meta Ads", createdBy: admin._id });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("enrollInEdition", () => {
  it("creates a pending enrollment with editionId and notifies student and admin", async () => {
    await openEdition({}, new Date("2030-08-10T22:00:00Z"));
    const edition = await openEdition({}, new Date("2030-09-10T22:00:00Z"));
    expect(await enrollInEdition(actorOf(ana), edition._id.toString())).toEqual({ paymentStatus: "pending" });

    const [enrollment] = await findEnrollments(edition);
    expect(enrollment).toMatchObject({ paymentStatus: "pending" });
    expect(enrollment.userId.equals(ana._id)).toBe(true);
    expect(enrollment).not.toHaveProperty("courseId");

    const notifications = await db.collection("notifications").find().sort({ type: 1 }).toArray();
    expect(notifications.map((n) => [n.type, n.userId.toString()])).toEqual([
      ["course.participant_pre_joined", admin._id.toString()],
      ["course.pre_enrolled", ana._id.toString()],
    ]);
    for (const n of notifications) {
      expect(n).toMatchObject({ relatedType: "edition" });
      expect(Object.keys(n.metadata)).toEqual(["courseId"]);
      expect(n.relatedId.equals(edition._id)).toBe(true);
      expect(n.metadata.courseId.equals(course._id)).toBe(true);
      expect(n.message).toContain("Meta Ads · Septiembre 2030");
      expect(n.message).not.toMatch(/Edición \d/);
    }
  });

  it("rejects a duplicate enrollment, also when the requests are concurrent", async () => {
    const edition = await openEdition();
    const results = await Promise.allSettled([1, 2, 3].map(() => enrollInEdition(actorOf(ana), edition._id.toString())));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results.filter((x) => x.status === "rejected")) {
      expect(r.reason).toMatchObject({ status: 400, message: "Ya estás inscripto en este curso" });
    }
    await expect(enrollInEdition(actorOf(ana), edition._id.toString())).rejects.toMatchObject({
      status: 400,
      message: "Ya estás inscripto en este curso",
    });
    expect(await findEnrollments(edition)).toHaveLength(1);
  });

  it("never exceeds the capacity with concurrent enrollments", async () => {
    const edition = await openEdition({ max_participants: 3 });
    const students = [];
    for (let i = 0; i < 8; i++) students.push(await createUser(db));
    const results = await Promise.allSettled(students.map((s) => enrollInEdition(actorOf(s), edition._id.toString())));

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    for (const r of results.filter((x) => x.status === "rejected")) {
      expect(r.reason).toMatchObject({ status: 400, message: "El cupo máximo de este curso ha sido alcanzado" });
    }
    expect(await findEnrollments(edition)).toHaveLength(3);
  });

  it("rejects drafts, admins, anonymous users, invalid ids and missing editions", async () => {
    const draft = await openEdition({ status: "draft" });
    await expect(enrollInEdition(actorOf(ana), draft._id.toString())).rejects.toMatchObject({ status: 400 });
    const edition = await openEdition();
    await expect(enrollInEdition(actorOf(admin), edition._id.toString())).rejects.toMatchObject({ status: 403 });
    await expect(enrollInEdition(null, edition._id.toString())).rejects.toMatchObject({ status: 401 });
    await expect(enrollInEdition(actorOf(ana), "nope")).rejects.toMatchObject({
      status: 400,
      message: "ID de edición inválido",
    });
    await expect(enrollInEdition(actorOf(ana), new ObjectId().toString())).rejects.toMatchObject({ status: 404 });
    expect(await db.collection("courseEnrollments").countDocuments()).toBe(0);
  });

  it("rejects editions that already started or finished; only upcoming ones accept students", async () => {
    const started = await createEdition(db, course, { createdBy: admin._id });
    await createClass(db, { editionId: started._id, status: "enrolled", start_date: daysFromNow(-2) });
    await createClass(db, { editionId: started._id, status: "enrolled", start_date: daysFromNow(5) });
    const finished = await createEdition(db, course, { createdBy: admin._id });
    await createClass(db, { editionId: finished._id, status: "enrolled", start_date: daysFromNow(-10) });
    const noClasses = await createEdition(db, course, { createdBy: admin._id });

    await expect(enrollInEdition(actorOf(ana), started._id.toString())).rejects.toMatchObject({
      status: 400,
      message: "Esta edición ya comenzó: no se aceptan nuevas inscripciones",
    });
    for (const edition of [finished, noClasses]) {
      await expect(enrollInEdition(actorOf(ana), edition._id.toString())).rejects.toMatchObject({ status: 400 });
    }
    expect(await db.collection("courseEnrollments").countDocuments()).toBe(0);
  });

  it("the same student can enroll in two editions of the same course", async () => {
    const first = await openEdition();
    const second = await openEdition();
    await enrollInEdition(actorOf(ana), first._id.toString());
    await enrollInEdition(actorOf(ana), second._id.toString());
    expect(await db.collection("courseEnrollments").countDocuments({ userId: ana._id })).toBe(2);
  });

  it("an enrollment racing a course deletion never outlives its edition", async () => {
    for (let round = 0; round < 8; round++) {
      await Promise.all(["courses", "courseEditions", "classes", "courseEnrollments"].map((c) => db.collection(c).deleteMany({})));
      course = await createCourseDoc(db, { title: "Meta Ads", createdBy: admin._id });
      const edition = await openEdition();

      const [deleted, enrolled] = await Promise.allSettled([
        deleteCourse(actorOf(admin), course._id.toString()),
        enrollInEdition(actorOf(ana), edition._id.toString()),
      ]);
      const courseLeft = await db.collection("courses").countDocuments({ _id: course._id });
      const editionLeft = await db.collection("courseEditions").countDocuments({ _id: edition._id });
      const enrollments = await db.collection("courseEnrollments").countDocuments({ editionId: edition._id });

      if (deleted.status === "fulfilled") {
        // Deleted first: the enrollment failed and nothing is left behind
        expect(enrolled.status).toBe("rejected");
        expect([courseLeft, editionLeft, enrollments]).toEqual([0, 0, 0]);
      } else {
        // Enrolled first: the deletion is refused ("archivalo") and everything stays
        expect(deleted.reason).toMatchObject({ status: 400 });
        expect(enrolled.status).toBe("fulfilled");
        expect([courseLeft, editionLeft, enrollments]).toEqual([1, 1, 1]);
      }
    }
  });
});

describe("payments, cancellation and removal", () => {
  it("only admins confirm a pending payment (paidAt), once", async () => {
    const edition = await openEdition();
    await enrollInEditionDoc(db, ana, edition);
    const confirm = (actor) => confirmEditionPayment(actor, edition._id.toString(), ana._id.toString(), { paymentStatus: "paid" });

    await expect(confirm(actorOf(ana))).rejects.toMatchObject({ status: 403 });
    expect(await confirm(actorOf(admin))).toEqual({ paymentStatus: "paid" });
    const [enrollment] = await findEnrollments(edition);
    expect(enrollment.paymentStatus).toBe("paid");
    expect(enrollment.paidAt).toBeInstanceOf(Date);
    await expect(confirm(actorOf(admin))).rejects.toMatchObject({ status: 400, message: "El pago ya fue confirmado" });
    await expect(
      confirmEditionPayment(actorOf(admin), edition._id.toString(), bruno._id.toString(), { paymentStatus: "paid" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      confirmEditionPayment(actorOf(admin), edition._id.toString(), ana._id.toString(), { paymentStatus: "pending" }),
    ).rejects.toMatchObject({ status: 400 });

    const types = (await db.collection("notifications").find().toArray()).map((n) => n.type).sort();
    expect(types).toEqual(["course.payment_confirmed", "course.payment_received"]);
  });

  it("a student cancels an unpaid enrollment; an admin removes another one", async () => {
    const edition = await openEdition();
    await enrollInEditionDoc(db, ana, edition);
    await enrollInEditionDoc(db, bruno, edition);

    await removeEditionEnrollment(actorOf(ana), edition._id.toString(), ana._id.toString());
    await expect(
      removeEditionEnrollment(actorOf(ana), edition._id.toString(), ana._id.toString()),
    ).rejects.toMatchObject({ status: 400, message: "No estás inscripto en este curso" });
    // A student cannot remove someone else
    await expect(
      removeEditionEnrollment(actorOf(ana), edition._id.toString(), bruno._id.toString()),
    ).rejects.toMatchObject({ status: 403 });
    await removeEditionEnrollment(actorOf(admin), edition._id.toString(), bruno._id.toString());
    await expect(
      removeEditionEnrollment(actorOf(admin), edition._id.toString(), bruno._id.toString()),
    ).rejects.toMatchObject({ status: 404 });
    expect(await findEnrollments(edition)).toEqual([]);

    const types = (await db.collection("notifications").find().toArray()).map((n) => n.type).sort();
    expect(types).toEqual(["course.participant_left", "course.removed_by_admin", "course.unenrolled"]);
  });

  it("a paid enrollment can be neither cancelled nor removed (403)", async () => {
    const edition = await openEdition();
    await enrollInEditionDoc(db, ana, edition, "paid");
    await expect(
      removeEditionEnrollment(actorOf(ana), edition._id.toString(), ana._id.toString()),
    ).rejects.toMatchObject({ status: 403, message: "No podés cancelar una inscripción ya pagada" });
    await expect(
      removeEditionEnrollment(actorOf(admin), edition._id.toString(), ana._id.toString()),
    ).rejects.toMatchObject({ status: 403 });
    expect(await findEnrollments(edition)).toHaveLength(1);
  });

  it("only the enrollment of that edition changes", async () => {
    const first = await openEdition();
    const second = await openEdition();
    await enrollInEditionDoc(db, ana, first);
    await enrollInEditionDoc(db, ana, second);
    await confirmEditionPayment(actorOf(admin), second._id.toString(), ana._id.toString(), { paymentStatus: "paid" });
    await removeEditionEnrollment(actorOf(ana), first._id.toString(), ana._id.toString());
    expect(await findEnrollments(first)).toEqual([]);
    expect(await findEnrollments(second)).toMatchObject([{ paymentStatus: "paid" }]);
  });
});

describe("listings", () => {
  it("listEditionEnrollments: enrollees in order with contact and payment data, admin only", async () => {
    const edition = await openEdition();
    await enrollInEditionDoc(db, bruno, edition);
    await enrollInEditionDoc(db, ana, edition, "paid");
    const other = await openEdition();
    await enrollInEditionDoc(db, admin, other);

    const rows = await listEditionEnrollments(actorOf(admin), edition._id.toString());
    expect(rows.map((r) => [r.first_name, r.paymentStatus])).toEqual([
      ["Bruno", "pending"],
      ["Ana", "paid"],
    ]);
    expect(rows[1]).toMatchObject({ email: ana.email });
    expect(rows[1].paidAt).toBeInstanceOf(Date);
    expect(rows[0].paidAt).toBeNull();
    await expect(listEditionEnrollments(actorOf(ana), edition._id.toString())).rejects.toMatchObject({ status: 403 });
    await expect(listEditionEnrollments(actorOf(admin), new ObjectId().toString())).rejects.toMatchObject({ status: 404 });
  });

  it("listMyEditions: each enrolled edition with its course, date label, dates and payment", async () => {
    const other = await createCourseDoc(db, { title: "Google Ads", short_description: "Búsqueda" });
    const first = await openEdition();
    const second = await createEdition(db, other);
    const start = new Date("2030-09-10T22:00:00Z");
    await createClass(db, { editionId: second._id, status: "enrolled", start_date: start, duration: 60 });
    await openEdition(); // not enrolled
    await enrollInEditionDoc(db, ana, first, "paid");
    await enrollInEditionDoc(db, ana, second);
    await enrollInEditionDoc(db, bruno, second);

    const mine = await listMyEditions(actorOf(ana));
    expect(mine).toHaveLength(2);
    // Newest enrollment first
    expect(mine[0]).toMatchObject({
      courseTitle: "Google Ads",
      short_description: "Búsqueda",
      label: "Septiembre 2030",
      title: "Google Ads · Septiembre 2030",
      paymentStatus: "pending",
      amount_of_classes: 1,
      timeStatus: "upcoming",
      paidAt: null,
    });
    expect(mine[0]._id.equals(second._id)).toBe(true);
    expect(mine[0].courseId.equals(other._id)).toBe(true);
    expect(mine[0].start_date.getTime()).toBe(start.getTime());
    expect(mine[0].end_date.getTime()).toBe(start.getTime() + 60 * 60000);
    expect(mine[1]).toMatchObject({ courseTitle: "Meta Ads", paymentStatus: "paid" });
    expect(mine[1].title).toBe(`Meta Ads · ${mine[1].label}`);
    for (const row of mine) {
      expect(row).not.toHaveProperty("number");
      expect(row).not.toHaveProperty("adminNumber");
    }

    expect(await listMyEditions(actorOf(admin))).toEqual([]);
    await expect(listMyEditions(null)).rejects.toMatchObject({ status: 401 });
  });
});

describe("dashboard summary", () => {
  it("admin: courses, editions and the next published edition", async () => {
    await createCourseDoc(db, { status: "archived" });
    const draft = await createEdition(db, course, { status: "draft" });
    await createClass(db, { editionId: draft._id, status: "enrolled", start_date: daysFromNow(2) });
    const later = await openEdition(); // first class in 10 days
    const sooner = await createEdition(db, course);
    await createClass(db, { editionId: sooner._id, status: "enrolled", start_date: daysFromNow(5) });
    await createClass(db, { status: "draft" });

    const { stats, nextCourse } = await getDashboardSummary(actorOf(admin));
    expect(stats).toMatchObject({
      activeCourses: 1,
      archivedCourses: 1,
      draftEditions: 1,
      publishedEditions: 2,
      draftClasses: 1,
      enrolledClasses: 3,
    });
    expect(nextCourse).toMatchObject({ title: "Meta Ads", label: expect.any(String) });
    expect(nextCourse._id.equals(sooner._id)).toBe(true);
    expect(nextCourse._id.equals(later._id)).toBe(false);
  });

  it("student: pre-enrollments and paid enrollments per edition, and the next own edition", async () => {
    const first = await openEdition();
    const second = await openEdition();
    await enrollInEditionDoc(db, ana, first, "paid");
    await enrollInEditionDoc(db, ana, second);

    const { stats, nextCourse } = await getDashboardSummary(actorOf(ana));
    expect(stats).toEqual({ classes: 2, preEnrolledCourses: 1, enrolledCourses: 1 });
    expect(nextCourse).toMatchObject({ title: "Meta Ads", label: expect.any(String) });
    expect(nextCourse).not.toHaveProperty("adminNumber");
  });
});
