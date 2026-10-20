// Server side of /dashboard/courses/[courseId] (page.jsx): admin only, 404 for a
// malformed or missing course, and ?page=&edition= parsed into one page of reviews.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ObjectId,
  createAdmin,
  createCourseDoc,
  createEdition,
  createUser,
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
vi.mock("@/app/dashboard/courses/[courseId]/_components/CoursePageView", () => ({ default: () => null }));

const { default: AdminCoursePage } = await import("@/app/dashboard/courses/[courseId]/page.jsx");

let db, admin, course, other, editions;

const render = (courseId, query = {}) =>
  AdminCoursePage({ params: Promise.resolve({ courseId }), searchParams: Promise.resolve(query) });

beforeEach(async () => {
  db = await resetDb();
  vi.clearAllMocks();
  admin = await createAdmin(db);
  setSession(admin);
  course = await createCourseDoc(db, { title: "Meta Ads" });
  other = await createCourseDoc(db, { title: "Otro curso" });
  editions = [await createEdition(db, course), await createEdition(db, course, { status: "draft" })];
  await createEdition(db, other);

  // 12 reviews of the first edition and 3 of the second, one minute apart
  const reviews = [];
  for (let i = 0; i < 15; i += 1) {
    const student = await createUser(db, { email: `student-${i}@example.com` });
    reviews.push({
      userId: student._id,
      courseId: course._id,
      editionId: editions[i < 12 ? 0 : 1]._id,
      rating: 4,
      comment: `Reseña ${i}`,
      firstName: `Alumno ${i}`,
      createdAt: new Date(Date.UTC(2030, 0, 1, 0, i)),
      updatedAt: new Date(Date.UTC(2030, 0, 1, 0, i)),
    });
  }
  await db.collection("reviews").insertMany(reviews);
});

describe("AdminCoursePage (server)", () => {
  it("passes the course, its editions and metrics and the first page of reviews", async () => {
    const { props } = await render(course._id.toString());
    expect(props.course.title).toBe("Meta Ads");
    // Both undated: told apart by creation order
    expect(props.course.editions.map((e) => [e.adminNumber, e.label])).toEqual([
      [1, "Sin fecha"],
      [2, "Sin fecha (2)"],
    ]);
    expect(props.course.metrics).toMatchObject({ editionCount: 2, reviewCount: 15, avgRating: 4 });
    expect(props.reviewEditionId).toBeNull();
    expect(props.reviews).toMatchObject({ page: 1, totalPages: 2, total: 15 });
    expect(props.reviews.items).toHaveLength(10);
    expect(props.reviews.items[0].comment).toBe("Reseña 14");
    // Plain values only (Client Component props)
    expect(typeof props.course._id).toBe("string");
    expect(JSON.stringify(props.reviews)).not.toMatch(/userId|@example\.com/);
  });

  it("serves the requested page filtered by edition", async () => {
    const edition1 = editions[0]._id.toString();
    const { props } = await render(course._id.toString(), { page: "2", edition: edition1 });
    expect(props.reviewEditionId).toBe(edition1);
    expect(props.reviews).toMatchObject({ page: 2, totalPages: 2, total: 12 });
    expect(props.reviews.items.map((r) => r.comment)).toEqual(["Reseña 1", "Reseña 0"]);
    expect(props.reviews.items.every((r) => r.editionLabel === "Sin fecha")).toBe(true);
    expect(props.reviews.items[0]).not.toHaveProperty("editionNumber");
  });

  it.each([
    ["a page past the end", { page: "99" }, { page: 2, total: 15 }],
    ["a garbage page", { page: "abc" }, { page: 1, total: 15 }],
    ["a malformed edition", { edition: "nope" }, { page: 1, total: 15 }],
    ["several values", { page: ["2", "3"], edition: ["a", "b"] }, { page: 1, total: 15 }],
  ])("falls back to the nearest valid query for %s", async (_, query, expected) => {
    const { props } = await render(course._id.toString(), query);
    expect(props.reviewEditionId).toBeNull();
    expect(props.reviews).toMatchObject(expected);
  });

  it("drops an edition filter that belongs to another course (no 404)", async () => {
    const foreign = (await db.collection("courseEditions").findOne({ courseId: other._id }))._id.toString();
    const { props } = await render(course._id.toString(), { edition: foreign });
    expect(props.reviewEditionId).toBeNull();
    expect(props.reviews.total).toBe(15);
    expect(notFound).not.toHaveBeenCalled();
  });

  it.each([
    ["a malformed id", "not-an-id"],
    ["a missing course", new ObjectId().toString()],
  ])("shows the 404 page for %s", async (_, courseId) => {
    await expect(render(courseId)).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("sends students and visitors back to /dashboard/courses", async () => {
    setSession(await createUser(db, { email: "alumno@example.com" }));
    await expect(render(course._id.toString())).rejects.toThrow("REDIRECT /dashboard/courses");
    setSession(null);
    await expect(render(course._id.toString())).rejects.toThrow("REDIRECT /dashboard/courses");
  });
});
