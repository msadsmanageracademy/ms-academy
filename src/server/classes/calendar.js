import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { APP_TIME_ZONE } from "@/utils/dates";
import { HttpError, assertAdmin } from "@/server/errors";
import { notify } from "@/server/notifications";
import {
  CalendarAuthError,
  clearCalendarTokens,
  getCalendarClient,
  isGoogleAuthError,
} from "@/lib/google/calendarTokens";
import { classObjectId } from "@/server/ids";

function eventTimes(startDate, durationMinutes) {
  const start = new Date(startDate);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return {
    start: { dateTime: start.toISOString(), timeZone: APP_TIME_ZONE },
    end: { dateTime: end.toISOString(), timeZone: APP_TIME_ZONE },
  };
}

/**
 * Creates the Google Calendar event (with Meet) for a class, using the admin's calendar.
 * Throws CalendarAuthError when the admin must authorize Calendar again.
 */
export async function createClassCalendarEvent(actor, id) {
  assertAdmin(actor);
  const classId = classObjectId(id);
  const db = await getDb();
  const classes = db.collection("classes");

  const classData = await classes.findOne({ _id: classId });
  if (!classData) throw new HttpError(404, "Clase no encontrada");
  if (classData.googleEventId) {
    throw new HttpError(400, "Esta clase ya tiene un evento de Google Calendar");
  }
  if (!classData.start_date) {
    throw new HttpError(400, "La clase necesita una fecha de inicio para agendarla");
  }

  const calendar = await getCalendarClient(actor.id);

  let response;
  try {
    response = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1,
      resource: {
        summary: classData.title,
        description: classData.short_description || "",
        ...eventTimes(classData.start_date, classData.duration),
        conferenceData: {
          createRequest: {
            requestId: `class-${classId}-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 }, // 1 day before
            { method: "popup", minutes: 30 },
          ],
        },
      },
    });
  } catch (calendarError) {
    if (isGoogleAuthError(calendarError)) {
      await clearCalendarTokens(actor.id);
      throw new CalendarAuthError("CALENDAR_TOKEN_REVOKED");
    }
    throw calendarError;
  }

  const googleMeetLink =
    response.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
    null;
  const event = {
    googleEventId: response.data.id,
    googleMeetLink,
    calendarEventLink: response.data.htmlLink,
  };

  await classes.updateOne({ _id: classId }, { $set: { ...event, updatedAt: new Date() } });

  await notify(db, "class.added_to_calendar", {
    to: actor.id,
    vars: { classTitle: classData.title },
    relatedId: classId,
    actorId: actor.id,
    metadata: { googleMeetLink },
  });

  return event;
}

/**
 * Updates the class's Calendar event after an edit, only when a field shown in
 * the event changed. Best effort: failures are logged, never thrown.
 */
export async function syncClassCalendarEvent(existingClass, changes) {
  if (!existingClass.googleEventId || !existingClass.createdBy) return;

  const changed =
    (changes.title && changes.title !== existingClass.title) ||
    (changes.short_description && changes.short_description !== existingClass.short_description) ||
    (changes.start_date &&
      new Date(changes.start_date).getTime() !== new Date(existingClass.start_date).getTime()) ||
    (changes.duration && changes.duration !== existingClass.duration);
  if (!changed) return;

  try {
    const calendar = await getCalendarClient(existingClass.createdBy.toString());
    await calendar.events.patch({
      calendarId: "primary",
      eventId: existingClass.googleEventId,
      resource: {
        summary: changes.title || existingClass.title,
        description: changes.short_description || existingClass.short_description || "",
        ...eventTimes(
          changes.start_date || existingClass.start_date,
          changes.duration || existingClass.duration,
        ),
      },
    });
  } catch (error) {
    logger.error("Error updating calendar event", error, { classId: existingClass._id });
  }
}

/** Deletes the class's Calendar event. Best effort: failures are logged, never thrown. */
export async function deleteClassCalendarEvent(classItem) {
  if (!classItem.googleEventId || !classItem.createdBy) return;
  try {
    const calendar = await getCalendarClient(classItem.createdBy.toString());
    await calendar.events.delete({ calendarId: "primary", eventId: classItem.googleEventId });
  } catch (error) {
    logger.error("Error deleting calendar event", error, { classId: classItem._id });
  }
}
