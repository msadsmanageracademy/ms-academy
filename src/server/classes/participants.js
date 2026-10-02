// Participants of standalone classes. Course classes are managed through the
// course enrollments (see src/server/courses/enrollments.js).
import { findUserContacts } from "@/server/users/queries";
import { getDb } from "@/lib/db";
import { notifyMany } from "@/server/notifications";
import { HttpError, assertAdmin, assertUser, isAdminActor, toObjectId } from "@/server/errors";
import { classObjectId, userObjectId } from "@/server/ids";

/**
 * Admin: who takes part in the class, with their contact data, in one request
 * (replaces one /api/users/[id] call per participant). Course classes list the
 * course enrollees with their payment status.
 */
export async function listClassParticipants(actor, id) {
  assertAdmin(actor);
  const classId = classObjectId(id);
  const db = await getDb();
  const classItem = await db
    .collection("classes")
    .findOne({ _id: classId }, { projection: { participants: 1, courseId: 1 } });
  if (!classItem) throw new HttpError(404, "Clase no encontrada");

  let rows;
  if (classItem.courseId) {
    const enrollments = await db
      .collection("courseEnrollments")
      .find({ courseId: classItem.courseId }, { projection: { userId: 1, paymentStatus: 1 }, sort: { _id: 1 } })
      .toArray();
    rows = enrollments.map((e) => ({ userId: e.userId, paymentStatus: e.paymentStatus }));
  } else {
    rows = (classItem.participants ?? []).map((userId) => ({ userId }));
  }

  const contacts = await findUserContacts(db, rows.map((r) => r.userId));
  return rows
    .filter((r) => contacts.has(r.userId.toString()))
    .map(({ userId, ...rest }) => ({ ...contacts.get(userId.toString()), ...rest }));
}

const findUserName = (db, userId) =>
  db.collection("users").findOne({ _id: userId }, { projection: { first_name: 1, last_name: 1 } });

/** Enrolls the current user in a published, upcoming standalone class with free seats. */
export async function enrollInClass(actor, id) {
  assertUser(actor);
  const classId = classObjectId(id);
  if (isAdminActor(actor)) throw new HttpError(403, "Los administradores no pueden inscribirse");
  const userId = toObjectId(actor.id);

  const db = await getDb();
  const classes = db.collection("classes");
  const classItem = await classes.findOne({ _id: classId });
  if (!classItem) throw new HttpError(404, "Clase no encontrada");

  if (classItem.courseId) {
    throw new HttpError(400, "Esta clase pertenece a un curso. Inscribite al curso para acceder.");
  }
  if (classItem.status !== "published") {
    throw new HttpError(400, "La clase no está disponible para inscripción");
  }
  if (!classItem.start_date || new Date(classItem.start_date) <= new Date()) {
    throw new HttpError(400, "La clase ya comenzó o finalizó");
  }
  if ((classItem.participants || []).some((p) => p.equals(userId))) {
    throw new HttpError(400, "Ya estás inscripto en esta clase");
  }

  // Atomic: every condition is re-checked by the update itself (capacity included)
  const result = await classes.updateOne(
    {
      _id: classId,
      status: "published",
      courseId: { $exists: false },
      start_date: { $gt: new Date() },
      participants: { $ne: userId },
      $or: [
        { max_participants: null },
        {
          $expr: {
            $lt: [{ $size: { $ifNull: ["$participants", []] } }, "$max_participants"],
          },
        },
      ],
    },
    { $addToSet: { participants: userId }, $set: { updatedAt: new Date() } },
  );
  if (result.modifiedCount === 0) {
    throw new HttpError(400, "El cupo máximo de esta clase ha sido alcanzado");
  }

  const common = {
    vars: { classTitle: classItem.title, user: await findUserName(db, userId) },
    relatedId: classId,
    actorId: userId,
  };
  await notifyMany(db, [
    ["class.enrolled", { ...common, to: userId }],
    ["class.participant_joined", { ...common, to: classItem.createdBy }],
  ]);
}

/**
 * Removes a participant from a standalone class.
 * - Own user id → the user leaves the class.
 * - Another user id → admin only; the user is notified of the removal.
 */
export async function removeClassParticipant(actor, id, targetUserId) {
  assertUser(actor);
  const classId = classObjectId(id);
  const userId = userObjectId(targetUserId);
  const isSelf = userId.toString() === actor.id;
  if (!isSelf) assertAdmin(actor);

  const db = await getDb();
  const classItem = await db.collection("classes").findOne({ _id: classId });
  if (!classItem) throw new HttpError(404, "Clase no encontrada");
  if (classItem.courseId) {
    throw new HttpError(
      400,
      "Esta clase pertenece a un curso. Gestioná la inscripción desde el curso.",
    );
  }

  const user = await findUserName(db, userId);
  if (!user) throw new HttpError(404, "Usuario no encontrado");

  const result = await db
    .collection("classes")
    .updateOne(
      { _id: classId, participants: userId },
      { $pull: { participants: userId }, $set: { updatedAt: new Date() } },
    );
  if (result.modifiedCount === 0) {
    throw new HttpError(
      400,
      isSelf ? "No estás inscripto en esta clase" : "El usuario no está inscripto en esta clase",
    );
  }

  const common = { vars: { classTitle: classItem.title, user }, relatedId: classId };
  await notifyMany(
    db,
    isSelf
      ? [
          ["class.unenrolled", { ...common, to: userId, actorId: userId }],
          ["class.participant_left", { ...common, to: classItem.createdBy, actorId: userId }],
        ]
      : [
          ["class.removed_by_admin", { ...common, to: userId, actorId: classItem.createdBy }],
          ["class.participant_removed", { ...common, to: classItem.createdBy, actorId: classItem.createdBy }],
        ],
  );
}
