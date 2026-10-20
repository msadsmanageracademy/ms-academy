// MongoDB indexes required by the app. Shared by `npm run db:migrate` and the tests.
// .mjs (no "@/" imports) so it can also be loaded by plain Node scripts.

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export const INDEXES = {
  users: [{ key: { email: 1 }, options: { unique: true, name: "email_unique" } }],
  courseEditions: [
    // Editions of a course (labels, listings) and its most recently created one (createEdition)
    { key: { courseId: 1, createdAt: 1 }, options: { name: "course_created" } },
  ],
  courseEnrollments: [
    // Prevents duplicate enrollments (also under concurrency)
    { key: { userId: 1, editionId: 1 }, options: { unique: true, name: "user_edition_unique" } },
    { key: { editionId: 1, paymentStatus: 1 }, options: { name: "edition_payment" } },
  ],
  classes: [
    { key: { editionId: 1, start_date: 1 }, options: { name: "edition_start" } },
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
      key: { userId: 1, editionId: 1 },
      options: { unique: true, name: "user_edition_review", partialFilterExpression: { editionId: { $exists: true } } },
    },
    // Course-wide listing and stats (also covers { courseId })
    { key: { courseId: 1, createdAt: -1 }, options: { name: "course_reviews" } },
    {
      key: { userId: 1, classId: 1 },
      options: { unique: true, name: "user_class_review", partialFilterExpression: { classId: { $exists: true } } },
    },
  ],
  rateLimits: [{ key: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } }],
};

/**
 * Indexes from earlier data models that must be removed: with documents that no longer
 * have `courseId`, the old unique ones would collide ({ userId, courseId: null }).
 * Collection → index names. An index moves here when its last consumer is migrated.
 */
export const OBSOLETE_INDEXES = {
  courseEnrollments: ["user_course_unique", "course_payment"],
  classes: ["course_start"],
  // One review per user and course would block reviewing a second edition of the course
  reviews: ["user_course_review"],
  // Editions no longer store a number: they are named by date (see labelEditions)
  courseEditions: ["course_number_unique"],
};

// NamespaceNotFound (collection missing) and IndexNotFound: nothing to drop
const NOTHING_TO_DROP = new Set([26, 27]);

/**
 * Drops the obsolete indexes (idempotent). Returns the dropped ones as
 * [{ collection, name }]; missing collections or indexes are skipped.
 */
export async function dropObsoleteIndexes(db, obsolete = OBSOLETE_INDEXES) {
  const dropped = [];
  for (const [collection, names] of Object.entries(obsolete)) {
    for (const name of names) {
      try {
        await db.collection(collection).dropIndex(name);
        dropped.push({ collection, name });
      } catch (error) {
        if (!NOTHING_TO_DROP.has(error?.code)) throw error;
      }
    }
  }
  return dropped;
}

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
