// Idempotent database migrations: indexes + data fixes.
// Safe to run many times. Usage: npm run db:migrate
// Reads MONGODB_URI / MONGODB_DB_NAME from the environment or from .env.local.
import { existsSync, readFileSync } from "fs";
import { MongoClient } from "mongodb";
import { ensureIndexes } from "../src/lib/db/indexes.mjs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

if (!process.env.MONGODB_URI || !process.env.MONGODB_DB_NAME) {
  console.error("MONGODB_URI and/or MONGODB_DB_NAME are missing");
  process.exit(1);
}

// Data fixes: { description, run(db) → number of affected documents }
const DATA_FIXES = [
  {
    // The app only reads encrypted tokens (googleCalendarTokensEnc). Plaintext tokens
    // from older versions are removed; the affected admin just reconnects Calendar.
    description: "Removed plaintext Google Calendar tokens (Calendar must be reconnected)",
    run: async (db) =>
      (
        await db.collection("users").updateMany(
          { googleCalendarTokens: { $exists: true } },
          [
            { $unset: "googleCalendarTokens" },
            {
              $set: {
                hasAuthorizedCalendar: { $ne: [{ $type: "$googleCalendarTokensEnc" }, "missing"] },
                updatedAt: "$$NOW",
              },
            },
          ],
        )
      ).modifiedCount,
  },
  {
    description: "Notifications with type 'class_cancelled' → 'class.cancelled'",
    run: async (db) =>
      (await db.collection("notifications").updateMany({ type: "class_cancelled" }, { $set: { type: "class.cancelled" } }))
        .modifiedCount,
  },
];

const client = await new MongoClient(process.env.MONGODB_URI).connect();
const db = client.db(process.env.MONGODB_DB_NAME);
let failed = false;

try {
  for (const { collection, name, key, error } of await ensureIndexes(db)) {
    if (error) {
      failed = true;
      console.error(`✗ ${collection} ${JSON.stringify(key)}: ${error}`);
    } else {
      console.log(`✓ ${collection}.${name}`);
    }
  }
  for (const fix of DATA_FIXES) {
    const affected = await fix.run(db);
    console.log(`✓ ${fix.description}: ${affected} document(s)`);
  }
} finally {
  await client.close();
}

process.exit(failed ? 1 : 0);
