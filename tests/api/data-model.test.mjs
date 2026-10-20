// courseEnrollments (per edition) is the single source of edition class participants.
// course-editions: edition indexes, removal of obsolete indexes and the db:migrate data fixes.
import { beforeEach, describe, expect, it } from "vitest";
import * as classesRoute from "@/app/api/classes/route";
import * as classRoute from "@/app/api/classes/[id]/route";
import * as classReviewsRoute from "@/app/api/classes/[id]/reviews/route";
import { getAdminCourse, getCourseDetail, listAdminCourses } from "@/server/courses/service";
import { runDataFixes } from "@/lib/db/dataFixes.mjs";
import { OBSOLETE_INDEXES, dropObsoleteIndexes, ensureIndexes } from "@/lib/db/indexes.mjs";
import {
  callRoute,
  createAdmin,
  createClass,
  createCourseDoc,
  createEdition,
  createUser,
  daysFromNow,
  enrollInEditionDoc,
  resetDb,
  setSession,
} from "../helpers.mjs";

let db, admin, user, other;

beforeEach(async () => {
  db = await resetDb();
  admin = await createAdmin(db);
  user = await createUser(db);
  other = await createUser(db);
  setSession(null);
});

describe("edition classes derive their participants from the edition enrollments", () => {
  it("admin detail lists the enrollees; students only get the count", async () => {
    const edition = await createEdition(db, await createCourseDoc(db));
    const cls = await createClass(db, { status: "enrolled", editionId: edition._id });
    await enrollInEditionDoc(db, user, edition, "paid");
    await enrollInEditionDoc(db, other, edition, "pending");

    setSession(admin);
    let data = (await callRoute(classRoute.GET, { params: { id: cls._id.toString() } })).json.data;
    expect(data.participants.sort()).toEqual([user._id.toString(), other._id.toString()].sort());

    setSession(other);
    data = (await callRoute(classRoute.GET, { params: { id: cls._id.toString() } })).json.data;
    expect(data).toMatchObject({ participantsCount: 2, isParticipant: true, userEditionPaymentStatus: "pending" });
    expect(data).not.toHaveProperty("participants");
  });

  it("admin listings count enrollees for edition classes and stored participants otherwise", async () => {
    const course = await createCourseDoc(db);
    const edition = await createEdition(db, course);
    const otherEdition = await createEdition(db, course);
    await createClass(db, { status: "enrolled", editionId: edition._id, title: "Edition class" });
    await createClass(db, { participants: [other._id], title: "Standalone" });
    await enrollInEditionDoc(db, user, edition);
    await enrollInEditionDoc(db, other, edition);
    // Enrollees of another edition of the same course do not count
    await enrollInEditionDoc(db, admin, otherEdition);

    setSession(admin);
    const rows = (await callRoute(classesRoute.GET, { path: "/api/classes?showAll=true" })).json.data;
    const count = (title) => rows.find((r) => r.title === title).participantsCount;
    expect(count("Edition class")).toBe(2);
    expect(count("Standalone")).toBe(1);

    const editionRows = (await callRoute(classesRoute.GET, { path: `/api/classes?editionId=${edition._id}` })).json.data;
    expect(editionRows[0].participantsCount).toBe(2);
  });

  it("myClasses never exposes other students' ids", async () => {
    await createClass(db, { participants: [user._id, other._id] });
    setSession(user);
    const [row] = (await callRoute(classesRoute.GET, { path: "/api/classes?myClasses=true" })).json.data;
    expect(row).not.toHaveProperty("participants");
    expect(row).not.toHaveProperty("createdBy");
    expect(row.participantsCount).toBe(2);
  });

  it("course responses never include a legacy participants field", async () => {
    const course = await createCourseDoc(db, { participants: [user._id] });
    await createEdition(db, course);
    const actor = { id: admin._id.toString(), role: "admin" };
    const [row] = await listAdminCourses(actor);
    expect(row).not.toHaveProperty("participants");
    expect(await getAdminCourse(actor, course._id.toString())).not.toHaveProperty("participants");
    expect(await getCourseDetail(actor, course._id.toString())).not.toHaveProperty("participants");
  });

  it("only paid enrollees can review an ended edition class", async () => {
    const edition = await createEdition(db, await createCourseDoc(db));
    const cls = await createClass(db, {
      status: "enrolled",
      editionId: edition._id,
      start_date: daysFromNow(-2),
      duration: 60,
    });
    await enrollInEditionDoc(db, user, edition, "paid");
    await enrollInEditionDoc(db, other, edition, "pending");
    const review = () =>
      callRoute(classReviewsRoute.POST, { method: "POST", body: { rating: 5 }, params: { id: cls._id.toString() } });

    setSession(other);
    expect((await review()).status).toBe(403);
    setSession(user);
    expect((await review()).status).toBe(200);
  });
  // Deleting a course with enrollments is now refused (archive instead): see course-service.test.mjs
});

