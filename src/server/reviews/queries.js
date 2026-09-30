const roundRating = (avg) => (avg ? Math.round(avg * 10) / 10 : null);

/** { avgRating, reviewCount } of the reviews matching `match` (e.g. { classId }). */
export async function getReviewStats(db, match) {
  const [stats] = await db
    .collection("reviews")
    .aggregate([
      { $match: match },
      { $group: { _id: null, avgRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
    ])
    .toArray();
  return { avgRating: roundRating(stats?.avgRating), reviewCount: stats?.reviewCount ?? 0 };
}

/**
 * Review stats grouped by `field` ("classId" | "courseId") for a list of ids.
 * Returns a map id → { avgRating, reviewCount }.
 */
export async function getReviewStatsByEntity(db, field, ids) {
  if (ids.length === 0) return {};
  const rows = await db
    .collection("reviews")
    .aggregate([
      { $match: { [field]: { $in: ids } } },
      { $group: { _id: `$${field}`, avgRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
    ])
    .toArray();
  return Object.fromEntries(
    rows.map((r) => [
      r._id.toString(),
      { avgRating: roundRating(r.avgRating), reviewCount: r.reviewCount },
    ]),
  );
}
