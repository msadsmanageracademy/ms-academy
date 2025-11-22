import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { google } from "googleapis";
import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";

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
    throw new Error("No hay tokens de Google Calendar disponibles");
  }

  const tokens = user.googleCalendarTokens;

  // Check if token is expired or about to expire (within 5 minutes)
  const now = Date.now();
  const expiryBuffer = 5 * 60 * 1000; // 5 minutes

  if (tokens.expiry_date && tokens.expiry_date < now + expiryBuffer) {
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
        },
      }
    );

    return credentials;
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
    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
      conferenceDataVersion: 1,
    });

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
          createdBy: session.user.id,
        },
      }
    );

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
    return Response.json(
      {
        success: false,
        error: error.message,
        message:
          "Error al agregar la clase a Google Calendar. Verifica que hayas autorizado el acceso.",
      },
      { status: 500 }
    );
  }
}
