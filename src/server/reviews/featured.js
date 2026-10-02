import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { toPublicReview } from "./service";

/**
 * Best recent reviews written by students (4+ stars, with a comment), for the home
 * testimonials. Admin reviews are left out. Each one carries the title of the class
 * or course it is about.
 *
 * Never throws: the home must render even without a database (e.g. `next build` in CI);
 * it just shows no testimonials.
 */
export async function listFeaturedReviews({ limit = 3 } = {}) {
  try {
    const db = await getDb();
    const rows = await db
      .collection("reviews")
      .aggregate([
        { $match: { rating: { $gte: 4 }, comment: { $regex: /\S/ } } },
        { $sort: { rating: -1, updatedAt: -1 } },
        { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "author" } },
        { $match: { "author.role": { $ne: "admin" } } },
        { $limit: limit },
        { $lookup: { from: "courses", localField: "courseId", foreignField: "_id", as: "course" } },
        { $lookup: { from: "classes", localField: "classId", foreignField: "_id", as: "class" } },
        {
          $addFields: {
            aboutTitle: {
              $ifNull: [{ $first: "$course.title" }, { $first: "$class.title" }],
            },
          },
        },
      ])
      .toArray();
    return rows.map((row) => ({ ...toPublicReview(row), aboutTitle: row.aboutTitle ?? null }));
  } catch (error) {
    logger.warn("Could not load the featured reviews", error);
    return [];
  }
}
