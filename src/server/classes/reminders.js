import { ClassReminderEmail } from "@/views/components/layout/ClassReminderEmail";
import { ReminderSchema } from "@/utils/validation";
import { Resend } from "resend";
import { classObjectId } from "@/server/ids";
import { formatLongDateAtTime } from "@/utils/dates";
import { getClassParticipantIds } from "./audience";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { notify } from "@/server/notifications";
import { HttpError, assertAdmin, parseOrThrow, toObjectId } from "@/server/errors";

/**
 * Emails a reminder of the class to its participants (all of them, or the given
 * `participantIds`). In course classes only paid enrollees are reminded.
 * Returns { notifiedCount }.
 */
export async function sendClassReminders(actor, id, input) {
  assertAdmin(actor);
  const classId = classObjectId(id);
  const { participantIds } = parseOrThrow(ReminderSchema, input, { useIssueMessage: true });

  const db = await getDb();
  const classItem = await db.collection("classes").findOne({ _id: classId });
  if (!classItem) throw new HttpError(404, "Clase no encontrada");

  // Course classes: only enrollees who paid (the rest have no access to the class)
  let targetIds = (await getClassParticipantIds(db, classItem, { paidOnly: true })).map((p) =>
    p.toString(),
  );

  if (participantIds?.length > 0) {
    const requested = targetIds.filter((pid) => participantIds.includes(pid));
    if (requested.length === 0) {
      throw new HttpError(400, "Ningún participante válido para notificar");
    }
    targetIds = requested;
  }
  if (targetIds.length === 0) throw new HttpError(400, "No hay participantes para notificar");

  const users = await db
    .collection("users")
    .find(
      { _id: { $in: targetIds.map((uid) => toObjectId(uid)) } },
      { projection: { email: 1, first_name: 1 } },
    )
    .toArray();
  if (users.length === 0) throw new HttpError(404, "No se encontraron usuarios");

  const formattedDate = formatLongDateAtTime(classItem.start_date);
  const emailProps = {
    className: classItem.title,
    description: classItem.short_description || "",
    startDate: formattedDate,
    duration: classItem.duration,
    googleMeetLink: classItem.googleMeetLink || null,
    logoUrl: process.env.EMAIL_LOGO_URL || "",
  };
  const emails = users.map((user) => ({
    from: process.env.RESEND_FROM_EMAIL,
    to: user.email,
    replyTo: actor.email,
    subject: `Recordatorio: ${classItem.title}`,
    react: ClassReminderEmail(emailProps),
  }));

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } =
    emails.length === 1 ? await resend.emails.send(emails[0]) : await resend.batch.send(emails);
  if (error) {
    logger.error("Resend error sending class reminders", error, { classId });
    throw new HttpError(500, emails.length === 1 ? "Error al enviar el email" : "Error al enviar los emails");
  }

  await notify(db, "class.reminder", {
    to: users.map((user) => user._id),
    vars: { classTitle: classItem.title, date: formattedDate },
    relatedId: classId,
  });

  return { notifiedCount: users.length };
}
