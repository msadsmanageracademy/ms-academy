// Idempotent data fixes run by `npm run db:migrate` (in this order, after the indexes).
// .mjs (no "@/" imports) so it can also be loaded by plain Node scripts and the tests.
// Each fix: { description, run(db) → number of affected documents }

export const DATA_FIXES = [
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
  // ---- 2.3: courseEnrollments is the single source of course participants ----
  {
    // Legacy courses.participants held the paid users. Anyone listed there without an
    // enrollment gets a paid one, so no access is lost when the field is removed.
    description: "Paid enrollments created for legacy course participants without one",
    run: async (db) => {
      let created = 0;
      const courses = db
        .collection("courses")
        .find({ "participants.0": { $exists: true } }, { projection: { participants: 1 } });
      for await (const course of courses) {
        for (const userId of course.participants) {
          const now = new Date();
          const result = await db.collection("courseEnrollments").updateOne(
            { userId, courseId: course._id },
            { $setOnInsert: { paymentStatus: "paid", paidAt: now, createdAt: now, updatedAt: now } },
            { upsert: true },
          );
          created += result.upsertedCount;
        }
      }
      return created;
    },
  },
  {
    description: "Removed courses.participants (enrollments are the source)",
    run: async (db) =>
      (
        await db
          .collection("courses")
          .updateMany({ participants: { $exists: true } }, { $unset: { participants: "" } })
      ).modifiedCount,
  },
  {
    description: "Removed participants copied into course classes",
    run: async (db) =>
      (
        await db
          .collection("classes")
          .updateMany(
            { courseId: { $exists: true }, participants: { $exists: true } },
            { $unset: { participants: "" } },
          )
      ).modifiedCount,
  },
  {
    description: "Notifications with type 'class_cancelled' → 'class.cancelled'",
    run: async (db) =>
      (
        await db
          .collection("notifications")
          .updateMany({ type: "class_cancelled" }, { $set: { type: "class.cancelled" } })
      ).modifiedCount,
  },
];

/** Runs every fix in order. Returns [{ description, affected }]. */
export async function runDataFixes(db) {
  const results = [];
  for (const fix of DATA_FIXES) {
    results.push({ description: fix.description, affected: await fix.run(db) });
  }
  return results;
}
