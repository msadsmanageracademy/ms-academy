// Review stats per edition and per course (every edition of the course counts).
import { beforeAll, describe, expect, it } from "vitest";
import { getCourseReviewStats, getEditionReviewStats, getReviewStats } from "@/server/reviews/queries";
import { ObjectId, resetDb } from "../helpers.mjs";
import { forAll, gen } from "../support/random.mjs";

let db;

beforeAll(async () => {
  db = await resetDb();
});

const round2 = (n) => Math.round(n * 100) / 100;

// Reference model: { avgRating, reviewCount } of a list of ratings
const statsOf = (ratings) => ({ avgRating: round2(ratings.reduce((a, b) => a + b, 0) / ratings.length), reviewCount: ratings.length });

describe("review stats", () => {
  it("Feature: course-editions, Property 16: Estadísticas por curso y por edición", async () => {
    const caseGen = gen.record({
      editionsPerCourse: gen.array(gen.int(1, 3), { min: 1, max: 3 }),
      reviews: gen.array(gen.record({ course: gen.int(0, 2), edition: gen.int(0, 2), rating: gen.int(1, 5) }), {
        max: 20,
      }),
    });

    await forAll(caseGen, async ({ editionsPerCourse, reviews }) => {
      await db.collection("reviews").deleteMany({});
      const courses = editionsPerCourse.map((count) => ({
        _id: new ObjectId(),
        editions: Array.from({ length: count }, () => new ObjectId()),
      }));

      const docs = reviews.map(({ course, edition, rating }) => {
        const c = courses[course % courses.length];
        return {
          userId: new ObjectId(),
          courseId: c._id,
          editionId: c.editions[edition % c.editions.length],
          rating,
          createdAt: new Date(),
        };
      });
      if (docs.length) await db.collection("reviews").insertMany(docs);

      const allEditions = courses.flatMap((c) => c.editions);
      const byEdition = await getEditionReviewStats(db, allEditions);
      const byCourse = await getCourseReviewStats(db, courses.map((c) => c._id));

      for (const editionId of allEditions) {
        const ratings = docs.filter((d) => d.editionId.equals(editionId)).map((d) => d.rating);
        if (ratings.length) expect(byEdition[editionId.toString()]).toEqual(statsOf(ratings));
        else expect(byEdition).not.toHaveProperty(editionId.toString());
      }
      for (const course of courses) {
        const ratings = docs.filter((d) => d.courseId.equals(course._id)).map((d) => d.rating);
        const single = await getReviewStats(db, { courseId: course._id });
        if (ratings.length) {
          expect(byCourse[course._id.toString()]).toEqual(statsOf(ratings));
          expect(single).toEqual(statsOf(ratings));
        } else {
          expect(byCourse).not.toHaveProperty(course._id.toString());
          expect(single).toEqual({ avgRating: null, reviewCount: 0 });
        }
      }
    });
    // 100 DB-backed runs: a few seconds alone, much slower while the whole suite runs in parallel
  }, 60_000);

  it("empty id lists answer an empty map", async () => {
    expect(await getEditionReviewStats(db, [])).toEqual({});
    expect(await getCourseReviewStats(db, [])).toEqual({});
  });
});
