import { logger } from "@/lib/logger";
import { getClient, getDb } from "@/lib/db";

/**
 * Runs `fn({ db, session, afterCommit })` inside a MongoDB transaction.
 *
 * - Every read and write in `fn` must pass `{ session }` to be part of it.
 * - `fn` may be retried by the driver on transient errors, so it must have no side
 *   effects outside the database. Register them with `afterCommit(callback)`
 *   (notifications, emails, Calendar): they run once, only after a successful commit.
 * - An error thrown by `fn` aborts the transaction (nothing is written) and is rethrown.
 *
 * Returns what `fn` returns. Requires a replica set (Atlas, or the in-memory one in tests).
 */
export async function withTransaction(fn) {
  const [client, db] = await Promise.all([getClient(), getDb()]);
  const session = client.startSession();
  let result;
  let callbacks = [];
  try {
    await session.withTransaction(async () => {
      callbacks = []; // a retried attempt starts over
      result = await fn({ db, session, afterCommit: (callback) => callbacks.push(callback) });
    });
  } finally {
    await session.endSession();
  }

  // The data is already committed: a failing side effect is logged, not returned as an error
  for (const callback of callbacks) {
    try {
      await callback();
    } catch (error) {
      logger.error("Error in after-commit callback", error);
    }
  }
  return result;
}
