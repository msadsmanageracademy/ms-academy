import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { getClient } from "@/lib/db";

/**
 * Auth.js adapter on the app database (MONGODB_DB_NAME), the same one the rest of the
 * app uses. Without `databaseName` it would use the URI's default database ("test" on
 * Atlas when the URI has no path), splitting Google users and accounts from the app ones.
 * `getClient` is a function so the adapter connects lazily, like the rest of the app.
 */
export function createAuthAdapter() {
  return MongoDBAdapter(getClient, { databaseName: process.env.MONGODB_DB_NAME });
}
