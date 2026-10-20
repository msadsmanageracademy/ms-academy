// Edition enrollments: pre-enrollment (pending payment), payment confirmation and removal.
// Students enroll in a concrete edition of a course; the same student may be enrolled in
// several editions of the same course.
import { PaymentUpdateSchema } from "@/utils/validation";
import { findUserContacts } from "@/server/users/queries";
import { getDb } from "@/lib/db";
import { HttpError, assertAdmin, assertUser, isAdminActor, parseOrThrow, toObjectId } from "@/server/errors";
import { editionObjectId, userObjectId } from "@/server/ids";
import { notify, notifyMany } from "@/server/notifications";
import { prepareCourseEnrollmentForDB } from "@/models/schemas";
import { withTransaction } from "@/server/transactions";
import { editionAggregationPipeline, getEditionLabels, getEditionTimeStatusFromClasses } from "./queries";
import { editionName, withTimeStatus } from "@/utils/courseEditions";

const editionNotFound = () => new HttpError(404, "Edición no encontrada");

/** The edition (with its date label) and its course title (for messages), or 404. */
async function findEditionWithCourse(db, editionId, { session } = {}) {
  const edition = await db
    .collection("courseEditions")
    .findOne(
      { _id: editionId },
      { projection: { courseId: 1, status: 1, max_participants: 1, createdBy: 1 }, session },
    );
  if (!edition) throw editionNotFound();
  const [course, labels] = await Promise.all([
    db.collection("courses").findOne({ _id: edition.courseId }, { projection: { title: 1, createdBy: 1 }, session }),
    getEditionLabels(db, [edition.courseId], { session }),
  ]);
  return { edition: { ...edition, label: labels.get(editionId.toString())?.label }, course };
}

/**
 * Common notification options of an edition: "Curso · Septiembre 2026" in the message,
 * related to the edition, with the course id as metadata.
 */
const editionNotice = (edition, course) => ({
  vars: { courseTitle: editionName(course?.title ?? "Curso", edition.label) },
  relatedId: edition._id,
  relatedType: "edition",
  metadata: { courseId: edition.courseId },
});

// The admin who receives the course notifications
const courseOwner = (edition, course) => course?.createdBy ?? edition.createdBy;

/**
 * Admin: the edition enrollees (pending and paid) with their contact data, in
 * enrollment order. Returns [{ _id, first_name, last_name, email, paymentStatus, enrolledAt, paidAt }].
 */
export async function listEditionEnrollments(actor, id) {
  assertAdmin(actor);
  const editionId = editionObjectId(id);
  const db = await getDb();
  const edition = await db.collection("courseEditions").findOne({ _id: editionId }, { projection: { _id: 1 } });
  if (!edition) throw editionNotFound();

  const enrollments = await db
    .collection("courseEnrollments")
    .find({ editionId }, { sort: { _id: 1 } })
    .toArray();
  const contacts = await findUserContacts(db, enrollments.map((e) => e.userId));
  return enrollments
    .filter((e) => contacts.has(e.userId.toString()))
    .map((e) => ({
      ...contacts.get(e.userId.toString()),
      paymentStatus: e.paymentStatus,
      enrolledAt: e.createdAt,
      paidAt: e.paidAt ?? null,
    }));
}

/**
 * Pre-enrolls the current user in a published edition that hasn't started yet (payment pending).
 * Capacity counts pending and paid enrollments. Runs in a transaction that touches the
 * edition document, so concurrent enrollments (and a concurrent unpublish or course
 * deletion) are serialized: the capacity check is exact and no enrollment can outlive
 * its edition.
 */
