// Shared helpers for API integration tests.
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { ensureIndexes } from "@/lib/db/indexes.mjs";

export { getDb };

/** Drops every collection and recreates the app indexes. */
export async function resetDb() {
  const db = await getDb();
  await db.dropDatabase();
  const failed = (await ensureIndexes(db)).filter((r) => r.error);
  if (failed.length) throw new Error(`Index creation failed: ${JSON.stringify(failed)}`);
  return db;
}

/** Sets the session returned by the mocked `auth()`; pass null to log out. */
export function setSession(user) {
  globalThis.__testSession = user
    ? { user: { id: user._id.toString(), email: user.email, name: user.first_name, role: user.role } }
    : null;
}

/**
 * Calls a route handler like Next.js would.
 * callRoute(PATCH, { method, path, body, params })
 */
export async function callRoute(handler, { method = "GET", path = "/", body, params = {} } = {}) {
  const req = new Request(`http://localhost${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      "x-forwarded-for": "203.0.113.10",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const res = await handler(req, { params: Promise.resolve(params) });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // empty or non-JSON body
  }
  return { status: res.status, json };
}

// ---------- Factories ----------
const daysFromNow = (days) => new Date(Date.now() + days * 86400000);

export async function createUser(db, overrides = {}) {
  const now = new Date();
  const user = {
    first_name: "Test",
    last_name: "User",
    email: `user-${new ObjectId().toString()}@example.test`,
    role: "user",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  const { insertedId } = await db.collection("users").insertOne(user);
  return { ...user, _id: insertedId };
}

export const createAdmin = (db, overrides = {}) => createUser(db, { role: "admin", ...overrides });

export async function createClass(db, overrides = {}) {
  const now = new Date();
  const cls = {
    title: "Test class",
    short_description: "Test description",
    duration: 60,
    start_date: daysFromNow(7),
    price: 0,
    max_participants: null,
    status: "published",
    ...(overrides.courseId ? {} : { participants: [] }),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  const { insertedId } = await db.collection("classes").insertOne(cls);
  return { ...cls, _id: insertedId };
}

export async function createCourse(db, overrides = {}) {
  const now = new Date();
  const course = {
    title: "Test course",
    short_description: "Short description",
    full_description: "Full course description",
    price: 1000,
    max_participants: null,
    status: "published",
    type: "course",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  const { insertedId } = await db.collection("courses").insertOne(course);
  return { ...course, _id: insertedId };
}

export async function enroll(db, user, course, paymentStatus = "pending") {
  const now = new Date();
  await db.collection("courseEnrollments").insertOne({
    userId: user._id,
    courseId: course._id,
    paymentStatus,
    createdAt: now,
    updatedAt: now,
  });
}

export { daysFromNow, ObjectId };
