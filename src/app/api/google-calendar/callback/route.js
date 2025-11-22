import { google } from "googleapis";
import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXTAUTH_URL}/api/google-calendar/callback`
);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const userId = searchParams.get("state");
    const error = searchParams.get("error");

    // Check if user denied access
    if (error) {
      console.error("OAuth error from Google:", error);
      return Response.redirect(
        new URL(
          `/dashboard/classes?error=${
            error === "access_denied" ? "access_denied" : "authorization_failed"
          }`,
          req.url
        )
      );
    }

    if (!code || !userId) {
      console.error("Missing code or userId:", { code: !!code, userId });
      return Response.redirect(
        new URL("/dashboard/classes?error=authorization_failed", req.url)
      );
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.warn(
        "No refresh token received. User may have already authorized before."
      );
    }

    // Store tokens in user document
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection("users");

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          hasAuthorizedCalendar: true,
          googleCalendarTokens: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: tokens.expiry_date,
            token_type: tokens.token_type,
            scope: tokens.scope,
          },
        },
      }
    );

    console.log("Successfully stored Google Calendar tokens for user:", userId);

    // Redirect back to dashboard with success message
    return Response.redirect(
      new URL("/dashboard/classes?calendar_connected=true", req.url)
    );
  } catch (error) {
    console.error("Google Calendar OAuth Error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
    });
    return Response.redirect(
      new URL(
        `/dashboard/classes?error=token_exchange_failed&details=${encodeURIComponent(
          error.message
        )}`,
        req.url
      )
    );
  }
}
