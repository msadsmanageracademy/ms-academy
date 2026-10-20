// Server side of /dashboard/courses/[courseId]/editions/[editionId] (page.jsx): admin only,
// 404 for malformed ids, a missing course or edition, or an edition of another course,
// and the edition with its classes, enrollees and one page (?page=) of its own reviews.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ObjectId,
  createAdmin,
  createClass,
  createCourseDoc,
  createEdition,
  createUser,
  enrollInEditionDoc,
  resetDb,
  setSession,
} from "../helpers.mjs";

const { notFound, redirect } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn((to) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));
vi.mock("next/navigation", () => ({ notFound, redirect }));
// The client view is not rendered here: the test inspects the props the page passes it
vi.mock("@/app/dashboard/courses/[courseId]/editions/[editionId]/_components/EditionDetailView", () => ({
  default: () => null,
}));

const { default: AdminEditionPage } = await import(
  "@/app/dashboard/courses/[courseId]/editions/[editionId]/page.jsx"
);

let db, course, editions, deletedId, ana, beto;

const render = (courseId, editionId, query = {}) =>
  AdminEditionPage({ params: Promise.resolve({ courseId, editionId }), searchParams: Promise.resolve(query) });
const idOf = (i) => editions[i]._id.toString();

beforeEach(async () => {
  db = await resetDb();
  vi.clearAllMocks();
  setSession(await createAdmin(db));
  course = await createCourseDoc(db, { title: "Meta Ads" });
  // A published edition (September 2030) and two drafts without dates; a fourth was deleted
  editions = [
    await createEdition(db, course, { price: 25000, max_participants: 10 }),
    await createEdition(db, course, { status: "draft", price: 30000 }),
    await createEdition(db, course, { status: "draft" }),
  ];
  const deleted = await createEdition(db, course, { status: "draft" });
  deletedId = deleted._id.toString();
  await db.collection("courseEditions").deleteOne({ _id: deleted._id });

  const sep = (day) => new Date(Date.UTC(2030, 8, day, 22));
  await createClass(db, { editionId: editions[0]._id, status: "enrolled", start_date: sep(17), title: "Segunda" });
  await createClass(db, { editionId: editions[0]._id, status: "enrolled", start_date: sep(10), title: "Primera" });
  await createClass(db, { editionId: editions[1]._id, status: "enrolled", start_date: null, title: "De otra edición" });

  ana = await createUser(db, { first_name: "Ana", email: "ana@example.com" });
  beto = await createUser(db, { first_name: "Beto", email: "beto@example.com" });
  await enrollInEditionDoc(db, ana, editions[0], "paid");
  await enrollInEditionDoc(db, beto, editions[0]);

  // 12 reviews of the first edition and one of the second, one minute apart
  const reviews = [];
  for (let i = 0; i < 13; i += 1) {
    const student = await createUser(db, { email: `student-${i}@example.com` });
    reviews.push({
      userId: student._id,
      courseId: course._id,
      editionId: editions[i < 12 ? 0 : 1]._id,
      rating: 5,
      comment: `Reseña ${i}`,
      firstName: `Alumno ${i}`,
      createdAt: new Date(Date.UTC(2030, 0, 1, 0, i)),
      updatedAt: new Date(Date.UTC(2030, 0, 1, 0, i)),
    });
  }
  await db.collection("reviews").insertMany(reviews);
});

describe("AdminEditionPage (server)", () => {
  it("passes the edition, its course, classes, enrollees and first page of reviews", async () => {
    const { props } = await render(course._id.toString(), idOf(0));
    const { edition } = props;
    expect(edition).toMatchObject({
      label: "Septiembre 2030",
      adminNumber: 1,
      editionCount: 3,
      price: 25000,
      max_participants: 10,
      status: "published",
    });
    expect(edition).not.toHaveProperty("number");
    expect(edition).not.toHaveProperty("lastNumber");
    expect(edition.course).toMatchObject({ title: "Meta Ads", status: "active" });
    expect(edition).toMatchObject({ enrollmentCount: 2, paidCount: 1, reviewCount: 12, avgRating: 5 });
    expect(edition._id).toBe(idOf(0));

    expect(props.classes.map((c) => c.title)).toEqual(["Primera", "Segunda"]);
    expect(props.enrollments.map((e) => [e.first_name, e.paymentStatus])).toEqual([
      ["Ana", "paid"],
      ["Beto", "pending"],
    ]);
    expect(props.reviews).toMatchObject({ page: 1, totalPages: 2, total: 12 });
    expect(props.reviews.items[0].comment).toBe("Reseña 11");
    expect(props.reviews.items.every((r) => r.editionLabel === "Septiembre 2030")).toBe(true);
    expect(JSON.stringify(props.reviews)).not.toMatch(/userId|@example\.com|editionNumber/);
    expect(props.initialEditMode).toBe(false);
  });

  it("numbers the undated drafts after the dated edition, by creation", async () => {
    const id = course._id.toString();
    expect((await render(id, idOf(1))).props.edition).toMatchObject({
      label: "Sin fecha",
      adminNumber: 2,
      editionCount: 3,
    });
    expect((await render(id, idOf(2))).props.edition).toMatchObject({
      label: "Sin fecha (2)",
      adminNumber: 3,
      editionCount: 3,
    });
  });

  it("serves the requested page of reviews and clamps garbage", async () => {
    const id = course._id.toString();
    expect((await render(id, idOf(0), { page: "2" })).props.reviews.items.map((r) => r.comment)).toEqual([
      "Reseña 1",
      "Reseña 0",
    ]);
    expect((await render(id, idOf(0), { page: "99" })).props.reviews.page).toBe(2);
    expect((await render(id, idOf(0), { page: "abc" })).props.reviews.page).toBe(1);
    // The edition is fixed by the URL: ?edition= is ignored
    expect((await render(id, idOf(0), { edition: idOf(1) })).props.reviews.total).toBe(12);
  });

  it("?edit=1 opens the form only for a draft", async () => {
    const id = course._id.toString();
    expect((await render(id, idOf(1), { edit: "1" })).props.initialEditMode).toBe(true);
    expect((await render(id, idOf(0), { edit: "1" })).props.initialEditMode).toBe(false);
    expect((await render(id, idOf(1), { edit: "yes" })).props.initialEditMode).toBe(false);
  });

  it.each([
    ["a malformed course id", () => ["not-an-id", idOf(0)]],
    ["a missing course", () => [new ObjectId().toString(), idOf(0)]],
    ["a malformed edition id", () => [course._id.toString(), "uno"]],
    ["an old number-style URL", () => [course._id.toString(), "1"]],
    ["an unknown edition id", () => [course._id.toString(), new ObjectId().toString()]],
    ["a deleted edition", () => [course._id.toString(), deletedId]],
  ])("shows the 404 page for %s", async (_, args) => {
    await expect(render(...args())).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("an edition of another course reached with this course's id is a 404", async () => {
    const other = await createCourseDoc(db, { title: "Otro" });
    const foreign = await createEdition(db, other);
    await expect(render(course._id.toString(), foreign._id.toString())).rejects.toThrow("NOT_FOUND");
    // It does open under its own course
    expect((await render(other._id.toString(), foreign._id.toString())).props.edition.course.title).toBe("Otro");
  });

  it("sends students and visitors back to /dashboard/courses", async () => {
    setSession(ana);
    await expect(render(course._id.toString(), idOf(0))).rejects.toThrow("REDIRECT /dashboard/courses");
    setSession(null);
    await expect(render(course._id.toString(), idOf(0))).rejects.toThrow("REDIRECT /dashboard/courses");
  });
});
