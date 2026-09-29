import { APP_TIME_ZONE } from "@/utils/dates";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { prepareNotificationForDB } from "@/models/schemas";
import { HttpError, handleApiError, requireAdmin } from "@/lib/api/guards";
import {
  CalendarAuthError,
  clearCalendarTokens,
  getCalendarClient,
  isGoogleAuthError,
} from "@/lib/google/calendarTokens";

export async function POST(req, { params }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    if (!ObjectId.isValid(id)) throw new HttpError(400, "ID de clase inválido");

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");

    const classData = await classesCollection.findOne({ _id: new ObjectId(id) });
    if (!classData) throw new HttpError(404, "Clase no encontrada");

    if (classData.googleEventId) {
      return Response.json(
        {
          success: false,
          message: "Esta clase ya tiene un evento de Google Calendar",
          googleMeetLink: classData.googleMeetLink,
        },
        { status: 400 },
      );
    }

    if (!classData.start_date) {
      throw new HttpError(400, "La clase necesita una fecha de inicio para agendarla");
    }

    const calendar = await getCalendarClient(session.user.id);

    const startDate = new Date(classData.start_date);
    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + classData.duration);

    const event = {
      summary: classData.title,
      description: classData.short_description || "",
      start: {
        dateTime: startDate.toISOString(),
        timeZone: APP_TIME_ZONE,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: APP_TIME_ZONE,
      },
      conferenceData: {
        createRequest: {
          requestId: `class-${id}-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 }, // 1 day before
          { method: "popup", minutes: 30 }, // 30 minutes before
        ],
      },
    };

    let response;
    try {
      response = await calendar.events.insert({
        calendarId: "primary",
        resource: event,
        conferenceDataVersion: 1,
      });
    } catch (calendarError) {
      console.error("Google Calendar API error:", calendarError.message);
      if (isGoogleAuthError(calendarError)) {
        await clearCalendarTokens(session.user.id);
        throw new CalendarAuthError("CALENDAR_TOKEN_REVOKED");
      }
      throw calendarError;
    }

    const googleMeetLink = response.data.conferenceData?.entryPoints?.find(
      (entry) => entry.entryPointType === "video",
    )?.uri;

    await classesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          googleEventId: response.data.id,
          googleMeetLink: googleMeetLink || null,
          calendarEventLink: response.data.htmlLink,
          updatedAt: new Date(),
        },
      },
    );

    await db.collection("notifications").insertOne(
      prepareNotificationForDB({
        userId: new ObjectId(session.user.id),
        type: "class.added_to_calendar",
        title: "Clase agregada a Calendar",
        message: `La clase "${classData.title}" se agregó a Google Calendar`,
        relatedId: new ObjectId(id),
        relatedType: "class",
        actorId: new ObjectId(session.user.id),
        metadata: { googleMeetLink },
      }),
    );

    return Response.json(
      {
        success: true,
        message: "Clase agregada a Google Calendar con éxito",
        googleEventId: response.data.id,
        googleMeetLink,
        calendarEventLink: response.data.htmlLink,
      },
      { status: 200 },
    );
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

    console.error("Error adding to Google Calendar:", error);
    return Response.json(
      {
        success: false,
        message: "Error al agregar la clase a Google Calendar. Intenta nuevamente.",
      },
      { status: 500 },
    );
  }
}
