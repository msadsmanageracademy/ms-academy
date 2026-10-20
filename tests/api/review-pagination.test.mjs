// Course review pages: newest first, optional edition filter, server-side skip/limit.
import { beforeAll, describe, expect, it } from "vitest";
import { listCourseReviews } from "@/server/reviews/service";
import { labelEditions } from "@/utils/courseEditions";
import { ObjectId, createCourseDoc, createEdition, resetDb } from "../helpers.mjs";
import { dateAround, forAll, gen } from "../support/random.mjs";

let db;

beforeAll(async () => {
  db = await resetDb();
});

// createdAt desc, then _id desc (same order as the service)
const hex = (id) => id.toString();
const newestFirst = (a, b) => b.createdAt - a.createdAt || (hex(a._id) < hex(b._id) ? 1 : hex(a._id) > hex(b._id) ? -1 : 0);

describe("listCourseReviews pagination", () => {
  it("Feature: course-editions, Property 17: Las páginas de reseñas particionan el conjunto filtrado", async () => {
    const now = new Date();
    const caseGen = gen.record({
      editionCount: gen.int(1, 3),
      // Reviews of the course: edition index and creation date (dates may repeat)
      reviews: gen.array(
        gen.record({
          edition: gen.int(0, 2),
          createdAt: gen.oneOf(dateAround(now, 30), gen.constant(new Date(now.getTime() - 86400000))),
          rating: gen.int(1, 5),
          firstName: gen.pick(["Ana", "", "ana@example.test"]),
        }),
        { max: 25 },
      ),
      noise: gen.int(0, 4), // reviews of another course
      filter: gen.oneOf(gen.constant(null), gen.int(0, 2)),
      pageSize: gen.int(1, 7),
    });

    await forAll(caseGen, async ({ editionCount, reviews, noise, filter, pageSize }) => {
      await Promise.all(["courses", "courseEditions", "reviews"].map((c) => db.collection(c).deleteMany({})));
      const course = await createCourseDoc(db);
      const editions = [];
      for (let i = 0; i < editionCount; i++) editions.push(await createEdition(db, course));
      const other = await createCourseDoc(db);
      const otherEdition = await createEdition(db, other);

      const docs = reviews.map((r) => {
        const edition = editions[r.edition % editionCount];
        return {
          _id: new ObjectId(),
          userId: new ObjectId(),
          courseId: course._id,
          editionId: edition._id,
          rating: r.rating,
          comment: "",
          firstName: r.firstName,
          createdAt: r.createdAt,
          updatedAt: r.createdAt,
        };
      });
      const noiseDocs = Array.from({ length: noise }, () => ({
        _id: new ObjectId(),
        userId: new ObjectId(),
        courseId: other._id,
        editionId: otherEdition._id,
        rating: 5,
        createdAt: now,
      }));
      if (docs.length + noiseDocs.length) await db.collection("reviews").insertMany([...docs, ...noiseDocs]);

      const filterEdition = filter === null ? null : editions[filter % editionCount];
      const expected = docs.filter((d) => !filterEdition || d.editionId.equals(filterEdition._id)).sort(newestFirst);
      const expectedPages = Math.max(1, Math.ceil(expected.length / pageSize));

      // The editions have no classes: "Sin fecha", "Sin fecha (2)"... by creation
      const labels = labelEditions(editions);
      const seen = [];
      for (let page = 1; page <= expectedPages; page++) {
        const result = await listCourseReviews(course._id.toString(), {
          editionId: filterEdition?._id.toString(),
          page,
          pageSize,
        });
        expect(result).toMatchObject({ page, totalPages: expectedPages, total: expected.length });
        expect(result.items.length).toBeLessThanOrEqual(pageSize);
        if (page < expectedPages) expect(result.items).toHaveLength(pageSize);
        for (const item of result.items) {
          expect(item.editionLabel).toBe(labels.get(item.editionId.toString()).label);
          expect(item).not.toHaveProperty("editionNumber");
          expect(item).not.toHaveProperty("userId");
          expect(item.firstName).not.toContain("@");
        }
        seen.push(...result.items.map((item) => item._id.toString()));
      }
      expect(seen).toEqual(expected.map((d) => d._id.toString()));
    });
    // 100 DB-backed runs: a few seconds alone, much slower while the whole suite runs in parallel
  }, 60_000);
});
