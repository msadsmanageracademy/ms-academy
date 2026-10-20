// Edition names by date and the admin-only edition number across the services:
// admins get "Septiembre 2030" / "Septiembre 2030 (2)" / "Sin fecha" with their computed
// number; public and student payloads and notifications only ever carry the date label.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminCourse, getCourseDetail, listCourses } from "@/server/courses/service";
import { deleteEdition, getEditionDetail, listAdminEditions } from "@/server/courses/editions";
import { confirmEditionPayment, enrollInEdition, listMyEditions } from "@/server/courses/enrollments";
import { linkClassToEdition, listClasses, unlinkClassFromEdition } from "@/server/classes/service";
import { listCourseReviews } from "@/server/reviews/service";
import { listNotifications } from "@/server/notifications/inbox";
import {
  createAdmin,
  createClass,
  createCourseDoc,
  createEdition,
  createUser,
  enrollInEditionDoc,
  resetDb,
} from "../helpers.mjs";

vi.mock("@/server/classes/calendar", async (importOriginal) => ({
  ...(await importOriginal()),
  deleteClassCalendarEvent: vi.fn(async () => {}),
  syncClassCalendarEvent: vi.fn(async () => {}),
}));

const sep = (day) => new Date(Date.UTC(2030, 8, day, 22));
// Admin-only fields and the "Edición N" wording must never reach public or student payloads
const ADMIN_FIELDS = /"(number|adminNumber|editionNumber|lastNumber|editionCount)":/;

let db, admin, student, course, september, septemberLater, draft;

const actorOf = (u) => ({ id: u._id.toString(), role: u.role, name: u.first_name, email: u.email });

beforeEach(async () => {
  db = await resetDb();
  admin = await createAdmin(db, { first_name: "Admin" });
  student = await createUser(db, { first_name: "Ana" });
  course = await createCourseDoc(db, {
    title: "Meta Ads",
    short_description: "Campañas que venden",
    full_description: "Todo sobre campañas",
    createdBy: admin._id,
  });
  // Created in this order; numbered by their first class, the undated draft last
  draft = await createEdition(db, course, { status: "draft", createdBy: admin._id });
  septemberLater = await createEdition(db, course, { createdBy: admin._id });
  september = await createEdition(db, course, { createdBy: admin._id });
  await createClass(db, { editionId: septemberLater._id, status: "enrolled", title: "Clase B", start_date: sep(20) });
  await createClass(db, { editionId: september._id, status: "enrolled", title: "Clase A", start_date: sep(3) });
  await createClass(db, { editionId: draft._id, status: "enrolled", title: "Clase C", start_date: null });
});

describe("admin payloads", () => {
  it("getAdminCourse names editions by month, with (2) for the same month and the undated draft last", async () => {
    const { editions } = await getAdminCourse(actorOf(admin), course._id.toString());
    expect(editions.map((e) => [e._id.toString(), e.label, e.adminNumber])).toEqual([
      [september._id.toString(), "Septiembre 2030", 1],
      [septemberLater._id.toString(), "Septiembre 2030 (2)", 2],
      [draft._id.toString(), "Sin fecha", 3],
    ]);
  });

  it("listAdminEditions carries the label, the admin number and the date-based title", async () => {
    const editions = await listAdminEditions(actorOf(admin));
    expect(editions.map((e) => [e.label, e.adminNumber, e.title])).toEqual([
      ["Septiembre 2030", 1, "Meta Ads · Septiembre 2030"],
      ["Septiembre 2030 (2)", 2, "Meta Ads · Septiembre 2030 (2)"],
      ["Sin fecha", 3, "Meta Ads · Sin fecha"],
    ]);
    for (const edition of editions) expect(edition).not.toHaveProperty("number");
  });
});

describe("public and student payloads", () => {
  it("carry the date label and never the edition number", async () => {
    await enrollInEditionDoc(db, student, september, "paid");
    await enrollInEditionDoc(db, student, septemberLater, "pending");
    await db.collection("reviews").insertOne({
      userId: student._id,
      courseId: course._id,
      editionId: september._id,
      rating: 5,
      comment: "Muy bueno",
      firstName: "Ana",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const me = actorOf(student);
    const id = course._id.toString();

    const catalog = await listCourses(null);
    expect(catalog[0].openEdition.label).toBe("Septiembre 2030");
    const detail = await getCourseDetail(null, id);
    expect(detail.openEdition.label).toBe("Septiembre 2030");
    const reviews = await listCourseReviews(id);
    expect(reviews.items[0].editionLabel).toBe("Septiembre 2030");
    const mine = await listMyEditions(me);
    expect(mine.map((e) => e.title).sort()).toEqual(["Meta Ads · Septiembre 2030", "Meta Ads · Septiembre 2030 (2)"]);
    const edition = await getEditionDetail(me, septemberLater._id.toString());
    expect(edition.label).toBe("Septiembre 2030 (2)");
    const classes = await listClasses(me, { myClasses: true });
    expect(classes.map((c) => c.editionLabel).sort()).toEqual(["Septiembre 2030", "Septiembre 2030 (2)"]);

    for (const payload of [catalog, detail, reviews, mine, edition, classes]) {
      const json = JSON.stringify(payload);
      expect(json).not.toMatch(ADMIN_FIELDS);
      expect(json).not.toContain("Edición ");
    }
  });
});

describe("notifications", () => {
  it("name the edition by date (enroll, payment, link, unlink, delete), never 'Edición N'", async () => {
    const me = actorOf(student);
    const asAdmin = actorOf(admin);
    await enrollInEdition(me, september._id.toString());
    await confirmEditionPayment(asAdmin, september._id.toString(), student._id.toString(), { paymentStatus: "paid" });
    const loose = await createClass(db, { status: "draft", title: "Clase extra", start_date: sep(25), createdBy: admin._id });
    await linkClassToEdition(asAdmin, loose._id.toString(), { editionId: september._id.toString() });
    await unlinkClassFromEdition(asAdmin, loose._id.toString());
    await enrollInEditionDoc(db, student, draft, "pending");
    await deleteEdition(asAdmin, draft._id.toString());

    const { items } = await listNotifications(me);
    expect(items.map((n) => n.type).sort()).toEqual([
      "class.added_to_course",
      "class.removed_from_course",
      "course.cancelled",
      "course.payment_confirmed",
      "course.pre_enrolled",
    ]);
    for (const notification of items) {
      expect(notification.message).not.toMatch(/Edición \d/);
      expect(notification.metadata ?? {}).not.toHaveProperty("number");
      const expected = notification.type === "course.cancelled" ? "Meta Ads · Sin fecha" : "Meta Ads · Septiembre 2030";
      expect(notification.message).toContain(expected);
    }
  });
});
