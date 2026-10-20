// Who takes part in a class. Standalone classes store their `participants`;
// edition classes derive them from the edition enrollments (the single source).
import { toObjectId } from "@/server/errors";

const enrollmentFilter = (editionId, paidOnly) => ({
  editionId,
  ...(paidOnly ? { paymentStatus: "paid" } : {}),
});

/**
 * Ids (ObjectId) of the class participants. For edition classes: every enrollee of
 * that edition, or only those who paid with `paidOnly` (they are the ones with access).
 */
export async function getClassParticipantIds(db, classItem, { paidOnly = false } = {}) {
  if (!classItem.editionId) return classItem.participants ?? [];
  const enrollments = await db
    .collection("courseEnrollments")
    .find(enrollmentFilter(classItem.editionId, paidOnly), { projection: { userId: 1 } })
    .toArray();
  return enrollments.map((e) => e.userId);
}

/** Whether the user takes part in the class (see getClassParticipantIds). */
export async function isClassParticipant(db, classItem, userId, { paidOnly = false } = {}) {
  if (!userId) return false;
  if (!classItem.editionId) {
    return (classItem.participants ?? []).some((p) => p.toString() === userId.toString());
  }
  const enrollment = await db
    .collection("courseEnrollments")
    .findOne(
      { userId: toObjectId(userId.toString()), ...enrollmentFilter(classItem.editionId, paidOnly) },
      { projection: { _id: 1 } },
    );
  return !!enrollment;
}

/**
 * Adds `participantsCount` to each class: stored participants for standalone
 * classes, number of edition enrollments for edition classes.
 */
export async function withParticipantsCount(db, classes) {
  const editionIds = [...new Set(classes.filter((c) => c.editionId).map((c) => c.editionId.toString()))];
  let counts = {};
  if (editionIds.length > 0) {
    const rows = await db
      .collection("courseEnrollments")
      .aggregate([
        { $match: { editionId: { $in: editionIds.map((id) => toObjectId(id)) } } },
        { $group: { _id: "$editionId", count: { $sum: 1 } } },
      ])
      .toArray();
    counts = Object.fromEntries(rows.map((r) => [r._id.toString(), r.count]));
  }
  return classes.map((cls) => ({
    ...cls,
    participantsCount: cls.editionId
      ? counts[cls.editionId.toString()] ?? 0
      : cls.participants?.length ?? 0,
  }));
}
