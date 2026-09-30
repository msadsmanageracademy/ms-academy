// 1.17: the Auth.js adapter works on the app database (MONGODB_DB_NAME).
// Replays the adapter calls Auth.js makes on a Google sign-in.
import { beforeEach, describe, expect, it } from "vitest";
import { getClient } from "@/lib/db";
import { createAuthAdapter } from "@/lib/authAdapter";
import { createUser, resetDb } from "../helpers.mjs";

const googleAccount = (userId, providerAccountId = "google-123") => ({
  userId,
  type: "oidc",
  provider: "google",
  providerAccountId,
  access_token: "access",
  token_type: "bearer",
});

let db, adapter;

beforeEach(async () => {
  db = await resetDb();
  adapter = createAuthAdapter();
});

describe("Auth.js adapter", () => {
  it("uses the app database, not the URI's default one", async () => {
    expect(db.databaseName).toBe(process.env.MONGODB_DB_NAME);
    const defaultDb = (await getClient()).db();
    expect(defaultDb.databaseName).not.toBe(db.databaseName);

    const existing = await createUser(db, { email: "ana@example.test" });
    expect((await adapter.getUserByEmail("ana@example.test")).id).toBe(existing._id.toString());
  });

  it("first Google sign-in of an existing user links the account to that same user", async () => {
    const existing = await createUser(db, { email: "ana@example.test" });

    // Auth.js: no account for this Google id yet → look up by email → link
    expect(await adapter.getUserByAccount({ provider: "google", providerAccountId: "google-123" })).toBeNull();
    const byEmail = await adapter.getUserByEmail("ana@example.test");
    await adapter.linkAccount(googleAccount(byEmail.id));

    const accounts = await db.collection("accounts").find().toArray();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].userId.equals(existing._id)).toBe(true);
    // Next sign-ins resolve directly through the account
    const again = await adapter.getUserByAccount({ provider: "google", providerAccountId: "google-123" });
    expect(again.id).toBe(existing._id.toString());
    expect(await db.collection("users").countDocuments()).toBe(1);
  });

  it("a new Google user is created in the app database", async () => {
    const created = await adapter.createUser({ email: "new@example.test", name: "New", emailVerified: null });
    await adapter.linkAccount(googleAccount(created.id, "google-456"));

    const saved = await db.collection("users").findOne({ email: "new@example.test" });
    expect(saved._id.toString()).toBe(created.id);
    expect(await db.collection("accounts").countDocuments({ userId: saved._id })).toBe(1);
  });
});
