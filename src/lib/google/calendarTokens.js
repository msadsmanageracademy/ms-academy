import { ObjectId } from "mongodb";
import { google } from "googleapis";
import clientPromise from "@/lib/db";
import { decryptJSON, encryptJSON } from "@/lib/crypto";
import { createOAuthClient } from "@/lib/google/oauth";

// Google Calendar tokens are stored encrypted (AES-256-GCM) in
// `users.googleCalendarTokensEnc`. They're never stored or returned in plaintext.

export class CalendarAuthError extends Error {
  // code: "CALENDAR_NOT_AUTHORIZED" | "CALENDAR_TOKEN_REVOKED"
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

async function usersCollection() {
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB_NAME).collection("users");
}

async function readStoredTokens(userId) {
  const users = await usersCollection();
  const user = await users.findOne(
    { _id: new ObjectId(userId) },
    { projection: { googleCalendarTokensEnc: 1 } },
  );
  if (!user?.googleCalendarTokensEnc) return null;
  try {
    return decryptJSON(user.googleCalendarTokensEnc);
  } catch (error) {
    // Wrong/rotated TOKEN_ENCRYPTION_KEY or corrupted value: force re-authorization
    console.error("Could not decrypt Calendar tokens:", error.message);
    await clearCalendarTokens(userId);
    return null;
  }
}

export async function getStoredCalendarTokens(userId) {
  return readStoredTokens(userId);
}

export async function saveCalendarTokens(userId, tokens) {
  const users = await usersCollection();
  const clean = Object.fromEntries(
    Object.entries({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      token_type: tokens.token_type,
      scope: tokens.scope,
    }).filter(([, v]) => v !== undefined && v !== null),
  );
  await users.updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        googleCalendarTokensEnc: encryptJSON(clean),
        hasAuthorizedCalendar: true,
        updatedAt: new Date(),
      },
    },
  );
}

export async function clearCalendarTokens(userId) {
  const users = await usersCollection();
  await users.updateOne(
    { _id: new ObjectId(userId) },
    {
      $unset: { googleCalendarTokensEnc: "" },
      $set: { hasAuthorizedCalendar: false, updatedAt: new Date() },
    },
  );
}

// True when Google rejected the credentials (revoked/expired grant)
export function isGoogleAuthError(error) {
  const status = error?.code ?? error?.response?.status;
  const reason = error?.response?.data?.error;
  return status === 401 || reason === "invalid_grant" || /invalid_grant/i.test(error?.message ?? "");
}

/**
 * Returns an authenticated Calendar API client for the given user.
 * Refreshes the access token when it's about to expire and persists it (encrypted).
 * Throws CalendarAuthError when the user must (re)authorize.
 */
export async function getCalendarClient(userId) {
  let tokens = await readStoredTokens(userId);
  if (!tokens) throw new CalendarAuthError("CALENDAR_NOT_AUTHORIZED");

  if (!tokens.refresh_token) {
    await clearCalendarTokens(userId);
    throw new CalendarAuthError("CALENDAR_NOT_AUTHORIZED");
  }

  const oauthClient = createOAuthClient();

  if (tokens.expiry_date && tokens.expiry_date < Date.now() + EXPIRY_BUFFER_MS) {
    try {
      oauthClient.setCredentials({ refresh_token: tokens.refresh_token });
      const { credentials } = await oauthClient.refreshAccessToken();
      tokens = {
        ...tokens,
        ...credentials,
        refresh_token: credentials.refresh_token || tokens.refresh_token,
      };
      await saveCalendarTokens(userId, tokens);
    } catch (error) {
      console.error("Failed to refresh Google Calendar token:", error.message);
      await clearCalendarTokens(userId);
      throw new CalendarAuthError("CALENDAR_TOKEN_REVOKED");
    }
  }

  oauthClient.setCredentials(tokens);
  return google.calendar({ version: "v3", auth: oauthClient });
}
