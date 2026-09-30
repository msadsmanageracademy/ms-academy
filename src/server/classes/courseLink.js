import { getCourseTimeStatusFromClasses } from "@/server/courses/queries";
import { notifyMany } from "@/server/notifications";
import { HttpError, toObjectId } from "@/server/errors";

// Single source of truth for linking/unlinking a class to/from a course.
// Used by PUT/DELETE /api/classes/[id]/course and POST /api/classes (courseId on create).
// Both run inside a transaction: `tx` is the context given by withTransaction().

const enrolleeIdsOf = async ({ db, session }, courseId) =>
  (
    await db
      .collection("courseEnrollments")
      .find({ courseId }, { projection: { userId: 1 }, session })
      .toArray()
  ).map((e) => e.userId);

/**
 * Links a class to a course:
 * - the class becomes "enrolled" with no own capacity nor stored participants:
 *   its participants are the course enrollees (see ./audience.js)
 * - the enrollees are notified; pending ones don't see links/materials until they pay
 * - a published course that had already finished goes back to draft, since a new
 *   class invalidates its "completed" state
 */
export async function assignClassToCourse(tx, classItem, courseIdRaw) {
  const { db, session, afterCommit } = tx;
  const courseId = toObjectId(courseIdRaw, "courseId inválido");
  if (classItem.status === "published") {
    throw new HttpError(400, "No se puede vincular una clase publicada a un curso");
  }
  if (classItem.courseId) {
    throw new HttpError(
      400,
      "La clase ya pertenece a un curso. Desvinculala antes de asignarla a otro.",
    );
  }

  const course = await db
    .collection("courses")
    .findOne({ _id: courseId }, { projection: { title: 1, status: 1 }, session });
  if (!course) throw new HttpError(404, "Curso no encontrado");

  // The filter re-checks the class state, so a concurrent change aborts the link
  const result = await db.collection("classes").updateOne(
    { _id: classItem._id, courseId: { $exists: false }, status: { $ne: "published" } },
    {
      $set: { courseId, status: "enrolled", max_participants: null, updatedAt: new Date() },
      $unset: { participants: "" },
    },
    { session },
  );
  if (result.matchedCount === 0) {
    throw new HttpError(409, "La clase cambió mientras se vinculaba. Volvé a intentarlo.");
  }

  if (course.status === "published") {
    const timeStatus = await getCourseTimeStatusFromClasses(db, courseId, "published", {
      excludeClassId: classItem._id,
      session,
    });
    if (timeStatus === "completed") {
      await db
        .collection("courses")
        .updateOne({ _id: courseId }, { $set: { status: "draft", updatedAt: new Date() } }, { session });
    }
  }

  const enrolleeIds = await enrolleeIdsOf(tx, courseId);
  const common = {
    vars: { classTitle: classItem.title, courseTitle: course.title },
    relatedId: classItem._id,
    actorId: classItem.createdBy,
  };
  afterCommit(() =>
    notifyMany(db, [
      ["class.linked_to_course", { ...common, to: classItem.createdBy }],
      ["class.added_to_course", { ...common, to: enrolleeIds }],
    ]),
  );
}

/**
 * Unlinks a class from its course:
 * - the class goes back to a standalone draft with no participants (the course
 *   enrollees are notified that it left the course)
 * - a published course left without classes goes back to draft
 */
export async function unassignClassFromCourse(tx, classItem) {
  const { db, session, afterCommit } = tx;
  if (!classItem.courseId) throw new HttpError(400, "La clase no pertenece a ningún curso");

  const courseId = classItem.courseId;
  const course = await db
    .collection("courses")
    .findOne({ _id: courseId }, { projection: { title: 1, status: 1 }, session });

  const result = await db.collection("classes").updateOne(
    { _id: classItem._id, courseId },
    { $set: { status: "draft", participants: [], updatedAt: new Date() }, $unset: { courseId: "" } },
    { session },
  );
  if (result.matchedCount === 0) {
    throw new HttpError(409, "La clase cambió mientras se desvinculaba. Volvé a intentarlo.");
  }

  if (course?.status === "published") {
    const remaining = await db.collection("classes").countDocuments({ courseId }, { session });
    if (remaining === 0) {
      await db
        .collection("courses")
        .updateOne({ _id: courseId }, { $set: { status: "draft", updatedAt: new Date() } }, { session });
    }
  }

  const enrolleeIds = await enrolleeIdsOf(tx, courseId);
  const common = {
    vars: { classTitle: classItem.title, courseTitle: course?.title || "" },
    relatedId: classItem._id,
    actorId: classItem.createdBy,
  };
  afterCommit(() =>
    notifyMany(db, [
      ["class.unlinked_from_course", { ...common, to: classItem.createdBy }],
      ["class.removed_from_course", { ...common, to: enrolleeIds }],
    ]),
  );
}
