// Public shape of a review: never the author's user id or email.
import { describe, expect, it } from "vitest";
import { publicAuthorName, toPublicReview } from "@/server/reviews/service";
import { forAll, gen, reviewGen } from "../support/random.mjs";

const ALLOWED_KEYS = new Set([
  "_id",
  "classId",
  "courseId",
  "editionId",
  "rating",
  "comment",
  "firstName",
  "createdAt",
  "updatedAt",
]);

// Stored review of a class or an edition; some documents also carry the author's email
const storedReviewGen = gen.map(
  gen.record({
    review: reviewGen(),
    target: gen.pick(["class", "edition"]),
    targetId: gen.objectId(),
    courseId: gen.objectId(),
    email: gen.oneOf(gen.constant(undefined), gen.constant("student@example.test")),
  }),
  ({ review, target, targetId, courseId, email }) => ({
    ...review,
    ...(target === "class" ? { classId: targetId } : { editionId: targetId, courseId }),
    ...(email ? { email } : {}),
    updatedAt: review.createdAt,
  }),
);

describe("toPublicReview", () => {
  it("Feature: course-editions, Property 18: Reseñas públicas sin datos personales", async () => {
    await forAll(storedReviewGen, (stored) => {
      const result = toPublicReview(stored);
      for (const key of Object.keys(result)) expect(ALLOWED_KEYS.has(key), key).toBe(true);
      expect(result).not.toHaveProperty("userId");
      expect(result).not.toHaveProperty("email");
      expect(JSON.stringify(result)).not.toContain(stored.userId.toString());
      expect(result.firstName).not.toContain("@");

      const name = typeof stored.firstName === "string" ? stored.firstName.trim() : "";
      expect(result.firstName).toBe(name && !name.includes("@") ? name : "Alumno/a");
      expect(result.firstName).toBe(publicAuthorName(stored.firstName));
      expect(result).toMatchObject({ _id: stored._id, rating: stored.rating, comment: stored.comment ?? "" });
      if (stored.editionId) expect(result).toMatchObject({ editionId: stored.editionId, courseId: stored.courseId });
      if (stored.classId) expect(result).toMatchObject({ classId: stored.classId });
    });
  });
});