describe("course editions indexes", () => {
  it("allows one enrollment per user and edition, and the same user in two editions", async () => {
    const course = await createCourseDoc(db);
    const first = await createEdition(db, course);
    const second = await createEdition(db, course);
    await enrollInEditionDoc(db, user, first);
    await enrollInEditionDoc(db, other, first, "paid");
    await expect(enrollInEditionDoc(db, user, first)).rejects.toMatchObject({ code: 11000 });
    await enrollInEditionDoc(db, user, second);
    expect(await db.collection("courseEnrollments").countDocuments({ editionId: first._id })).toBe(2);
    expect(await db.collection("courseEnrollments").countDocuments({ userId: user._id })).toBe(2);
  });

  it("no longer defines the per-course indexes and lists them as obsolete", async () => {
    const names = async (collection) => (await db.collection(collection).indexes()).map((i) => i.name);
    expect(await names("courseEnrollments")).not.toContain("user_course_unique");
    expect(await names("courseEnrollments")).not.toContain("course_payment");
    expect(await names("classes")).not.toContain("course_start");
    expect(await names("reviews")).not.toContain("user_course_review");
    expect(await names("courseEditions")).not.toContain("course_number_unique");
    expect(OBSOLETE_INDEXES).toMatchObject({
      courseEnrollments: expect.arrayContaining(["user_course_unique", "course_payment"]),
      classes: ["course_start"],
      reviews: ["user_course_review"],
      courseEditions: ["course_number_unique"],
    });

    // A database migrated from the per-course model loses them
    await db.collection("courseEnrollments").createIndex({ userId: 1, courseId: 1 }, { unique: true, name: "user_course_unique" });
    await db.collection("classes").createIndex({ courseId: 1, start_date: 1 }, { name: "course_start" });
    await db.collection("reviews").createIndex(
      { userId: 1, courseId: 1 },
      { unique: true, name: "user_course_review", partialFilterExpression: { courseId: { $exists: true } } },
    );
    // ...and a database from the numbered-editions model loses the unique edition number
    await db.collection("courseEditions").createIndex({ courseId: 1, number: 1 }, { unique: true, name: "course_number_unique" });
    const dropped = await dropObsoleteIndexes(db);
    expect(dropped).toEqual(
      expect.arrayContaining([
        { collection: "courseEnrollments", name: "user_course_unique" },
        { collection: "classes", name: "course_start" },
        { collection: "reviews", name: "user_course_review" },
        { collection: "courseEditions", name: "course_number_unique" },
      ]),
    );
    expect(await names("courseEditions")).not.toContain("course_number_unique");
    expect(await names("courseEnrollments")).not.toContain("user_course_unique");
    expect(await names("reviews")).not.toContain("user_course_review");
  });

  it("lets a student review two editions of the same course", async () => {
    const course = await createCourseDoc(db);
    const first = await createEdition(db, course);
    const second = await createEdition(db, course);
    const now = new Date();
    const review = (edition) => ({ userId: user._id, courseId: course._id, editionId: edition._id, rating: 5, createdAt: now });
    await db.collection("reviews").insertMany([review(first), review(second)]);
    await expect(db.collection("reviews").insertOne(review(first))).rejects.toMatchObject({ code: 11000 });
    expect(await db.collection("reviews").countDocuments({ userId: user._id, courseId: course._id })).toBe(2);
  });

  it("creates the edition indexes", async () => {
    const names = async (collection) => (await db.collection(collection).indexes()).map((i) => i.name);
    expect(await names("courseEditions")).toContain("course_created");
    expect(await names("courseEditions")).not.toContain("course_number_unique");
    expect(await names("courseEnrollments")).toEqual(expect.arrayContaining(["user_edition_unique", "edition_payment"]));
    expect(await names("classes")).toContain("edition_start");
    expect(await names("reviews")).toEqual(expect.arrayContaining(["user_edition_review", "course_reviews"]));

    const index = async (collection, name) => (await db.collection(collection).indexes()).find((i) => i.name === name);
    const created = await index("courseEditions", "course_created");
    expect(created.key).toEqual({ courseId: 1, createdAt: 1 });
    expect(created).not.toHaveProperty("unique");
    expect(await index("courseEnrollments", "user_edition_unique")).toMatchObject({
      key: { userId: 1, editionId: 1 },
      unique: true,
    });
    expect(await index("reviews", "user_edition_review")).toMatchObject({
      key: { userId: 1, editionId: 1 },
      unique: true,
      partialFilterExpression: { editionId: { $exists: true } },
    });
  });
});

