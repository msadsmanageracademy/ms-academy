import { ObjectId } from "mongodb";
import { HttpError } from "@/lib/api/guards";
import { prepareNotificationForDB } from "@/models/schemas";
import { getCourseTimeStatus } from "@/utils/classStatus";

// Single source of truth for linking/unlinking a class to/from a course.
// Used by PATCH /api/classes/[id] ({ courseId }) and POST /api/classes (courseId on create).

// Min start / max end of the classes of a course (optionally excluding one class)
async function getCourseDateRange(db, courseId, excludeClassId) {
  const match = { courseId };
  if (excludeClassId) match._id = { $ne: excludeClassId };
  const [stats] = await db
    .collection("classes")
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          start_date: { $min: "$start_date" },
          end_date: {
            $max: { $add: ["$start_date", { $multiply: ["$duration", 60000] }] },
          },
        },
      },
    ])
    .toArray();
  return stats ?? {};
}

/**
 * Links a class to a course:
 * - the class becomes "enrolled" with no own capacity
 * - every course enrollee (pending or paid) is added as participant. Pending users
 *   don't see links/materials anyway: the paywall is applied when reading.
 * - a published course that had already finished goes back to draft, since a new
 *   class invalidates its "completed" state
 */
export async function assignClassToCourse(db, classItem, courseIdRaw) {
  if (!ObjectId.isValid(courseIdRaw)) throw new HttpError(400, "courseId inválido");
  if (classItem.status === "published") {
    throw new HttpError(400, "No se puede vincular una clase publicada a un curso");
  }
  if (classItem.courseId) {
    throw new HttpError(
      400,
      "La clase ya pertenece a un curso. Desvinculala antes de asignarla a otro.",
    );
  }

  const courseId = new ObjectId(courseIdRaw);
  const course = await db
    .collection("courses")
    .findOne({ _id: courseId }, { projection: { title: 1, status: 1 } });
  if (!course) throw new HttpError(404, "Curso no encontrado");

  const enrollments = await db
    .collection("courseEnrollments")
    .find({ courseId }, { projection: { userId: 1 } })
    .toArray();
  const enrolleeIds = enrollments.map((e) => e.userId);

  await db.collection("classes").updateOne(
    { _id: classItem._id },
    {
      $set: {
        courseId,
        status: "enrolled",
        max_participants: null,
        updatedAt: new Date(),
      },
      ...(enrolleeIds.length > 0
        ? { $addToSet: { participants: { $each: enrolleeIds } } }
        : {}),
    },
  );

  if (course.status === "published") {
    const { start_date, end_date } = await getCourseDateRange(db, courseId, classItem._id);
    if (getCourseTimeStatus(start_date, end_date, "published") === "completed") {
      await db
        .collection("courses")
        .updateOne({ _id: courseId }, { $set: { status: "draft", updatedAt: new Date() } });
    }
  }

  const notifications = [];
  if (classItem.createdBy) {
    notifications.push(
      prepareNotificationForDB({
        userId: classItem.createdBy,
        type: "class.status_changed",
        title: "Clase asignada a curso",
        message: `La clase "${classItem.title}" fue asignada al curso "${course.title}"`,
        relatedId: classItem._id,
        relatedType: "class",
        actorId: classItem.createdBy,
      }),
    );
  }
  enrolleeIds.forEach((userId) =>
    notifications.push(
      prepareNotificationForDB({
        userId,
        type: "class.added_to_course",
        title: "Nueva clase en tu curso",
        message: `Se agregó la clase "${classItem.title}" al curso "${course.title}"`,
        relatedId: classItem._id,
        relatedType: "class",
        actorId: classItem.createdBy,
      }),
    ),
  );
  if (notifications.length > 0) {
    await db.collection("notifications").insertMany(notifications);
  }
}

/**
 * Unlinks a class from its course:
 * - the class goes back to draft and the course enrollees are removed from it
 * - a published course left without classes goes back to draft
 */
export async function unassignClassFromCourse(db, classItem) {
  if (!classItem.courseId) throw new HttpError(400, "La clase no pertenece a ningún curso");

  const courseId = classItem.courseId;
  const course = await db
    .collection("courses")
    .findOne({ _id: courseId }, { projection: { title: 1, status: 1 } });

  const enrollments = await db
    .collection("courseEnrollments")
    .find({ courseId }, { projection: { userId: 1 } })
    .toArray();
  const enrolleeIds = enrollments.map((e) => e.userId);

  await db.collection("classes").updateOne(
    { _id: classItem._id },
    {
      $set: { status: "draft", updatedAt: new Date() },
      $unset: { courseId: "" },
      ...(enrolleeIds.length > 0
        ? { $pull: { participants: { $in: enrolleeIds } } }
        : {}),
    },
  );

  if (course?.status === "published") {
    const remaining = await db.collection("classes").countDocuments({ courseId });
    if (remaining === 0) {
      await db
        .collection("courses")
        .updateOne({ _id: courseId }, { $set: { status: "draft", updatedAt: new Date() } });
    }
  }

  const courseTitle = course?.title || "";
  const notifications = [];
  if (classItem.createdBy) {
    notifications.push(
      prepareNotificationForDB({
        userId: classItem.createdBy,
        type: "class.status_changed",
        title: "Clase removida de curso",
        message: `La clase "${classItem.title}" fue eliminada del curso "${courseTitle}"`,
        relatedId: classItem._id,
        relatedType: "class",
        actorId: classItem.createdBy,
      }),
    );
  }
  enrolleeIds.forEach((userId) =>
    notifications.push(
      prepareNotificationForDB({
        userId,
        type: "class.removed_from_course",
        title: "Clase removida de tu curso",
        message: `La clase "${classItem.title}" fue eliminada del curso "${courseTitle}"`,
        relatedId: classItem._id,
        relatedType: "class",
        actorId: classItem.createdBy,
      }),
    ),
  );
  if (notifications.length > 0) {
    await db.collection("notifications").insertMany(notifications);
  }
}
