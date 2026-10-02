"use server";

// Server Actions for classes: thin wrappers over the same services as the REST API.
// Authorization lives in the services (they receive the acting user).
import { CalendarAuthError } from "@/lib/google/calendarTokens";
import { HttpError } from "@/server/errors";
import { actionResult } from "./result";
import { getActor } from "@/lib/api/guards";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { createClassCalendarEvent } from "@/server/classes/calendar";
import { sendClassReminders } from "@/server/classes/reminders";
import {
  deleteClass,
  linkClassToCourse,
  removeClassRecording,
  setClassRecording,
  setClassResources,
  setClassStatus,
  unlinkClassFromCourse,
} from "@/server/classes/service";
import { enrollInClass, removeClassParticipant } from "@/server/classes/participants";

// Pages read their data on each request: revalidating makes the page that called the
// action re-render with fresh data in the same response
const refreshPages = () => revalidatePath("/", "layout");

const run = (context, body) =>
  actionResult(context, async () => {
    const result = await body(await getActor());
    refreshPages();
    return result;
  });

export async function enrollInClassAction(classId) {
  return run("Error enrolling in class", async (actor) => {
    await enrollInClass(actor, classId);
    return { message: "Inscripción realizada con éxito" };
  });
}

/** The current user leaves a standalone class. */
export async function leaveClassAction(classId) {
  return run("Error leaving class", async (actor) => {
    await removeClassParticipant(actor, classId, actor?.id);
    return { message: "Inscripción cancelada con éxito" };
  });
}

export async function removeClassParticipantAction(classId, userId) {
  return run("Error removing class participant", async (actor) => {
    await removeClassParticipant(actor, classId, userId);
    return { message: "Participante removido con éxito" };
  });
}

export async function setClassStatusAction(classId, status) {
  return run("Error updating class status", async (actor) => ({
    message: "Estado actualizado",
    data: await setClassStatus(actor, classId, { status }),
  }));
}

export async function linkClassToCourseAction(classId, courseId) {
  return run("Error linking class to course", async (actor) => ({
    message: "Clase vinculada al curso",
    data: await linkClassToCourse(actor, classId, { courseId }),
  }));
}

export async function unlinkClassFromCourseAction(classId) {
  return run("Error unlinking class from course", async (actor) => ({
    message: "Clase desvinculada del curso",
    data: await unlinkClassFromCourse(actor, classId),
  }));
}

export async function deleteClassAction(classId) {
  return run("Error deleting class", async (actor) => {
    await deleteClass(actor, classId);
    return { message: "Clase eliminada con éxito" };
  });
}

/** Sets the recording link; an empty URL removes it. */
export async function saveClassRecordingAction(classId, url) {
  return run("Error saving class recording", async (actor) => {
    const trimmed = typeof url === "string" ? url.trim() : "";
    if (trimmed) await setClassRecording(actor, classId, { url: trimmed });
    else await removeClassRecording(actor, classId);
    return { message: trimmed ? "Grabación guardada" : "Grabación eliminada" };
  });
}

export async function saveClassResourcesAction(classId, resources) {
  return run("Error updating class resources", async (actor) => {
    await setClassResources(actor, classId, { resources });
    return { message: "Materiales actualizados" };
  });
}

/** Emails a reminder to every participant, or only to `participantIds`. */
export async function sendClassRemindersAction(classId, participantIds) {
  return run("Error sending class reminder", async (actor) => ({
    message: "Recordatorio enviado",
    data: await sendClassReminders(actor, classId, participantIds ? { participantIds } : {}),
  }));
}

/**
 * Creates the Calendar event with Meet. When the admin must authorize Calendar again
 * the result carries `requiresReauth: true`.
 */
export async function createClassCalendarEventAction(classId) {
  try {
    const data = await createClassCalendarEvent(await getActor(), classId);
    refreshPages();
    return { ok: true, success: true, message: "Clase agregada a Google Calendar con éxito", data };
  } catch (error) {
    if (error instanceof CalendarAuthError) {
      return {
        ok: false,
        success: false,
        status: 401,
        requiresReauth: true,
        message:
          "Tu autorización de Google Calendar ha expirado o fue revocada. Por favor, vuelve a autorizar el acceso.",
      };
    }
    if (error instanceof HttpError) {
      return { ok: false, success: false, status: error.status, message: error.message };
    }
    logger.error("Error adding to Google Calendar", error);
    return {
      ok: false,
      success: false,
      status: 500,
      message: "Error al agregar la clase a Google Calendar. Intenta nuevamente.",
    };
  }
}
