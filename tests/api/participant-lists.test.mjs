// 3.1: participant lists in one request (replaces one /api/users/[id] call per participant).
import { beforeEach, describe, expect, it } from "vitest";
import * as classParticipantsRoute from "@/app/api/classes/[id]/participants/route";
import * as courseEnrollmentsRoute from "@/app/api/courses/[id]/enrollments/route";
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

let db, admin, ana, bruno;

beforeEach(async () => {
  db = await resetDb();
  admin = await createAdmin(db);
  ana = await createUser(db, { first_name: "Ana", last_name: "Pérez", password: "hash" });
  bruno = await createUser(db, { first_name: "Bruno", last_name: "Gómez" });
  setSession(admin);
});

const listClass = (cls) => callRoute(classParticipantsRoute.GET, { params: { id: cls._id.toString() } });
const listCourse = (course) => callRoute(courseEnrollmentsRoute.GET, { params: { id: course._id.toString() } });

describe("GET /api/classes/[id]/participants", () => {
  it("standalone class: stored participants with contact fields only", async () => {
    const ghost = new ObjectId(); // deleted user: skipped
    const cls = await createClass(db, { participants: [ana._id, ghost, bruno._id] });
    const res = await listClass(cls);
    expect(res.status).toBe(200);
    expect(res.json.data.map((p) => p.first_name)).toEqual(["Ana", "Bruno"]);
    expect(Object.keys(res.json.data[0]).sort()).toEqual(["_id", "email", "first_name", "last_name"]);
  });

  it("course class: the course enrollees with their payment status", async () => {
    const course = await createCourse(db);
    const cls = await createClass(db, { status: "enrolled", courseId: course._id });
    await enroll(db, ana, course, "paid");
    await enroll(db, bruno, course, "pending");
    const { data } = (await listClass(cls)).json;
    expect(data.map((p) => [p.first_name, p.paymentStatus])).toEqual([
      ["Ana", "paid"],
      ["Bruno", "pending"],
    ]);
  });

  it("admin only; 404 for a missing class", async () => {
    const cls = await createClass(db, { participants: [ana._id] });
    setSession(ana);
    expect((await listClass(cls)).status).toBe(403);
    setSession(admin);
    expect((await listClass({ _id: new ObjectId() })).status).toBe(404);
  });
});

describe("GET /api/courses/[id]/enrollments", () => {
  it("enrollees in order with payment data", async () => {
    const course = await createCourse(db);
    await enroll(db, bruno, course, "pending");
    await enroll(db, ana, course, "paid");
    const res = await listCourse(course);
    expect(res.status).toBe(200);
    expect(res.json.data.map((e) => [e.first_name, e.paymentStatus])).toEqual([
      ["Bruno", "pending"],
      ["Ana", "paid"],
    ]);
    expect(res.json.data[1]).not.toHaveProperty("password");
    expect(res.json.data[1]._id).toBe(ana._id.toString());
  });

  it("admin only; 404 for a missing course", async () => {
    const course = await createCourse(db);
    setSession(ana);
    expect((await listCourse(course)).status).toBe(403);
    setSession(null);
    expect((await listCourse(course)).status).toBe(401);
    setSession(admin);
    expect((await listCourse({ _id: new ObjectId() })).status).toBe(404);
  });
});
