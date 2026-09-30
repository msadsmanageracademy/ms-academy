// Reviews of classes and courses: one per user and class/course (upsert).
import { ReviewFormSchema } from "@/utils/validation";
import { getDb } from "@/lib/db";
import { isClassParticipant } from "@/server/classes/audience";
import { HttpError, assertUser, isAdminActor, parseOrThrow, toObjectId } from "@/server/errors";
import { classObjectId, courseObjectId } from "@/server/ids";

const newestFirst = { sort: { createdAt: -1 } };

async function upsertReview(db, actor, target, input) {
  const { rating, comment } = parseOrThrow(ReviewFormSchema, input, { useIssueMessage: true });
  const userId = toObjectId(actor.id);
  const now = new Date();
  return db.collection("reviews").findOneAndUpdate(
    { ...target, userId },
    {
      $set: {
        ...target,
        userId,
        rating,
        comment: comment ?? "",
        firstName: actor.name ?? actor.email,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );
}

/** Reviews of a class, newest first (public). */
export async function listClassReviews(id) {
  const classId = classObjectId(id);
  const db = await getDb();
  return db.collection("reviews").find({ classId }, newestFirst).toArray();
}

/**
 * Creates or updates the user's review of a class. Only participants may review,
 * once the class has ended (course classes: enrollees who paid). Admins can always.
 */
export async function submitClassReview(actor, id, input) {
  assertUser(actor);
  const classId = classObjectId(id);
  const db = await getDb();

  if (!isAdminActor(actor)) {
    const classItem = await db.collection("classes").findOne(
      { _id: classId },
      { projection: { participants: 1, courseId: 1, start_date: 1, duration: 1 } },
    );
    if (!classItem) throw new HttpError(404, "Clase no encontrada");
    if (!(await isClassParticipant(db, classItem, actor.id, { paidOnly: true }))) {
      throw new HttpError(403, "No sos participante de esta clase");
    }
    const endsAt = new Date(classItem.start_date).getTime() + classItem.duration * 60000;
    if (!classItem.start_date || Date.now() < endsAt) {
      throw new HttpError(403, "Solo podés dejar una reseña una vez que la clase haya finalizado");
    }
  }
  return upsertReview(db, actor, { classId }, input);
}

/**
 * Reviews of a course, newest first (public). With `series`, those of every
 * iteration sharing its courseSeriesId.
 */
export async function listCourseReviews(id, { series = false } = {}) {
  const courseId = courseObjectId(id);
  const db = await getDb();
  let courseIds = [courseId];
  if (series) {
    const course = await db
      .collection("courses")
      .findOne({ _id: courseId }, { projection: { courseSeriesId: 1 } });
    // Courses created before series existed are their own series
    const seriesId = course?.courseSeriesId ?? courseId;
    const siblings = await db
      .collection("courses")
      .find({ courseSeriesId: seriesId }, { projection: { _id: 1 } })
      .toArray();
    const unique = new Map([courseId, ...siblings.map((c) => c._id)].map((oid) => [oid.toString(), oid]));
    courseIds = [...unique.values()];
  }
  return db
    .collection("reviews")
    .find({ courseId: { $in: courseIds } }, newestFirst)
    .toArray();
}

/** Creates or updates the user's review of a course. Only enrollees who paid (or admins). */
export async function submitCourseReview(actor, id, input) {
  assertUser(actor);
  const courseId = courseObjectId(id);
  const db = await getDb();
  if (!isAdminActor(actor)) {
    const enrollment = await db
      .collection("courseEnrollments")
      .findOne({ userId: toObjectId(actor.id), courseId, paymentStatus: "paid" }, { projection: { _id: 1 } });
    if (!enrollment) {
      throw new HttpError(403, "Solo inscriptos con pago confirmado pueden dejar una reseña");
    }
  }
  return upsertReview(db, actor, { courseId }, input);
}

/** Every review left by the current user (to mark what they already reviewed). */
export async function listMyReviews(actor) {
  assertUser(actor);
  const db = await getDb();
  return db
    .collection("reviews")
    .find(
      { userId: toObjectId(actor.id) },
      { projection: { courseId: 1, classId: 1, rating: 1, comment: 1, updatedAt: 1 } },
    )
    .toArray();
}
