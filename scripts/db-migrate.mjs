// Idempotent database migrations: indexes + data fixes.
// Safe to run many times. Usage: npm run db:migrate
// Reads MONGODB_URI / MONGODB_DB_NAME from the environment or from .env.local.
import { existsSync, readFileSync } from "fs";
import { MongoClient } from "mongodb";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

if (!process.env.MONGODB_URI || !process.env.MONGODB_DB_NAME) {
  console.error("Faltan MONGODB_URI y/o MONGODB_DB_NAME");
  process.exit(1);
}

const THIRTY_DAYS = 60 * 60 * 24 * 30;

const INDEXES = {
  users: [{ key: { email: 1 }, options: { unique: true, name: "email_unique" } }],
  courseEnrollments: [
    // Prevents duplicate enrollments (also under concurrency)
    { key: { userId: 1, courseId: 1 }, options: { unique: true, name: "user_course_unique" } },
    { key: { courseId: 1, paymentStatus: 1 }, options: { name: "course_payment" } },
  ],
  classes: [
    { key: { courseId: 1, start_date: 1 }, options: { name: "course_start" } },
    { key: { status: 1, start_date: 1 }, options: { name: "status_start" } },
    { key: { participants: 1 }, options: { name: "participants" } },
  ],
  notifications: [
    { key: { userId: 1, createdAt: -1 }, options: { name: "user_created" } },
    // Replaces the manual cleanup that ran on every GET /api/notifications
    { key: { createdAt: 1 }, options: { expireAfterSeconds: THIRTY_DAYS, name: "ttl_30_days" } },
  ],
  reviews: [
    {
      key: { userId: 1, courseId: 1 },
      options: { unique: true, name: "user_course_review", partialFilterExpression: { courseId: { $exists: true } } },
    },
    {
      key: { userId: 1, classId: 1 },
      options: { unique: true, name: "user_class_review", partialFilterExpression: { classId: { $exists: true } } },
    },
  ],
  rateLimits: [{ key: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } }],
};

// Data fixes: { description, run(db) → number of affected documents }
const DATA_FIXES = [
  {
    // The app only reads encrypted tokens (googleCalendarTokensEnc). Plaintext tokens
    // from older versions are removed; the affected admin just reconnects Calendar.
    description: "Tokens de Google Calendar en texto plano eliminados (hay que reconectar Calendar)",
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
    description: "Notificaciones con type 'class_cancelled' → 'class.cancelled'",
    run: async (db) =>
      (await db.collection("notifications").updateMany({ type: "class_cancelled" }, { $set: { type: "class.cancelled" } }))
        .modifiedCount,
  },
];

const client = await new MongoClient(process.env.MONGODB_URI).connect();
const db = client.db(process.env.MONGODB_DB_NAME);
let failed = false;

try {
  for (const [collection, indexes] of Object.entries(INDEXES)) {
    for (const { key, options } of indexes) {
      try {
        const name = await db.collection(collection).createIndex(key, options);
        console.log(`✓ ${collection}.${name}`);
      } catch (error) {
        failed = true;
        // 11000: duplicates prevent a unique index; 85/86: index exists with other options
        console.error(`✗ ${collection} ${JSON.stringify(key)}: ${error.message}`);
      }
    }
  }
  for (const fix of DATA_FIXES) {
    const affected = await fix.run(db);
    console.log(`✓ ${fix.description}: ${affected} documento(s)`);
  }
} finally {
  await client.close();
}

process.exit(failed ? 1 : 0);
