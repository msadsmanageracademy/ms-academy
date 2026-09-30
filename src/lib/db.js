import { MongoClient } from "mongodb";

// The connection opens lazily, on the first query. Importing this module (e.g. during
// `next build`, or in CI without a database) doesn't connect nor require MONGODB_URI.

function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (check .env.local)");
  return new MongoClient(uri)
    .connect()
    .catch((error) => {
      // A failed attempt is not cached: the next query tries again
      globalThis._mongoClientPromise = undefined;
      throw error;
    });
}

/**
 * Returns the shared, connected MongoClient (needed e.g. to start transactions).
 * Cached on globalThis so dev hot reloads reuse the same connection.
 */
export function getClient() {
  globalThis._mongoClientPromise ??= connect();
  return globalThis._mongoClientPromise;
}

/** Returns the app database (MONGODB_DB_NAME) from the shared client. */
export async function getDb() {
  return (await getClient()).db(process.env.MONGODB_DB_NAME);
}
