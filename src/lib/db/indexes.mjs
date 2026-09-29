// MongoDB indexes required by the app. Shared by `npm run db:migrate` and the tests.
// .mjs (no "@/" imports) so it can also be loaded by plain Node scripts.

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export const INDEXES = {
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
    // Notifications expire after 30 days
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

/**
 * Creates every index (idempotent). Returns one result per index:
 * { collection, key, name?, error? } — errors are reported, not thrown.
 */
export async function ensureIndexes(db) {
  const results = [];
  for (const [collection, indexes] of Object.entries(INDEXES)) {
    for (const { key, options } of indexes) {
      try {
        const name = await db.collection(collection).createIndex(key, options);
        results.push({ collection, key, name });
      } catch (error) {
        // 11000: duplicates prevent a unique index; 85/86: index exists with other options
        results.push({ collection, key, error: error.message });
      }
    }
  }
  return results;
}
