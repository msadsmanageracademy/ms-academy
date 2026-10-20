// Reviews of classes and course editions: one per user and class/edition (upsert).
// Edition reviews keep the denormalized `courseId` of their edition, so course-wide
// listings and stats need no join.
import { ReviewFormSchema } from "@/utils/validation";
import { getDb } from "@/lib/db";
import { isClassParticipant } from "@/server/classes/audience";
import { reviewEligibilityError } from "@/server/courses/rules";
import { HttpError, assertUser, isAdminActor, parseOrThrow, toObjectId } from "@/server/errors";
import { classObjectId, courseObjectId, editionObjectId } from "@/server/ids";
import { editionAggregationPipeline, findCourseEditions } from "@/server/courses/queries";
import { pageInfo, withTimeStatus } from "@/utils/courseEditions";

const newestFirst = { sort: { createdAt: -1 } };

const ANONYMOUS_AUTHOR = "Alumno/a";

/**
 * Name shown on a public review. Older reviews stored the email when the user had
 * no first name: an email is never shown.
 */
export const publicAuthorName = (name) =>
  typeof name === "string" && name.trim() && !name.includes("@") ? name.trim() : ANONYMOUS_AUTHOR;

/** Public shape of a review: no user id, no email. */
export const toPublicReview = ({ _id, classId, courseId, editionId, rating, comment, firstName, createdAt, updatedAt }) => ({
  _id,
  ...(classId ? { classId } : {}),
  ...(courseId ? { courseId } : {}),
  ...(editionId ? { editionId } : {}),
  rating,
  comment: comment ?? "",
  firstName: publicAuthorName(firstName),
  createdAt,
  updatedAt,
});

/**
 * Creates or updates the actor's review of `target` ({ classId } or { editionId }).
 * `extra` fields are stored too (e.g. the edition's courseId).
 */
async function upsertReview(db, actor, target, input, extra = {}) {
  const { rating, comment } = parseOrThrow(ReviewFormSchema, input, { useIssueMessage: true });
  const userId = toObjectId(actor.id);
  const now = new Date();
  return db.collection("reviews").findOneAndUpdate(
    { ...target, userId },
    {
      $set: {
        ...target,
        ...extra,
        userId,
        rating,
        comment: comment ?? "",
        firstName: publicAuthorName(actor.name),
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
  const reviews = await db.collection("reviews").find({ classId }, newestFirst).toArray();
  return reviews.map(toPublicReview);
}

/**
 * Creates or updates the user's review of a class. Only participants may review,
 * once the class has ended (edition classes: enrollees who paid that edition). Admins can't review.
 */
export async function submitClassReview(actor, id, input) {
  assertUser(actor);
  if (isAdminActor(actor)) throw new HttpError(403, "Los administradores no pueden dejar reseñas");
  const classId = classObjectId(id);
  const db = await getDb();

  const classItem = await db.collection("classes").findOne(
    { _id: classId },
    { projection: { participants: 1, editionId: 1, start_date: 1, duration: 1 } },
  );
  if (!classItem) throw new HttpError(404, "Clase no encontrada");
  if (!(await isClassParticipant(db, classItem, actor.id, { paidOnly: true }))) {
    throw new HttpError(403, "No sos participante de esta clase");
  }
  const endsAt = new Date(classItem.start_date).getTime() + classItem.duration * 60000;
  if (!classItem.start_date || Date.now() < endsAt) {
    throw new HttpError(403, "Solo podés dejar una reseña una vez que la clase haya finalizado");
  }
  return upsertReview(db, actor, { classId }, input);
}

/**
 * One page of the reviews of a course (public), newest first, optionally only those of
 * one of its editions. Each item carries the date label of its edition ("Septiembre 2026").
 * `page` out of range (or invalid) falls back to the nearest valid page.
 * → { items: [toPublicReview + editionLabel], page, totalPages, total }
 * 404 when the course does not exist or `editionId` is not one of its editions.
 */
export async function listCourseReviews(id, { editionId, page = 1, pageSize = 10 } = {}) {
  const courseId = courseObjectId(id);
  const filterEditionId = editionId ? editionObjectId(editionId) : null;
  const size = Math.max(1, Math.floor(Number(pageSize)) || 10);
  const db = await getDb();

  const course = await db.collection("courses").findOne({ _id: courseId }, { projection: { _id: 1 } });
  if (!course) throw new HttpError(404, "Curso no encontrado");
  const editions = new Map((await findCourseEditions(db, courseId)).map((e) => [e._id.toString(), e]));
  if (filterEditionId && !editions.has(filterEditionId.toString())) {
    throw new HttpError(404, "Edición no encontrada");
  }

  const reviews = db.collection("reviews");
  const filter = { courseId, ...(filterEditionId ? { editionId: filterEditionId } : {}) };
  const total = await reviews.countDocuments(filter);
  const { page: current, totalPages, skip } = pageInfo(total, page, size);
  const rows = await reviews.find(filter, { sort: { createdAt: -1, _id: -1 }, skip, limit: size }).toArray();

  const items = rows.map((review) => {
    const edition = review.editionId ? editions.get(review.editionId.toString()) : undefined;
    return {
      ...toPublicReview(review),
      editionLabel: edition?.label ?? null,
    };
  });
  return { items, page: current, totalPages, total };
}

/**
 * One page of the reviews of an edition (public): listCourseReviews of its course
 * filtered by the edition. 404 when the edition does not exist.
 */
export async function listEditionReviews(id, { page = 1, pageSize = 10 } = {}) {
  const editionId = editionObjectId(id);
  const db = await getDb();
  const edition = await db
    .collection("courseEditions")
    .findOne({ _id: editionId }, { projection: { courseId: 1 } });
  if (!edition) throw new HttpError(404, "Edición no encontrada");
  return listCourseReviews(edition.courseId.toString(), { editionId: id, page, pageSize });
}

/**
 * Creates or updates the user's review of an edition (one per user and edition; the
 * same student can review every edition they took). Students need a confirmed payment
 * and a finished edition (403); admins can't review (403). Stores the edition's courseId.
 */
export async function submitEditionReview(actor, id, input) {
  assertUser(actor);
  if (isAdminActor(actor)) throw new HttpError(403, "Los administradores no pueden dejar reseñas");
  const editionId = editionObjectId(id);
  const db = await getDb();

  const [edition] = await db
    .collection("courseEditions")
    .aggregate(editionAggregationPipeline({ _id: editionId }))
    .toArray();
  if (!edition) throw new HttpError(404, "Edición no encontrada");

  const paid = await db
    .collection("courseEnrollments")
    .findOne({ userId: toObjectId(actor.id), editionId, paymentStatus: "paid" }, { projection: { _id: 1 } });
  const error = reviewEligibilityError({ paid: Boolean(paid), timeStatus: withTimeStatus(edition).timeStatus });
  if (error) throw new HttpError(403, error);
  return upsertReview(db, actor, { editionId }, input, { courseId: edition.courseId });
}

/** Every review left by the current user (to mark what they already reviewed). */
export async function listMyReviews(actor) {
  assertUser(actor);
  const db = await getDb();
  return db
    .collection("reviews")
    .find(
      { userId: toObjectId(actor.id) },
      { projection: { courseId: 1, editionId: 1, classId: 1, rating: 1, comment: 1, updatedAt: 1 } },
    )
    .toArray();
}
