import { CalendarAuthError } from "@/lib/google/calendarTokens";
import { HttpError } from "@/server/errors";
import { createClassCalendarEvent } from "@/server/classes/calendar";
import { logger } from "@/lib/logger";
import { getActor, handleApiError, ok } from "@/lib/api/guards";

// POST /api/classes/[id]/calendar-event — admin: creates the Calendar event with Meet
export async function POST(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const data = await createClassCalendarEvent(actor, id);
    return ok({ message: "Clase agregada a Google Calendar con éxito", data }, 201);
  } catch (error) {
    if (error instanceof CalendarAuthError) {
      return Response.json(
        {
          success: false,
          requiresReauth: true,
          message:
            "Tu autorización de Google Calendar ha expirado o fue revocada. Por favor, vuelve a autorizar el acceso.",
        },
        { status: 401 },
      );
    }
    if (error instanceof HttpError) return handleApiError(error);
    logger.error("Error adding to Google Calendar", error);
    return Response.json(
      {
        success: false,
        message: "Error al agregar la clase a Google Calendar. Intenta nuevamente.",
      },
      { status: 500 },
    );
  }
}
