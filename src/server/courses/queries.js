import { getCourseTimeStatus } from "@/utils/classStatus";
import { withEditionLabels, withTimeStatus } from "@/utils/courseEditions";

// End of a class = start + duration (minutes)
const classEnd = (startField, durationField) => ({
  $add: [startField, { $multiply: [durationField, 60000] }],
});

// Schedule fields computed from the classes in `classesField`
const scheduleFields = (classesField) => ({
  amount_of_classes: { $size: classesField },
  start_date: { $min: `${classesField}.start_date` },
  end_date: {
    $max: {
      $map: {
        input: classesField,
        as: "c",
        in: classEnd("$$c.start_date", "$$c.duration"),
      },
    },
  },
  total_duration: { $sum: `${classesField}.duration` },
});

async function dateRange(db, match, session) {
  const [range] = await db
    .collection("classes")
    .aggregate(
      [
        { $match: match },
        {
          $group: {
            _id: null,
            start_date: { $min: "$start_date" },
            end_date: { $max: classEnd("$start_date", "$duration") },
          },
        },
      ],
      { session },
    )
    .toArray();
  return range ? { start_date: range.start_date, end_date: range.end_date } : {};
}

// ---------- Editions ----------

/**
 * Aggregation that returns editions with their schedule computed from their classes:
 * amount_of_classes, start_date (earliest class), end_date (latest class end) and
 * total_duration. Classes without a date count but do not move the dates.
 */
export function editionAggregationPipeline(match = {}, { sort } = {}) {
  return [
    { $match: match },
    {
      $lookup: {
        from: "classes",
        localField: "_id",
        foreignField: "editionId",
        pipeline: [{ $project: { start_date: 1, duration: 1 } }],
        as: "editionClasses",
      },
    },
    { $addFields: scheduleFields("$editionClasses") },
    { $unset: "editionClasses" },
    ...(sort ? [{ $sort: sort }] : []),
  ];
}

/**
 * Every edition of a course, aggregated (schedule), with its time status, label and
 * adminNumber, in chronological order (see labelEditions). Pass `session` inside a transaction.
 */
export async function findCourseEditions(db, courseId, { session } = {}) {
  const editions = await db
    .collection("courseEditions")
    .aggregate(editionAggregationPipeline({ courseId }), { session })
    .toArray();
  return withEditionLabels(editions.map(withTimeStatus));
}

/**
 * Labels of every edition of the given courses, drafts included (for code that only has
 * one edition or a few loose ones at hand): Map<editionId string, { label, adminNumber }>.
 * For one course, `size` is its edition count. Pass `session` inside a transaction.
 */
export async function getEditionLabels(db, courseIds, { session } = {}) {
  if (courseIds.length === 0) return new Map();
  const editions = await db
    .collection("courseEditions")
    .aggregate(
      [
        { $match: { courseId: { $in: courseIds } } },
        {
          $lookup: {
            from: "classes",
            localField: "_id",
            foreignField: "editionId",
            pipeline: [{ $project: { start_date: 1 } }],
            as: "c",
          },
        },
        { $project: { courseId: 1, createdAt: 1, start_date: { $min: "$c.start_date" } } },
      ],
      { session },
    )
    .toArray();
  return new Map(
    withEditionLabels(editions).map((e) => [e._id.toString(), { label: e.label, adminNumber: e.adminNumber }]),
  );
}

/** Enrollment counts per edition: map editionId → { total, paid }. */
export async function getEnrollmentCounts(db, editionIds) {
  if (editionIds.length === 0) return {};
  const rows = await db
    .collection("courseEnrollments")
    .aggregate([
      { $match: { editionId: { $in: editionIds } } },
      {
        $group: {
          _id: "$editionId",
          total: { $sum: 1 },
          paid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
        },
      },
    ])
    .toArray();
  return Object.fromEntries(rows.map(({ _id, total, paid }) => [_id.toString(), { total, paid }]));
}

/**
 * Edition with its counts from the batch maps of getEnrollmentCounts (enrollmentCount,
 * paidCount) and, when given, getEditionReviewStats (avgRating, reviewCount).
 * Missing dates become null.
 */
export function withEditionCounts(edition, counts, reviewStats) {
  const key = edition._id.toString();
  const { total, paid } = counts[key] ?? { total: 0, paid: 0 };
  return {
    ...edition,
    start_date: edition.start_date ?? null,
    end_date: edition.end_date ?? null,
    enrollmentCount: total,
    paidCount: paid,
    ...(reviewStats ? (reviewStats[key] ?? { avgRating: null, reviewCount: 0 }) : {}),
  };
}

/**
 * First start / last end among the classes of an edition.
 * Returns {} when the edition has no classes. Pass `session` inside a transaction.
 */
export async function getEditionDateRange(db, editionId, { excludeClassId, session } = {}) {
  const match = { editionId };
  if (excludeClassId) match._id = { $ne: excludeClassId };
  return dateRange(db, match, session);
}

/**
 * Time status of an edition ("upcoming" | "in-progress" | "completed" | null),
 * computed from its classes.
 */
export async function getEditionTimeStatusFromClasses(db, editionId, editorialStatus, options) {
  const { start_date, end_date } = await getEditionDateRange(db, editionId, options);
  return getCourseTimeStatus(start_date, end_date, editorialStatus);
}
