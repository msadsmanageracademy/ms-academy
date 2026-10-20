// 3.1: participant lists in one request (replaces one /api/users/[id] call per participant).
// The edition enrollee list (listEditionEnrollments) is covered in edition-enrollments.test.mjs.
import { beforeEach, describe, expect, it } from "vitest";
import * as classParticipantsRoute from "@/app/api/classes/[id]/participants/route";
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

let db, admin, ana, bruno;

beforeEach(async () => {
  db = await resetDb();
  admin = await createAdmin(db);
  ana = await createUser(db, { first_name: "Ana", last_name: "Pérez", password: "hash" });
  bruno = await createUser(db, { first_name: "Bruno", last_name: "Gómez" });
  setSession(admin);
});

const listClass = (cls) => callRoute(classParticipantsRoute.GET, { params: { id: cls._id.toString() } });

describe("GET /api/classes/[id]/participants", () => {
  it("standalone class: stored participants with contact fields only", async () => {
    const ghost = new ObjectId(); // deleted user: skipped
    const cls = await createClass(db, { participants: [ana._id, ghost, bruno._id] });
    const res = await listClass(cls);
    expect(res.status).toBe(200);
    expect(res.json.data.map((p) => p.first_name)).toEqual(["Ana", "Bruno"]);
    expect(Object.keys(res.json.data[0]).sort()).toEqual(["_id", "email", "first_name", "last_name"]);
  });

  it("edition class: the enrollees of its edition with their payment status", async () => {
    const course = await createCourseDoc(db);
    const other = await createEdition(db, course);
    const edition = await createEdition(db, course);
    const cls = await createClass(db, { status: "enrolled", editionId: edition._id });
    await enrollInEditionDoc(db, ana, edition, "paid");
    await enrollInEditionDoc(db, bruno, edition, "pending");
    // Enrolled in another edition of the same course: not a participant of this class
    await enrollInEditionDoc(db, admin, other, "paid");
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
