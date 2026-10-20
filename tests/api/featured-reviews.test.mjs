// 3.5: home testimonials come from real reviews; public reviews never expose emails.
// course-editions: edition reviews carry the denormalized courseId of their edition.
import { beforeEach, describe, expect, it } from "vitest";
import { listFeaturedReviews } from "@/server/reviews/featured";
import { listCourseReviews, publicAuthorName } from "@/server/reviews/service";
import {
  createAdmin,
  createClass,
  createCourseDoc,
  createEdition,
  createUser,
  daysFromNow,
  resetDb,
} from "../helpers.mjs";

let db;

beforeEach(async () => {
  db = await resetDb();
});

// Course with one edition: reviews are stored against the edition and its course
async function courseWithEdition(overrides = {}) {
  const course = await createCourseDoc(db, overrides);
  const edition = await createEdition(db, course);
  return { ...course, edition };
}

const review = (user, course, overrides = {}) =>
  db.collection("reviews").insertOne({
    userId: user._id,
    courseId: course._id,
    editionId: course.edition?._id,
    rating: 5,
    comment: "Excelente curso",
    firstName: user.first_name,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

describe("listFeaturedReviews", () => {
  it("only 4+ star student reviews with a comment, best first, with the course title", async () => {
    const course = await courseWithEdition({ title: "Meta Ads" });
    const [ana, bruno, carla, dani] = await Promise.all(
      ["Ana", "Bruno", "Carla", "Dani"].map((first_name) => createUser(db, { first_name })),
    );
    const admin = await createAdmin(db, { first_name: "Admin" });
    await review(ana, course, { rating: 4 });
    await review(bruno, course, { rating: 5 });
    await review(carla, course, { rating: 3 }); // too low
    await review(dani, course, { comment: "   " }); // no comment
    await review(admin, course); // admin

    const featured = await listFeaturedReviews();
    expect(featured.map((r) => r.firstName)).toEqual(["Bruno", "Ana"]);
    expect(featured[0]).toMatchObject({ aboutTitle: "Meta Ads", rating: 5, editionId: course.edition._id });
    expect(featured[0]).not.toHaveProperty("userId");
  });

  it("class reviews carry the class title", async () => {
    const cls = await createClass(db, { title: "Clase suelta" });
    const user = await createUser(db, { first_name: "Eva" });
    await db.collection("reviews").insertOne({
      userId: user._id,
      classId: cls._id,
      rating: 5,
      comment: "Muy buena",
      firstName: "Eva",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const [featured] = await listFeaturedReviews();
    expect(featured).toMatchObject({ aboutTitle: "Clase suelta", classId: cls._id });
  });

  it("respects the limit", async () => {
    const course = await courseWithEdition();
    for (let i = 0; i < 5; i++) await review(await createUser(db, { first_name: `U${i}` }), course);
    expect(await listFeaturedReviews({ limit: 3 })).toHaveLength(3);
  });
});

describe("public review author", () => {
  it("an email (stored by older reviews) is never shown", async () => {
    expect(publicAuthorName("ana@example.test")).toBe("Alumno/a");
    expect(publicAuthorName("")).toBe("Alumno/a");
    expect(publicAuthorName(" Ana ")).toBe("Ana");

    const course = await courseWithEdition();
    const user = await createUser(db);
    await review(user, course, { firstName: "user@example.test" });
    const {
      items: [listed],
    } = await listCourseReviews(course._id.toString());
    expect(listed.firstName).toBe("Alumno/a");
    expect(listed).not.toHaveProperty("userId");
  });
});

describe("course rating across editions", () => {
  const upcomingEdition = async (course, overrides) => {
    const edition = await createEdition(db, course, overrides);
    await createClass(db, { editionId: edition._id, status: "enrolled", start_date: daysFromNow(10) });
    return edition;
  };

  it("listing and detail count the reviews of every edition of the course, with two decimals", async () => {
    const { getCourseDetail, listCourses } = await import("@/server/courses/service");
    const course = await createCourseDoc(db, { title: "Meta Ads" });
    const first = await createEdition(db, course);
    const second = await upcomingEdition(course);
    const other = await createCourseDoc(db, { title: "Other" });
    const otherEdition = await upcomingEdition(other);
    const users = await Promise.all([0, 1, 2, 3, 4].map((i) => createUser(db, { first_name: `U${i}` })));
    await review(users[0], course, { editionId: first._id, rating: 4 });
    for (const [i, rating] of [5, 5, 5, 4].entries()) {
      await review(users[i + 1], course, { editionId: second._id, rating });
    }
    await review(users[0], other, { editionId: otherEdition._id, rating: 3 });

    const expected = { avgRating: 4.6, reviewCount: 5 };
    const listed = await listCourses(null);
    expect(listed.find((c) => c._id.equals(course._id))).toMatchObject(expected);
    expect(listed.find((c) => c._id.equals(other._id))).toMatchObject({ avgRating: 3, reviewCount: 1 });
    expect(await getCourseDetail(null, course._id.toString())).toMatchObject(expected);

    // Two decimals: 4.75 from the second edition alone
    await db.collection("reviews").deleteMany({ editionId: first._id });
    expect(await getCourseDetail(null, course._id.toString())).toMatchObject({ avgRating: 4.75, reviewCount: 4 });
  });
});
