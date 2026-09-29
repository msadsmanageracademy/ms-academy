import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import {
  CALENDAR_CALLBACK_PATH,
  CALENDAR_SCOPES,
  OAUTH_STATE_COOKIE,
  createOAuthClient,
} from "@/lib/google/oauth";
import { handleApiError, requireAdmin } from "@/lib/api/guards";

// GET /api/google-calendar — admin only. Returns the Google consent URL.
// A random `state` is stored in an httpOnly cookie and verified in the callback (CSRF protection).
export async function GET() {
  try {
    await requireAdmin();

    const state = randomBytes(32).toString("hex");

    const cookieStore = await cookies();
    cookieStore.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // must survive the top-level redirect back from Google
      path: CALENDAR_CALLBACK_PATH,
      maxAge: 10 * 60, // 10 minutes
    });

    const authUrl = createOAuthClient().generateAuthUrl({
      access_type: "offline",
      scope: CALENDAR_SCOPES,
      state,
      prompt: "consent", // Force consent screen to get refresh token
    });

    return Response.json({ success: true, authUrl }, { status: 200 });
  } catch (error) {
    return handleApiError(error, "Error al iniciar la autorización de Calendar");
  }
}