export async function enrollInEdition(actor, id) {
  assertUser(actor);
  const editionId = editionObjectId(id);
  if (isAdminActor(actor)) throw new HttpError(403, "Los administradores no pueden inscribirse");
  const userId = toObjectId(actor.id);

  try {
    return await withTransaction(async ({ db, session, afterCommit }) => {
      const { edition, course } = await findEditionWithCourse(db, editionId, { session });
      if (edition.status !== "published") throw new HttpError(400, "La edición no está publicada");

      // Write lock on the edition: a concurrent writer of the same edition gets a
      // WriteConflict and withTransaction retries it from the start
      const touched = await db
        .collection("courseEditions")
        .updateOne({ _id: editionId, status: "published" }, { $set: { updatedAt: new Date() } }, { session });
      if (touched.matchedCount === 0) throw new HttpError(400, "La edición no está publicada");

      // Only upcoming editions accept new students (checked inside the transaction)
      const timeStatus = await getEditionTimeStatusFromClasses(db, editionId, edition.status, { session });
      if (timeStatus === "in-progress") {
        throw new HttpError(400, "Esta edición ya comenzó: no se aceptan nuevas inscripciones");
      }
      if (timeStatus !== "upcoming") {
        throw new HttpError(400, "Esta edición ya no acepta inscripciones");
      }

      const enrollments = db.collection("courseEnrollments");
      const capacity = edition.max_participants ?? null;
      if (capacity !== null && (await enrollments.countDocuments({ editionId }, { session })) >= capacity) {
        throw new HttpError(400, "El cupo máximo de este curso ha sido alcanzado");
      }
      // The unique index (userId, editionId) rejects duplicates
      await enrollments.insertOne(prepareCourseEnrollmentForDB(userId, editionId), { session });

      const common = editionNotice(edition, course);
      afterCommit(() =>
        notifyMany(db, [
          ["course.pre_enrolled", { ...common, to: userId }],
          ["course.participant_pre_joined", { ...common, to: courseOwner(edition, course), actorId: userId }],
        ]),
      );
      return { paymentStatus: "pending" };
    });
  } catch (error) {
    if (error?.code === 11000) throw new HttpError(400, "Ya estás inscripto en este curso");
    throw error;
  }
}

/** Admin: confirms the payment of a pending enrollment. */
export async function confirmEditionPayment(actor, id, targetUserId, input) {
  assertAdmin(actor);
  const editionId = editionObjectId(id);
  const userId = userObjectId(targetUserId);
  parseOrThrow(PaymentUpdateSchema, input, { useIssueMessage: true });

  const db = await getDb();
  const { edition, course } = await findEditionWithCourse(db, editionId);
  const enrollments = db.collection("courseEnrollments");
  const enrollment = await enrollments.findOne({ userId, editionId });
  if (!enrollment) throw new HttpError(404, "El usuario no está inscripto en este curso");
  if (enrollment.paymentStatus === "paid") throw new HttpError(400, "El pago ya fue confirmado");

  const now = new Date();
  // Conditional: two concurrent confirmations (or a cancellation in between) can't both win
  const result = await enrollments.updateOne(
    { _id: enrollment._id, paymentStatus: { $ne: "paid" } },
    { $set: { paymentStatus: "paid", paidAt: now, updatedAt: now } },
  );
  if (result.matchedCount === 0) {
    throw new HttpError(409, "La inscripción cambió mientras se confirmaba el pago");
  }

  const common = editionNotice(edition, course);
  await notifyMany(db, [
    ["course.payment_confirmed", { ...common, to: userId }],
    ["course.payment_received", { ...common, to: courseOwner(edition, course), actorId: userId }],
  ]);
  return { paymentStatus: "paid" };
}

/**
 * Removes an enrollment, which also takes the user out of the edition classes.
 * - Own user id → the student cancels; not allowed once paid.
 * - Another user id → admin only; paid enrollments cannot be removed either.
 */
