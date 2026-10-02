// Course enrollments: pre-enrollment (pending payment), payment confirmation and removal.
import { PaymentUpdateSchema } from "@/utils/validation";
import { findUserContacts } from "@/server/users/queries";
import { getDb } from "@/lib/db";
import { prepareCourseEnrollmentForDB } from "@/models/schemas";
import { HttpError, assertAdmin, assertUser, isAdminActor, parseOrThrow, toObjectId } from "@/server/errors";
import { courseObjectId, userObjectId } from "@/server/ids";
import { notify, notifyMany } from "@/server/notifications";

/**
 * Admin: the course enrollees (pending and paid) with their contact data, in
 * enrollment order. Returns [{ _id, first_name, last_name, email, paymentStatus, enrolledAt, paidAt }].
 */
export async function listCourseEnrollments(actor, id) {
  assertAdmin(actor);
  const courseId = courseObjectId(id);
  const db = await getDb();
  const course = await db.collection("courses").findOne({ _id: courseId }, { projection: { _id: 1 } });
  if (!course) throw new HttpError(404, "Curso no encontrado");

  const enrollments = await db
    .collection("courseEnrollments")
    .find({ courseId }, { sort: { _id: 1 } })
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
 * Pre-enrolls the current user in a published course (payment pending).
 * Capacity counts pending and paid enrollments.
 */
export async function enrollInCourse(actor, id) {
  assertUser(actor);
  const courseId = courseObjectId(id);
  if (isAdminActor(actor)) throw new HttpError(403, "Los administradores no pueden inscribirse");
  const userId = toObjectId(actor.id);

  const db = await getDb();
  const enrollments = db.collection("courseEnrollments");
  const course = await db
    .collection("courses")
    .findOne({ _id: courseId }, { projection: { title: 1, createdBy: 1, status: 1, max_participants: 1 } });
  if (!course) throw new HttpError(404, "Curso no encontrado");
  if (course.status !== "published") throw new HttpError(400, "El curso no está publicado");

  const capacity = course.max_participants ?? null;
  const full = () => new HttpError(400, "El cupo máximo de este curso ha sido alcanzado");
  if (capacity !== null && (await enrollments.countDocuments({ courseId })) >= capacity) throw full();

  // The unique index (userId, courseId) rejects duplicates, even under concurrency
  let insertedId;
  try {
    ({ insertedId } = await enrollments.insertOne(prepareCourseEnrollmentForDB(userId, courseId)));
  } catch (error) {
    if (error?.code === 11000) throw new HttpError(400, "Ya estás inscripto en este curso");
    throw error;
  }

  // Enrollments are ordered by _id (creation order): if two users take the last
  // seat at the same time, the later one is rolled back
  if (capacity !== null) {
    const earlierOrSame = await enrollments.countDocuments({ courseId, _id: { $lte: insertedId } });
    if (earlierOrSame > capacity) {
      await enrollments.deleteOne({ _id: insertedId });
      throw full();
    }
  }

  const common = { vars: { courseTitle: course.title }, relatedId: courseId };
  await notifyMany(db, [
    ["course.pre_enrolled", { ...common, to: userId }],
    ["course.participant_pre_joined", { ...common, to: course.createdBy, actorId: userId }],
  ]);
  return { paymentStatus: "pending" };
}

/** Admin: confirms the payment of a pending enrollment. */
export async function confirmCoursePayment(actor, id, targetUserId, input) {
  assertAdmin(actor);
  const courseId = courseObjectId(id);
  const userId = userObjectId(targetUserId);
  parseOrThrow(PaymentUpdateSchema, input, { useIssueMessage: true });

  const db = await getDb();
  const enrollments = db.collection("courseEnrollments");
  const enrollment = await enrollments.findOne({ userId, courseId });
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

  const course = await db
    .collection("courses")
    .findOne({ _id: courseId }, { projection: { title: 1, createdBy: 1 } });
  const common = { vars: { courseTitle: course?.title }, relatedId: courseId };
  await notifyMany(db, [
    ["course.payment_confirmed", { ...common, to: userId }],
    ["course.payment_received", { ...common, to: course?.createdBy, actorId: userId }],
  ]);
  return { paymentStatus: "paid" };
}

/**
 * Removes an enrollment, which also takes the user out of the course classes.
 * - Own user id → the student cancels; not allowed once paid.
 * - Another user id → admin only; paid enrollments cannot be removed either.
 */
export async function removeCourseEnrollment(actor, id, targetUserId) {
  assertUser(actor);
  const courseId = courseObjectId(id);
  const userId = userObjectId(targetUserId);
  const isSelf = userId.toString() === actor.id;
  if (!isSelf) assertAdmin(actor);

  const db = await getDb();
  const course = await db
    .collection("courses")
    .findOne({ _id: courseId }, { projection: { title: 1, createdBy: 1 } });
  if (!course) throw new HttpError(404, "Curso no encontrado");

  const enrollments = db.collection("courseEnrollments");
  const enrollment = await enrollments.findOne({ userId, courseId });
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

  // The enrollment is the only record: the course classes derive their participants from it.
  // Conditional so a payment confirmed meanwhile is never deleted.
  const result = await enrollments.deleteOne({ _id: enrollment._id, paymentStatus: { $ne: "paid" } });
  if (result.deletedCount === 0) {
    throw new HttpError(409, "La inscripción cambió mientras se cancelaba. Volvé a intentarlo.");
  }

  const common = { vars: { courseTitle: course.title }, relatedId: courseId };
  if (isSelf) {
    await notifyMany(db, [
      ["course.unenrolled", { ...common, to: userId }],
      ["course.participant_left", { ...common, to: course.createdBy, actorId: userId }],
    ]);
  } else {
    await notify(db, "course.removed_by_admin", { ...common, to: userId });
  }
}
