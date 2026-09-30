// Who takes part in a class. Standalone classes store their `participants`;
// course classes derive them from the course enrollments (the single source).
import { toObjectId } from "@/server/errors";

const enrollmentFilter = (courseId, paidOnly) => ({
  courseId,
  ...(paidOnly ? { paymentStatus: "paid" } : {}),
});

/**
 * Ids (ObjectId) of the class participants. For course classes: every enrollee,
 * or only those who paid with `paidOnly` (they are the ones with access).
 */
export async function getClassParticipantIds(db, classItem, { paidOnly = false } = {}) {
  if (!classItem.courseId) return classItem.participants ?? [];
  const enrollments = await db
    .collection("courseEnrollments")
    .find(enrollmentFilter(classItem.courseId, paidOnly), { projection: { userId: 1 } })
    .toArray();
  return enrollments.map((e) => e.userId);
}

/** Whether the user takes part in the class (see getClassParticipantIds). */
export async function isClassParticipant(db, classItem, userId, { paidOnly = false } = {}) {
  if (!userId) return false;
  if (!classItem.courseId) {
    return (classItem.participants ?? []).some((p) => p.toString() === userId.toString());
  }
  const enrollment = await db
    .collection("courseEnrollments")
    .findOne(
      { userId: toObjectId(userId.toString()), ...enrollmentFilter(classItem.courseId, paidOnly) },
      { projection: { _id: 1 } },
    );
  return !!enrollment;
}

/**
 * Adds `participantsCount` to each class: stored participants for standalone
 * classes, number of course enrollments for course classes.
 */
export async function withParticipantsCount(db, classes) {
  const courseIds = [...new Set(classes.filter((c) => c.courseId).map((c) => c.courseId.toString()))];
  let counts = {};
  if (courseIds.length > 0) {
    const rows = await db
      .collection("courseEnrollments")
      .aggregate([
        { $match: { courseId: { $in: courseIds.map((id) => toObjectId(id)) } } },
        { $group: { _id: "$courseId", count: { $sum: 1 } } },
      ])
      .toArray();
    counts = Object.fromEntries(rows.map((r) => [r._id.toString(), r.count]));
  }
  return classes.map((cls) => ({
    ...cls,
    participantsCount: cls.courseId
      ? counts[cls.courseId.toString()] ?? 0
      : cls.participants?.length ?? 0,
  }));
}
