// 2.4: multi-step operations are all-or-nothing (tests run on an in-memory replica set).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Collection } from "mongodb";
import * as classesRoute from "@/app/api/classes/route";
import * as courseRoute from "@/app/api/courses/[id]/route";
import { confirmEditionPayment, removeEditionEnrollment } from "@/server/courses/enrollments";
import { linkClassToEdition } from "@/server/classes/service";
import { withTransaction } from "@/server/transactions";
import {
  callRoute,
  createAdmin,
  createClass,
  createCourseDoc,
  createEdition,
  createUser,
  enrollInEditionDoc,
  ObjectId,
  resetDb,
  setSession,
} from "../helpers.mjs";

const actorOf = (u) => ({ id: u._id.toString(), role: u.role, email: u.email });

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
    const edition = await createEdition(db, await createCourseDoc(db));
    await enrollInEditionDoc(db, user, edition, "pending");
    const id = edition._id.toString();

    const results = await Promise.allSettled([
      confirmEditionPayment(actorOf(admin), id, user._id.toString(), { paymentStatus: "paid" }),
      removeEditionEnrollment(actorOf(user), id, user._id.toString()),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const left = await db.collection("courseEnrollments").find().toArray();
    // Either paid and kept, or cancelled and gone: never "cancelled" but paid
    if (results[0].status === "fulfilled") expect(left).toMatchObject([{ paymentStatus: "paid" }]);
    else expect(left).toEqual([]);
  });
});

// Creating an edition from the previous one is covered in course-editions.test.mjs
describe("rollback of real operations", () => {
  it("creating a class linked to a missing edition creates nothing", async () => {
    const res = await callRoute(classesRoute.POST, {
      method: "POST",
      body: {
        title: "Linked class",
        short_description: "Class description",
        start_date: new Date(Date.now() + 7 * 86400000).toISOString(),
        duration: 60,
        price: 0,
        editionId: new ObjectId().toString(),
      },
    });
    expect(res.status).toBe(404);
    expect(await db.collection("classes").countDocuments()).toBe(0);
    expect(await db.collection("notifications").countDocuments()).toBe(0);
  });

  it("creating a class in an edition links it in the same transaction", async () => {
    const edition = await createEdition(db, await createCourseDoc(db), { status: "draft" });
    const res = await callRoute(classesRoute.POST, {
      method: "POST",
      body: {
        title: "Linked class",
        short_description: "Class description",
        start_date: new Date(Date.now() + 7 * 86400000).toISOString(),
        duration: 60,
        price: 0,
        editionId: edition._id.toString(),
      },
    });
    expect(res.status).toBe(201);
    const saved = await db.collection("classes").findOne({ _id: new ObjectId(res.json.data._id) });
    expect(saved).toMatchObject({ status: "enrolled", max_participants: null });
    expect(saved.editionId.equals(edition._id)).toBe(true);
    expect(saved).not.toHaveProperty("participants");
  });

  it("a failure while deleting a course leaves the course, its editions and classes intact", async () => {
    const course = await createCourseDoc(db);
    const edition = await createEdition(db, course, { status: "draft" });
    const cls = await createClass(db, { status: "enrolled", editionId: edition._id });
    vi.spyOn(console, "error").mockImplementation(() => {});
    failOn("deleteOne", "courses");

    const res = await callRoute(courseRoute.DELETE, { method: "DELETE", params: { id: course._id.toString() } });
    expect(res.status).toBe(500);
    expect(await db.collection("courses").countDocuments({ _id: course._id })).toBe(1);
    expect(await db.collection("courseEditions").countDocuments({ _id: edition._id })).toBe(1);
    expect((await db.collection("classes").findOne({ _id: cls._id })).editionId.equals(edition._id)).toBe(true);
    expect(await db.collection("notifications").countDocuments()).toBe(0);
  });

  it("a failure while linking a class keeps it a standalone draft", async () => {
    const edition = await createEdition(db, await createCourseDoc(db), { status: "draft" });
    const cls = await createClass(db, { status: "draft", createdBy: admin._id });
    vi.spyOn(console, "error").mockImplementation(() => {});
    failOn("updateOne", "classes");

    await expect(linkClassToEdition(actorOf(admin), cls._id.toString(), { editionId: edition._id.toString() })).rejects.toThrow(
      "simulated",
    );
    const saved = await db.collection("classes").findOne({ _id: cls._id });
    expect(saved).toMatchObject({ status: "draft", participants: [] });
    expect(saved).not.toHaveProperty("editionId");
    expect(await db.collection("notifications").countDocuments()).toBe(0);
  });
});