export async function removeEditionEnrollment(actor, id, targetUserId) {
  assertUser(actor);
  const editionId = editionObjectId(id);
  const userId = userObjectId(targetUserId);
  const isSelf = userId.toString() === actor.id;
  if (!isSelf) assertAdmin(actor);

  const db = await getDb();
  const { edition, course } = await findEditionWithCourse(db, editionId);
  const enrollments = db.collection("courseEnrollments");
  const enrollment = await enrollments.findOne({ userId, editionId });
  if (!enrollment) {
    throw new HttpError(
      isSelf ? 400 : 404,
      isSelf ? "No estás inscripto en este curso" : "El usuario no está inscripto en este curso",
    );
  }
  if (enrollment.paymentStatus === "paid") {
    throw new HttpError(
      403,
      isSelf
        ? "No podés cancelar una inscripción ya pagada"
        : "No se puede remover a un participante que ya ha pagado el curso",
    );
  }

  // The enrollment is the only record: the edition classes derive their participants from it.
  // Conditional so a payment confirmed meanwhile is never deleted.
  const result = await enrollments.deleteOne({ _id: enrollment._id, paymentStatus: { $ne: "paid" } });
  if (result.deletedCount === 0) {
    throw new HttpError(409, "La inscripción cambió mientras se cancelaba. Volvé a intentarlo.");
  }

  const common = editionNotice(edition, course);
  if (isSelf) {
    await notifyMany(db, [
      ["course.unenrolled", { ...common, to: userId }],
      ["course.participant_left", { ...common, to: courseOwner(edition, course), actorId: userId }],
    ]);
  } else {
    await notify(db, "course.removed_by_admin", { ...common, to: userId });
  }
}

/**
 * "Mis cursos": every edition the current user is enrolled in, newest enrollment first,
 * with its course, date label ("Septiembre 2026"), dates and the user's payment status.
 * → [{ _id (editionId), courseId, courseTitle, short_description, label, title,
 *      price, status, timeStatus, start_date, end_date, amount_of_classes,
 *      paymentStatus, enrolledAt, paidAt }]
 */
export async function listMyEditions(actor) {
  assertUser(actor);
  const db = await getDb();
  const enrollments = await db
    .collection("courseEnrollments")
    .find({ userId: toObjectId(actor.id) }, { sort: { _id: -1 } })
    .toArray();
  if (enrollments.length === 0) return [];

  const editions = await db
    .collection("courseEditions")
    .aggregate(editionAggregationPipeline({ _id: { $in: enrollments.map((e) => e.editionId) } }))
    .toArray();
  const courseIds = [...new Set(editions.map((e) => e.courseId.toString()))].map((cid) => toObjectId(cid));
  const [courses, labels] = await Promise.all([
    db
      .collection("courses")
      .find({ _id: { $in: courseIds } }, { projection: { title: 1, short_description: 1 } })
      .toArray(),
    // Labels count every edition of the course, not only the user's ones
    getEditionLabels(db, courseIds),
  ]);
  const editionById = new Map(
    editions.map((e) => [e._id.toString(), { ...withTimeStatus(e), label: labels.get(e._id.toString())?.label }]),
  );
  const courseById = new Map(courses.map((c) => [c._id.toString(), c]));

  return enrollments
    .filter((e) => editionById.has(e.editionId.toString()))
    .map((enrollment) => {
      const edition = editionById.get(enrollment.editionId.toString());
      const course = courseById.get(edition.courseId.toString());
      const courseTitle = course?.title ?? "";
      return {
        _id: edition._id,
        courseId: edition.courseId,
        courseTitle,
        short_description: course?.short_description ?? "",
        label: edition.label,
        title: editionName(courseTitle, edition.label),
        price: edition.price,
        status: edition.status,
        timeStatus: edition.timeStatus,
        start_date: edition.start_date ?? null,
        end_date: edition.end_date ?? null,
        amount_of_classes: edition.amount_of_classes,
        paymentStatus: enrollment.paymentStatus,
        enrolledAt: enrollment.createdAt,
        paidAt: enrollment.paidAt ?? null,
      };
    });
}
