import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/db";
import { getServerSession } from "next-auth";
import { google } from "googleapis";
import { prepareNotificationForDB } from "@/models/schemas";

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXTAUTH_URL}/api/google-calendar/callback`
);

// Helper function to refresh token if expired
async function getValidTokens(userId) {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME);
  const usersCollection = db.collection("users");

  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

  if (!user?.googleCalendarTokens) {
    throw new Error("CALENDAR_NOT_AUTHORIZED");
  }

  const tokens = user.googleCalendarTokens;

  // Check if we have a refresh token
  if (!tokens.refresh_token) {
    // Clear invalid tokens from DB
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $unset: { googleCalendarTokens: "" },
        $set: { hasAuthorizedCalendar: false, updatedAt: new Date() },
      }
    );
    throw new Error("CALENDAR_NOT_AUTHORIZED");
  }

  // Check if token is expired or about to expire (within 5 minutes)
  const now = Date.now();
  const expiryBuffer = 5 * 60 * 1000; // 5 minutes

  if (tokens.expiry_date && tokens.expiry_date < now + expiryBuffer) {
    try {
      // Token expired or about to expire, refresh it
      oauth2Client.setCredentials({
        refresh_token: tokens.refresh_token,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update tokens in database
      await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            "googleCalendarTokens.access_token": credentials.access_token,
            "googleCalendarTokens.expiry_date": credentials.expiry_date,
            updatedAt: new Date(),
          },
        }
      );

      return credentials;
    } catch (refreshError) {
      // Refresh token is invalid/revoked - clear from DB
      console.error("Failed to refresh token:", refreshError.message);
      await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $unset: { googleCalendarTokens: "" },
          $set: { hasAuthorizedCalendar: false, updatedAt: new Date() },
        }
      );
      throw new Error("CALENDAR_TOKEN_REVOKED");
    }
  }

  return tokens;
}

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
      return Response.json(
        { success: false, message: "No autorizado" },
        { status: 401 }
      );
    }

    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return Response.json(
        { success: false, message: "ID de clase inválido" },
        { status: 400 }
      );
    }

    // Get class details
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");

    const classData = await classesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!classData) {
      return Response.json(
        { success: false, message: "Clase no encontrada" },
        { status: 404 }
      );
    }

    // Check if class already has a calendar event
    if (classData.googleEventId) {
      return Response.json(
        {
          success: false,
          message: "Esta clase ya tiene un evento de Google Calendar",
          googleMeetLink: classData.googleMeetLink,
        },
        { status: 400 }
      );
    }

    // Get valid tokens
    const tokens = await getValidTokens(session.user.id);

    // Set credentials
    oauth2Client.setCredentials(tokens);

    // Initialize Calendar API
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Calculate end time (start time + duration in minutes)
    const startDate = new Date(classData.start_date);
    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + classData.duration);

    // Create calendar event with Google Meet
    const event = {
      summary: classData.title,
      description: classData.short_description || classData.description || "",
      start: {
        dateTime: startDate.toISOString(),
        timeZone: "America/Argentina/Buenos_Aires",
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: "America/Argentina/Buenos_Aires",
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

    // Insert event with conference data
    let response;
    try {
      response = await calendar.events.insert({
        calendarId: "primary",
        resource: event,
        conferenceDataVersion: 1,
      });
    } catch (calendarError) {
      // If Google Calendar API fails, it's likely due to invalid/revoked token
      console.error("Google Calendar API error:", calendarError.message);

      // Clear invalid tokens from DB
      const usersCollection = db.collection("users");
      await usersCollection.updateOne(
        { _id: new ObjectId(session.user.id) },
        {
          $unset: { googleCalendarTokens: "" },
          $set: { hasAuthorizedCalendar: false, updatedAt: new Date() },
        }
      );

      throw new Error("CALENDAR_TOKEN_REVOKED");
    }

    const googleMeetLink = response.data.conferenceData?.entryPoints?.find(
      (entry) => entry.entryPointType === "video"
    )?.uri;

    // Update class with Google event ID and Meet link
    await classesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          googleEventId: response.data.id,
          googleMeetLink: googleMeetLink || null,
          calendarEventLink: response.data.htmlLink,
          updatedAt: new Date(),
        },
      }
    );

    // Create notification for admin
    const notifications = db.collection("notifications");
    const notification = prepareNotificationForDB({
      userId: new ObjectId(session.user.id),
      type: "class_added_to_calendar",
      title: "Clase agregada a Calendar",
      message: `La clase "${classData.title}" se agregó a Google Calendar`,
      relatedId: new ObjectId(id),
      relatedType: "class",
      metadata: {
        classTitle: classData.title,
        googleMeetLink,
      },
    });
    await notifications.insertOne(notification);

    return Response.json(
      {
        success: true,
        message: "Clase agregada a Google Calendar con éxito",
        googleEventId: response.data.id,
        googleMeetLink,
        calendarEventLink: response.data.htmlLink,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error adding to Google Calendar:", error);

    // Handle specific error cases
    if (
      error.message === "CALENDAR_NOT_AUTHORIZED" ||
      error.message === "CALENDAR_TOKEN_REVOKED"
    ) {
      return Response.json(
        {
          success: false,
          requiresReauth: true,
          message:
            "Tu autorización de Google Calendar ha expirado o fue revocada. Por favor, vuelve a autorizar el acceso.",
        },
        { status: 401 }
      );
    }

    return Response.json(
      {
        success: false,
        error: error.message,
        message:
          "Error al agregar la clase a Google Calendar. Intenta nuevamente.",
      },
      { status: 500 }
    );
  }
}
