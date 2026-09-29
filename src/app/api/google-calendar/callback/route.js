import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import {
  CALENDAR_CALLBACK_PATH,
  OAUTH_STATE_COOKIE,
  createOAuthClient,
} from "@/lib/google/oauth";
import {
  getStoredCalendarTokens,
  saveCalendarTokens,
} from "@/lib/google/calendarTokens";

// NextResponse (mutable headers) so the state-cookie deletion is applied to the redirect
const redirectTo = (req, query) =>
  NextResponse.redirect(new URL(`/dashboard/classes?${query}`, req.url));

function statesMatch(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(req) {
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  // One-time use: always clear the state cookie
  cookieStore.delete({ name: OAUTH_STATE_COOKIE, path: CALENDAR_CALLBACK_PATH });

  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Check if user denied access
    if (error) {
      return redirectTo(
        req,
        `error=${error === "access_denied" ? "access_denied" : "authorization_failed"}`,
      );
    }

    // CSRF protection: the state must match the one issued to this browser
    if (!code || !statesMatch(state, expectedState)) {
      console.error("Google Calendar OAuth: missing code or invalid state");
      return redirectTo(req, "error=authorization_failed");
    }

    // The account to link is taken from the session, never from the query string
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "admin") {
      return redirectTo(req, "error=authorization_failed");
    }

    const { tokens } = await createOAuthClient().getToken(code);

    // Google only returns a refresh token on first consent; keep the stored one otherwise
    let refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      console.warn("Google Calendar OAuth: no refresh token received");
      const previous = await getStoredCalendarTokens(session.user.id).catch(() => null);
      refreshToken = previous?.refresh_token;
    }

    // Stored encrypted at rest (AES-256-GCM)
    await saveCalendarTokens(session.user.id, { ...tokens, refresh_token: refreshToken });

    return redirectTo(req, "calendar_connected=true");
  } catch (error) {
    // Details are logged server-side only; never reflected in the URL
    console.error("Google Calendar OAuth Error:", error);
    return redirectTo(req, "error=token_exchange_failed");
  }
}
