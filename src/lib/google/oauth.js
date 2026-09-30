import { auth } from "@googleapis/calendar";

// Base URL of the app (Auth.js v5 variable)
export function getAppUrl() {
  return process.env.AUTH_URL;
}

export const CALENDAR_CALLBACK_PATH = "/api/google-calendar/callback";

// Only event management is needed to create/update/delete classes and Meet links
export const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
];

export const OAUTH_STATE_COOKIE = "gcal_oauth_state";

export function createOAuthClient() {
  return new auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${getAppUrl()}${CALENDAR_CALLBACK_PATH}`,
  );
}
