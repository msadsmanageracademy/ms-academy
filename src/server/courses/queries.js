import { getCourseTimeStatus } from "@/utils/classStatus";

// End of a class = start + duration (minutes)
const classEnd = (startField, durationField) => ({
  $add: [startField, { $multiply: [durationField, 60000] }],
});

/**
 * Aggregation that returns courses with their schedule computed from the linked
 * classes: amount_of_classes, start_date, end_date and total_duration.
 */
export function courseAggregationPipeline(match = {}, { sort } = {}) {
  return [
    { $match: match },
    {
      $lookup: {
        from: "classes",
        let: { courseId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$courseId", "$$courseId"] } } },
          { $sort: { start_date: 1 } },
        ],
        as: "assignedClasses",
      },
    },
    {
      $addFields: {
        amount_of_classes: { $size: "$assignedClasses" },
        start_date: { $min: "$assignedClasses.start_date" },
        end_date: {
          $max: {
            $map: {
              input: "$assignedClasses",
              as: "c",
              in: classEnd("$$c.start_date", "$$c.duration"),
            },
          },
        },
        total_duration: { $sum: "$assignedClasses.duration" },
      },
    },
    // `participants` is a legacy field (enrollments are the source); never returned
    { $unset: ["assignedClasses", "participants"] },
    ...(sort ? [{ $sort: sort }] : []),
  ];
}

/**
 * First start / last end among the classes of a course.
 * Returns {} when the course has no classes. Pass `session` inside a transaction.
 */
export async function getCourseDateRange(db, courseId, { excludeClassId, session } = {}) {
  const match = { courseId };
  if (excludeClassId) match._id = { $ne: excludeClassId };
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

/**
 * Time-based status of a course ("upcoming" | "in-progress" | "completed" | null),
 * computed from its classes.
 */
export async function getCourseTimeStatusFromClasses(
  db,
  courseId,
  editorialStatus,
  options,
) {
  const { start_date, end_date } = await getCourseDateRange(db, courseId, options);
  return getCourseTimeStatus(start_date, end_date, editorialStatus);
}
