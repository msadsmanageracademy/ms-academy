// Shared edition queries used by the classes service and notifications created by real API flows.
import { beforeEach, describe, expect, it } from "vitest";
import { getEditionTimeStatusFromClasses } from "@/server/courses/queries";
import * as classParticipantsRoute from "@/app/api/classes/[id]/participants/route";
import * as classRoute from "@/app/api/classes/[id]/route";
import {
  callRoute,
  createAdmin,
  createClass,
  createCourseDoc,
  createEdition,
  createUser,
  daysFromNow,
  resetDb,
  setSession,
} from "../helpers.mjs";

let db, admin, user;

beforeEach(async () => {
  db = await resetDb();
  admin = await createAdmin(db);
  user = await createUser(db, { first_name: "Ana", last_name: "Pérez" });
  setSession(null);
});

// Schedule fields, date ranges and time status of editions: edition-queries.test.mjs
describe("edition time status in class edits", () => {
  const edit = (cls, body) =>
    callRoute(classRoute.PATCH, { method: "PATCH", body, params: { id: cls._id.toString() } });
  const fullEdit = {
    title: "Edited class",
    short_description: "Edited description",
    start_date: daysFromNow(20).toISOString(),
    duration: 90,
    price: 0,
  };

  it("a class of an edition in progress only accepts title and description", async () => {
    const course = await createCourseDoc(db);
    const edition = await createEdition(db, course);
    const cls = await createClass(db, { editionId: edition._id, status: "enrolled", start_date: daysFromNow(-2) });
    await createClass(db, { editionId: edition._id, status: "enrolled", start_date: daysFromNow(5) });
    expect(await getEditionTimeStatusFromClasses(db, edition._id, "published")).toBe("in-progress");

    setSession(admin);
    expect((await edit(cls, fullEdit)).status).toBe(200);
    const saved = await db.collection("classes").findOne({ _id: cls._id });
    expect(saved).toMatchObject({ title: "Edited class", duration: 60 });
    expect(saved.start_date.getTime()).toBe(cls.start_date.getTime());
  });

  it("classes of an upcoming or draft edition stay fully editable", async () => {
    const course = await createCourseDoc(db);
    const upcoming = await createEdition(db, course);
    const draft = await createEdition(db, course, { status: "draft" });
    // The other edition of the same course is in progress: it does not matter
    const running = await createEdition(db, course);
    await createClass(db, { editionId: running._id, status: "enrolled", start_date: daysFromNow(-2) });
    await createClass(db, { editionId: running._id, status: "enrolled", start_date: daysFromNow(5) });

    setSession(admin);
    for (const edition of [upcoming, draft]) {
      const cls = await createClass(db, { editionId: edition._id, status: "enrolled", start_date: daysFromNow(3) });
      expect((await edit(cls, fullEdit)).status).toBe(200);
      expect(await db.collection("classes").findOne({ _id: cls._id })).toMatchObject({ duration: 90 });
    }
  });
});

describe("notifications from API flows", () => {
  it("class enrollment notifies the student and the admin", async () => {
    const cls = await createClass(db, { createdBy: admin._id, title: "Clase A" });
    setSession(user);
    await callRoute(classParticipantsRoute.POST, { method: "POST", params: { id: cls._id.toString() } });

    const docs = await db.collection("notifications").find().sort({ type: 1 }).toArray();
    expect(docs.map((d) => [d.type, d.userId.toString()])).toEqual([
      ["class.enrolled", user._id.toString()],
      ["class.participant_joined", admin._id.toString()],
    ]);
    expect(docs[1].message).toBe('Ana Pérez se ha inscrito en "Clase A"');
  });

  it("deleting a class notifies participants and the admin with class.cancelled", async () => {
    const cls = await createClass(db, { status: "draft", createdBy: admin._id, participants: [user._id], title: "Clase B" });
    setSession(admin);
    await callRoute(classRoute.DELETE, { method: "DELETE", params: { id: cls._id.toString() } });

    const docs = await db.collection("notifications").find().toArray();
    expect(docs).toHaveLength(2);
    expect(docs.every((d) => d.type === "class.cancelled")).toBe(true);
    expect(docs.find((d) => d.userId.equals(user._id)).title).toBe("Clase cancelada");
    expect(docs.find((d) => d.userId.equals(admin._id)).title).toBe("Clase eliminada");
  });
});
