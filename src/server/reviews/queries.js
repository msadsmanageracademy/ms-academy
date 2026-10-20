// Two decimals so the stars and texts can show e.g. 4.75
const roundRating = (avg) => (avg ? Math.round(avg * 100) / 100 : null);

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

// Map key → { avgRating, reviewCount } of the reviews whose `field` is in `ids`
async function groupedStats(db, field, ids) {
  if (ids.length === 0) return {};
  const rows = await db
    .collection("reviews")
    .aggregate([
      { $match: { [field]: { $in: ids } } },
      { $group: { _id: `$${field}`, avgRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
    ])
    .toArray();
  return Object.fromEntries(
    rows.map(({ _id, avgRating, reviewCount }) => [_id.toString(), { avgRating: roundRating(avgRating), reviewCount }]),
  );
}

/**
 * Review stats of each course: every edition counts (reviews keep the denormalized
 * `courseId` of their edition). Map courseId → { avgRating, reviewCount }; courses
 * without reviews are absent.
 */
export async function getCourseReviewStats(db, courseIds) {
  return groupedStats(db, "courseId", courseIds);
}

/**
 * Review stats of each edition on its own. Map editionId → { avgRating, reviewCount };
 * editions without reviews are absent.
 */
export async function getEditionReviewStats(db, editionIds) {
  return groupedStats(db, "editionId", editionIds);
}
