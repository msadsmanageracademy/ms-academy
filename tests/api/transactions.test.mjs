// 2.4: multi-step operations are all-or-nothing (tests run on an in-memory replica set).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Collection } from "mongodb";
import * as classesRoute from "@/app/api/classes/route";
import * as courseRoute from "@/app/api/courses/[id]/route";
import * as cloneRoute from "@/app/api/courses/[id]/clone/route";
import * as enrollmentRoute from "@/app/api/courses/[id]/enrollments/[userId]/route";
import { withTransaction } from "@/server/transactions";
import {
  callRoute,
  createAdmin,
  createClass,
  createCourse,
  createUser,
  enroll,
  ObjectId,
  resetDb,
  setSession,
} from "../helpers.mjs";

let db, admin, user;

beforeEach(async () => {
  db = await resetDb();
  admin = await createAdmin(db);
  user = await createUser(db);
  setSession(admin);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Makes `method` fail on one collection only (the rest keeps working). */
function failOn(method, collectionName) {
  const original = Collection.prototype[method];
  vi.spyOn(Collection.prototype, method).mockImplementation(function (...args) {
    if (this.collectionName === collectionName) return Promise.reject(new Error(`simulated ${method} failure`));
    return original.apply(this, args);
  });
}

describe("withTransaction", () => {
  it("commits and then runs the after-commit callbacks", async () => {
    const order = [];
    const result = await withTransaction(async ({ db: txDb, session, afterCommit }) => {
      await txDb.collection("things").insertOne({ n: 1 }, { session });
      afterCommit(() => order.push("after"));
      order.push("inside");
      return "done";
    });
    expect(result).toBe("done");
    expect(order).toEqual(["inside", "after"]);
    expect(await db.collection("things").countDocuments()).toBe(1);
  });

  it("an error aborts everything and skips the callbacks", async () => {
    const after = vi.fn();
    await expect(
      withTransaction(async ({ db: txDb, session, afterCommit }) => {
        await txDb.collection("things").insertOne({ n: 1 }, { session });
        afterCommit(after);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(after).not.toHaveBeenCalled();
    expect(await db.collection("things").countDocuments()).toBe(0);
  });

  it("a failing callback is logged without undoing the commit", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await withTransaction(async ({ db: txDb, session, afterCommit }) => {
      await txDb.collection("things").insertOne({ n: 1 }, { session });
      afterCommit(() => {
        throw new Error("email down");
      });
      return 42;
    });
    expect(result).toBe(42);
    expect(log).toHaveBeenCalled();
    expect(await db.collection("things").countDocuments()).toBe(1);
  });
});

describe("conditional writes under concurrency", () => {
  it("confirming a payment while the student cancels: exactly one of them wins", async () => {
    const course = await createCourse(db);
    await enroll(db, user, course, "pending");
    const params = { id: course._id.toString(), userId: user._id.toString() };

    setSession(admin);
    const confirm = callRoute(enrollmentRoute.PATCH, { method: "PATCH", body: { paymentStatus: "paid" }, params });
    setSession(user);
    const cancel = callRoute(enrollmentRoute.DELETE, { method: "DELETE", params });
    const statuses = (await Promise.all([confirm, cancel])).map((r) => r.status);

    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    const left = await db.collection("courseEnrollments").find().toArray();
    // Either paid and kept, or cancelled and gone: never "cancelled" but paid
    if (statuses[0] === 200) expect(left).toMatchObject([{ paymentStatus: "paid" }]);
    else expect(left).toEqual([]);
  });
});

describe("rollback of real operations", () => {
  it("creating a class linked to a missing course creates nothing", async () => {
    const res = await callRoute(classesRoute.POST, {
      method: "POST",
      body: {
        title: "Linked class",
        short_description: "Class description",
        start_date: new Date(Date.now() + 7 * 86400000).toISOString(),
        duration: 60,
        price: 0,
        courseId: new ObjectId().toString(),
      },
    });
    expect(res.status).toBe(404);
    expect(await db.collection("classes").countDocuments()).toBe(0);
    expect(await db.collection("notifications").countDocuments()).toBe(0);
  });

  it("a failure while deleting a course leaves the course, its classes and enrollments intact", async () => {
    const course = await createCourse(db, { status: "draft" });
    const cls = await createClass(db, { status: "enrolled", courseId: course._id });
    await enroll(db, user, course, "paid");
    vi.spyOn(console, "error").mockImplementation(() => {});
    failOn("deleteOne", "courses");

    const res = await callRoute(courseRoute.DELETE, { method: "DELETE", params: { id: course._id.toString() } });
    expect(res.status).toBe(500);
    expect(await db.collection("courses").countDocuments({ _id: course._id })).toBe(1);
    expect((await db.collection("classes").findOne({ _id: cls._id })).courseId.equals(course._id)).toBe(true);
    expect(await db.collection("courseEnrollments").countDocuments({ courseId: course._id })).toBe(1);
    expect(await db.collection("notifications").countDocuments()).toBe(0);
  });

  it("a failure while copying the classes leaves no half-cloned course", async () => {
    const course = await createCourse(db, { status: "draft" });
    await createClass(db, { status: "enrolled", courseId: course._id });
    vi.spyOn(console, "error").mockImplementation(() => {});
    failOn("insertMany", "classes");

    const res = await callRoute(cloneRoute.POST, { method: "POST", params: { id: course._id.toString() } });
    expect(res.status).toBe(500);
    expect(await db.collection("courses").countDocuments()).toBe(1);
    expect(await db.collection("classes").countDocuments()).toBe(1);
  });

  it("a successful clone copies the course and its classes in the same series", async () => {
    const course = await createCourse(db, { status: "published" });
    await db.collection("courses").updateOne({ _id: course._id }, { $set: { courseSeriesId: course._id } });
    await createClass(db, { status: "enrolled", courseId: course._id, recording_url: "https://example.test/r" });

    const res = await callRoute(cloneRoute.POST, { method: "POST", params: { id: course._id.toString() } });
    expect(res.status).toBe(201);
    const copy = await db.collection("courses").findOne({ _id: new ObjectId(res.json.data._id) });
    expect(copy).toMatchObject({ status: "draft" });
    expect(copy.courseSeriesId.equals(course._id)).toBe(true);
    const [copiedClass] = await db.collection("classes").find({ courseId: copy._id }).toArray();
    expect(copiedClass).toMatchObject({ status: "enrolled", start_date: null, resources: [] });
    expect(copiedClass.recording_url).toBeUndefined();
  });
});