describe("dropObsoleteIndexes", () => {
  const obsolete = { courseEnrollments: ["legacy_unique"], classes: ["legacy_start"], missingCollection: ["x"] };

  it("drops the listed indexes and is idempotent", async () => {
    await db.collection("courseEnrollments").createIndex({ userId: 1, legacy: 1 }, { unique: true, name: "legacy_unique" });
    await db.collection("classes").createIndex({ legacy: 1 }, { name: "legacy_start" });

    expect(await dropObsoleteIndexes(db, obsolete)).toEqual([
      { collection: "courseEnrollments", name: "legacy_unique" },
      { collection: "classes", name: "legacy_start" },
    ]);
    const names = (await db.collection("courseEnrollments").indexes()).map((i) => i.name);
    expect(names).not.toContain("legacy_unique");
    // The app indexes are kept
    expect(names).toContain("user_edition_unique");

    // Second run (indexes and collection already gone): nothing to drop, no error
    expect(await dropObsoleteIndexes(db, obsolete)).toEqual([]);
  });

  it("is a no-op on a database without the old indexes, then ensureIndexes still succeeds", async () => {
    await db.dropDatabase();
    expect(await dropObsoleteIndexes(db, obsolete)).toEqual([]);
    expect(await dropObsoleteIndexes(db)).toEqual([]);
    expect((await ensureIndexes(db)).filter((r) => r.error)).toEqual([]);
  });
});

describe("db:migrate data fixes", () => {
  it("removes plaintext Calendar tokens, renames old notification types and is idempotent", async () => {
    const legacy = await createAdmin(db, { googleCalendarTokens: { access_token: "plain" } });
    const migrated = await createAdmin(db, { googleCalendarTokens: { access_token: "plain" }, googleCalendarTokensEnc: "enc" });
    const now = new Date();
    await db.collection("notifications").insertMany([
      { userId: user._id, type: "class_cancelled", createdAt: now },
      { userId: user._id, type: "class.cancelled", createdAt: now },
    ]);

    expect(await runDataFixes(db)).toEqual([
      { description: "Removed plaintext Google Calendar tokens (Calendar must be reconnected)", affected: 2 },
      { description: "Notifications with type 'class_cancelled' → 'class.cancelled'", affected: 1 },
    ]);
    const after = (u) => db.collection("users").findOne({ _id: u._id });
    expect(await after(legacy)).toMatchObject({ hasAuthorizedCalendar: false });
    expect(await after(migrated)).toMatchObject({ hasAuthorizedCalendar: true, googleCalendarTokensEnc: "enc" });
    expect(await db.collection("users").countDocuments({ googleCalendarTokens: { $exists: true } })).toBe(0);
    expect(await db.collection("notifications").countDocuments({ type: "class.cancelled" })).toBe(2);

    const second = await runDataFixes(db);
    expect(second.every(({ affected }) => affected === 0)).toBe(true);
  });

  it("no longer runs the per-course participants fixes", async () => {
    const descriptions = (await runDataFixes(db)).map((r) => r.description).join("\n");
    expect(descriptions).not.toMatch(/participants/i);
  });
});
