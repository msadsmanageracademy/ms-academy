// Users API, registration, Calendar OAuth start, notifications and rate limiting.
import { beforeEach, describe, expect, it } from "vitest";
import * as userRoute from "@/app/api/users/[id]/route";
import * as registerRoute from "@/app/api/auth/register/route";
import * as googleCalendarRoute from "@/app/api/google-calendar/route";
import * as unreadCountRoute from "@/app/api/notifications/unread-count/route";
import { hitRateLimit, peekRateLimit, resetRateLimit } from "@/lib/rateLimit";
import { encryptJSON } from "@/lib/crypto";
import { callRoute, createAdmin, createUser, resetDb, setSession } from "../helpers.mjs";

let db, admin, user, other;

beforeEach(async () => {
  db = await resetDb();
  admin = await createAdmin(db, {
    password: "hash-must-not-leak",
    googleCalendarTokensEnc: encryptJSON({ access_token: "secret" }),
  });
  user = await createUser(db, { password: "hash-must-not-leak" });
  other = await createUser(db);
  setSession(null);
});

const params = (u) => ({ id: u._id.toString() });

describe("/api/users/[id]", () => {
  it("GET: anonymous 401, another user 403", async () => {
    expect((await callRoute(userRoute.GET, { params: params(user) })).status).toBe(401);
    setSession(other);
    expect((await callRoute(userRoute.GET, { params: params(user) })).status).toBe(403);
  });

  it("GET never returns the password or tokens", async () => {
    setSession(admin);
    for (const target of [admin, user]) {
      const { status, json } = await callRoute(userRoute.GET, { params: params(target) });
      expect(status).toBe(200);
      expect(json.data).not.toHaveProperty("password");
      expect(json.data).not.toHaveProperty("googleCalendarTokensEnc");
    }
  });

  it("PATCH: cannot change the role or edit another user", async () => {
    setSession(user);
    const patch = (target, body) => callRoute(userRoute.PATCH, { method: "PATCH", body, params: params(target) });
    expect((await patch(user, { role: "admin" })).status).toBe(400);
    expect((await patch(other, { first_name: "Hacked" })).status).toBe(403);
    expect((await patch(user, { first_name: "Ana", last_name: "Pérez", age: 30 })).status).toBe(200);

    const saved = await db.collection("users").findOne({ _id: user._id });
    expect(saved.role).toBe("user");
    expect(saved.first_name).toBe("Ana");
    expect((await db.collection("users").findOne({ _id: other._id })).first_name).toBe("Test");
  });

  it("an admin cannot edit another user's profile either", async () => {
    setSession(admin);
    const res = await callRoute(userRoute.PATCH, { method: "PATCH", body: { first_name: "X" }, params: params(user) });
    expect(res.status).toBe(403);
  });
});

describe("registration", () => {
  const register = () =>
    callRoute(registerRoute.POST, {
      method: "POST",
      body: { email: "new@example.test", password: "Segura#123", role: "admin" },
    });

  it("returns 403 and creates no users when registration is disabled", async () => {
    expect((await register()).status).toBe(403);
    expect(await db.collection("users").countDocuments({ email: "new@example.test" })).toBe(0);
  });

  it("rate limits by IP (6th attempt within an hour → 429)", async () => {
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await register()).status);
    expect(statuses.slice(0, 5).every((s) => s === 403)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});

describe("other session-protected endpoints", () => {
  it("only an admin can start the Calendar OAuth flow", async () => {
    expect((await callRoute(googleCalendarRoute.GET)).status).toBe(401);
    setSession(user);
    expect((await callRoute(googleCalendarRoute.GET)).status).toBe(403);
  });

  it("unread notification count requires a session", async () => {
    expect((await callRoute(unreadCountRoute.GET)).status).toBe(401);
    setSession(user);
    expect((await callRoute(unreadCountRoute.GET)).json.count).toBe(0);
  });
});

describe("rateLimit", () => {
  const limit = { scope: "test", key: "1.2.3.4", limit: 3, windowSec: 60 };

  it("blocks once the limit is exceeded and can be reset", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await hitRateLimit(limit)).allowed);
    expect(results).toEqual([true, true, true, false]);
    expect(await peekRateLimit(limit)).toBe(4);

    await resetRateLimit(limit);
    expect(await peekRateLimit(limit)).toBe(0);
  });

  it("does not store the IP or email in plaintext", async () => {
    await hitRateLimit({ ...limit, key: "ana@example.test" });
    const docs = await db.collection("rateLimits").find().toArray();
    expect(JSON.stringify(docs)).not.toContain("ana@example.test");
  });
});
