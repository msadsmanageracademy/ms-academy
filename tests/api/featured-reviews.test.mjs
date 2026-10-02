// 3.5: home testimonials come from real reviews; public reviews never expose emails.
import { beforeEach, describe, expect, it } from "vitest";
import { listFeaturedReviews } from "@/server/reviews/featured";
import { listCourseReviews, publicAuthorName } from "@/server/reviews/service";
import { createAdmin, createCourse, createUser, resetDb } from "../helpers.mjs";

let db;

beforeEach(async () => {
  db = await resetDb();
});

const review = (user, course, overrides = {}) =>
  db.collection("reviews").insertOne({
    userId: user._id,
    courseId: course._id,
    rating: 5,
    comment: "Excelente curso",
    firstName: user.first_name,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

describe("listFeaturedReviews", () => {
  it("only 4+ star student reviews with a comment, best first, with the course title", async () => {
    const course = await createCourse(db, { title: "Meta Ads" });
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
    expect(featured[0]).toMatchObject({ aboutTitle: "Meta Ads", rating: 5 });
    expect(featured[0]).not.toHaveProperty("userId");
  });

  it("respects the limit", async () => {
    const course = await createCourse(db);
    for (let i = 0; i < 5; i++) await review(await createUser(db, { first_name: `U${i}` }), course);
    expect(await listFeaturedReviews({ limit: 3 })).toHaveLength(3);
  });
});

describe("public review author", () => {
  it("an email (stored by older reviews) is never shown", async () => {
    expect(publicAuthorName("ana@example.test")).toBe("Alumno/a");
    expect(publicAuthorName("")).toBe("Alumno/a");
    expect(publicAuthorName(" Ana ")).toBe("Ana");

    const course = await createCourse(db);
    const user = await createUser(db);
    await review(user, course, { firstName: "user@example.test" });
    const [listed] = await listCourseReviews(course._id.toString());
    expect(listed.firstName).toBe("Alumno/a");
    expect(listed).not.toHaveProperty("userId");
  });
});
