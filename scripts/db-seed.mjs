// Demo data seed: wipes the course data and recreates the scenario of src/lib/db/seedData.mjs.
// DESTRUCTIVE. Usage: npm run db:seed -- --yes
// Deletes courses, courseEditions, classes, courseEnrollments, reviews, notifications and the
// demo-* users; every other user is kept. Reads MONGODB_URI / MONGODB_DB_NAME / ADMIN_USER_ID
// from the environment or from .env.local. Passwords are random and never printed.
import { randomBytes } from "crypto";
import { existsSync, readFileSync } from "fs";
import bcrypt from "bcryptjs";
import { MongoClient, ObjectId } from "mongodb";
import { dropObsoleteIndexes, ensureIndexes } from "../src/lib/db/indexes.mjs";
import {
  DEMO_EMAIL_PATTERN,
  DEMO_USERS,
  OWN_USER_EMAIL,
  SEED_USAGE,
  buildSeedData,
  checkSeedPreconditions,
} from "../src/lib/db/seedData.mjs";

const BCRYPT_ROUNDS = 12;
const WIPED_COLLECTIONS = ["courses", "courseEditions", "classes", "courseEnrollments", "reviews", "notifications"];

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const argv = process.argv.slice(2);
const env = process.env;

function fail(result) {
  console.error(`✗ ${result.error}`);
  if (result.usage) console.log(SEED_USAGE);
  process.exit(1);
}

// Without --yes, env or a valid ADMIN_USER_ID nothing is even read from the database
const early = checkSeedPreconditions({ argv, env });
if (early) fail(early);

const client = await new MongoClient(env.MONGODB_URI).connect();
const db = client.db(env.MONGODB_DB_NAME);
let failed = false;

try {
  console.log(`Target database: ${db.databaseName}`);

  const adminUser = await db
    .collection("users")
    .findOne({ _id: new ObjectId(env.ADMIN_USER_ID) }, { projection: { role: 1 } });
  const precondition = checkSeedPreconditions({ argv, env, adminUser });
  if (precondition) {
    await client.close();
    fail(precondition);
  }

  const ownUser = await db.collection("users").findOne({ email: OWN_USER_EMAIL }, { projection: { _id: 1 } });
  if (!ownUser) console.warn(`! ${OWN_USER_EMAIL} not found: its demo enrollments are skipped`);

  for (const name of WIPED_COLLECTIONS) {
    const { deletedCount } = await db.collection(name).deleteMany({});
    console.log(`✓ deleted ${deletedCount} document(s) from ${name}`);
  }
  const { deletedCount: demoDeleted } = await db.collection("users").deleteMany({ email: DEMO_EMAIL_PATTERN });
  console.log(`✓ deleted ${demoDeleted} demo user(s)`);

  // Before creating the new ones: an old unique index could reject the new documents
  for (const { collection, name } of await dropObsoleteIndexes(db)) {
    console.log(`✓ dropped obsolete index ${collection}.${name}`);
  }
  for (const { collection, key, error } of await ensureIndexes(db)) {
    if (error) {
      failed = true;
      console.error(`✗ ${collection} ${JSON.stringify(key)}: ${error}`);
    }
  }
  if (failed) throw new Error("Some indexes could not be created");

  const now = new Date();
  const demoUsers = await Promise.all(
    DEMO_USERS.map(async (profile) => ({
      _id: new ObjectId(),
      ...profile,
      password: await bcrypt.hash(randomBytes(18).toString("base64url"), BCRYPT_ROUNDS),
      role: "user",
      createdAt: now,
      updatedAt: now,
    })),
  );
  await db.collection("users").insertMany(demoUsers);

  const data = buildSeedData({
    now,
    adminId: adminUser._id,
    ownUserId: ownUser?._id ?? null,
    demoUsers,
  });
  for (const [name, docs] of Object.entries(data)) {
    if (docs.length) await db.collection(name).insertMany(docs);
  }

  console.log("Documents per collection:");
  for (const name of WIPED_COLLECTIONS) {
    console.log(`  ${name}: ${await db.collection(name).countDocuments()}`);
  }
  console.log(`  users (demo-*): ${await db.collection("users").countDocuments({ email: DEMO_EMAIL_PATTERN })}`);
} catch (error) {
  failed = true;
  console.error(`✗ ${error.message}`);
} finally {
  await client.close();
}

process.exit(failed ? 1 : 0);
