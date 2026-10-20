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
