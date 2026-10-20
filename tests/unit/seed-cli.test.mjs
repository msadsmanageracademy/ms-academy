// Seed preconditions (checkSeedPreconditions) and the CLI refusing to run without them.
// The CLI runs from an empty temp dir with a minimal env: it can never reach a database.
import { spawnSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { fileURLToPath } from "url";
import { afterAll, describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { DEMO_USERS, OWN_USER_EMAIL, buildSeedData, checkSeedPreconditions } from "@/lib/db/seedData.mjs";

const SCRIPT = fileURLToPath(new URL("../../scripts/db-seed.mjs", import.meta.url));
const ENV = {
  MONGODB_URI: "mongodb://127.0.0.1:1",
  MONGODB_DB_NAME: "seed_test",
  ADMIN_USER_ID: new ObjectId().toString(),
};
const YES = ["--yes"];

describe("checkSeedPreconditions", () => {
  it("requires --yes and shows the usage", () => {
    expect(checkSeedPreconditions({ argv: [], env: ENV })).toEqual({
      error: expect.stringContaining("--yes"),
      usage: true,
    });
    expect(checkSeedPreconditions({ argv: ["--force"], env: ENV, adminUser: { role: "admin" } })).toMatchObject({
      usage: true,
    });
  });

  it("requires the database settings", () => {
    expect(checkSeedPreconditions({ argv: YES, env: { ...ENV, MONGODB_URI: "" } })).toMatchObject({
      error: expect.stringContaining("MONGODB_URI"),
      usage: false,
    });
    expect(checkSeedPreconditions({ argv: YES, env: { ...ENV, MONGODB_DB_NAME: undefined } })).toMatchObject({
      error: expect.stringContaining("MONGODB_DB_NAME"),
    });
  });

  it("requires a valid ADMIN_USER_ID", () => {
    expect(checkSeedPreconditions({ argv: YES, env: { ...ENV, ADMIN_USER_ID: undefined } })).toMatchObject({
      error: expect.stringContaining("ADMIN_USER_ID"),
    });
    expect(checkSeedPreconditions({ argv: YES, env: { ...ENV, ADMIN_USER_ID: "not-an-id" } })).toMatchObject({
      error: expect.stringContaining("ADMIN_USER_ID"),
    });
  });

  it("requires ADMIN_USER_ID to be an existing admin once looked up", () => {
    // Not looked up yet: only argv and env are checked
    expect(checkSeedPreconditions({ argv: YES, env: ENV })).toBeNull();
    expect(checkSeedPreconditions({ argv: YES, env: ENV, adminUser: null })).toMatchObject({
      error: "ADMIN_USER_ID does not match any user",
    });
    expect(checkSeedPreconditions({ argv: YES, env: ENV, adminUser: { role: "user" } })).toMatchObject({
      error: "ADMIN_USER_ID is not an admin user",
    });
    expect(checkSeedPreconditions({ argv: YES, env: ENV, adminUser: { role: "admin" } })).toBeNull();
  });
});

describe("own account", () => {
  const demoUsers = DEMO_USERS.map((profile) => ({ ...profile, _id: new ObjectId() }));
  const demoIds = new Set(demoUsers.map((u) => String(u._id)));

  it(`skips the ${OWN_USER_EMAIL} enrollments when the account is missing`, () => {
    const withOwn = buildSeedData({ adminId: new ObjectId(), ownUserId: new ObjectId(), demoUsers });
    const without = buildSeedData({ adminId: new ObjectId(), ownUserId: null, demoUsers });

    expect(without.courseEnrollments.every((e) => demoIds.has(String(e.userId)))).toBe(true);
    expect(without.classes.flatMap((c) => c.participants ?? []).every((id) => demoIds.has(String(id)))).toBe(true);
    expect(withOwn.courseEnrollments.length - without.courseEnrollments.length).toBe(3);
    // The rest of the scenario does not change
    expect(without.courses).toHaveLength(withOwn.courses.length);
    expect(without.courseEditions).toHaveLength(withOwn.courseEditions.length);
    expect(without.classes).toHaveLength(withOwn.classes.length);
    expect(without.reviews).toHaveLength(withOwn.reviews.length);
  });

  it("enrolls the own account in some editions (paid and pending) without reviews", () => {
    const ownUserId = new ObjectId();
    const data = buildSeedData({ adminId: new ObjectId(), ownUserId, demoUsers });
    const own = data.courseEnrollments.filter((e) => e.userId.equals(ownUserId));
    expect(own.map((e) => e.paymentStatus).sort()).toEqual(["paid", "paid", "pending"]);
    expect(data.reviews.some((r) => r.userId.equals(ownUserId))).toBe(false);
  });
});

describe("db-seed CLI", () => {
  const cwd = mkdtempSync(join(tmpdir(), "seed-cli-"));
  const minimalEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot };
  const run = (args, env = {}) =>
    spawnSync(process.execPath, [SCRIPT, ...args], { cwd, env: { ...minimalEnv, ...env }, encoding: "utf8" });

  afterAll(() => rmSync(cwd, { recursive: true, force: true }));

  it("prints the usage and exits with code 1 without --yes", () => {
    const result = run([], ENV);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Usage: npm run db:seed -- --yes");
    expect(result.stdout).not.toContain("Target database");
  });

  it("exits with code 1 when ADMIN_USER_ID is missing", () => {
    const result = run(YES, { ...ENV, ADMIN_USER_ID: "" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ADMIN_USER_ID");
    expect(result.stdout).not.toContain("Target database");
  });
});
