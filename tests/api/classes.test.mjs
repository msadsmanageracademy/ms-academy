// Authorization and data-exposure rules for the classes API.
import { beforeEach, describe, expect, it } from "vitest";
import * as classesRoute from "@/app/api/classes/route";
import * as classRoute from "@/app/api/classes/[id]/route";
import * as statusRoute from "@/app/api/classes/[id]/status/route";
import * as participantsRoute from "@/app/api/classes/[id]/participants/route";
import * as participantRoute from "@/app/api/classes/[id]/participants/[userId]/route";
import * as remindersRoute from "@/app/api/classes/[id]/reminders/route";
import {
  callRoute,
  createAdmin,
  createClass,
  createCourseDoc,
  createEdition,
  createUser,
  enrollInEditionDoc,
  resetDb,
  setSession,
} from "../helpers.mjs";

const MEET = "https://meet.google.com/test-link";

/** A published edition of a new course. */
async function newEdition(db, courseOverrides = {}) {
  return createEdition(db, await createCourseDoc(db, courseOverrides));
}
let db, admin, user, other;

beforeEach(async () => {
  db = await resetDb();
  admin = await createAdmin(db);
  user = await createUser(db);
  other = await createUser(db);
  setSession(null);
});

const newClassBody = () => ({
  title: "New class",
  short_description: "Class description",
  start_date: new Date(Date.now() + 7 * 86400000).toISOString(),
  duration: 60,
  price: 0,
});

describe("admin-only mutations", () => {
  it("POST /api/classes: anonymous 401, user 403, admin 201", async () => {
    const call = () => callRoute(classesRoute.POST, { method: "POST", body: newClassBody() });
    expect((await call()).status).toBe(401);
    setSession(user);
    expect((await call()).status).toBe(403);
    setSession(admin);
    expect((await call()).status).toBe(201);
  });

  it("PATCH, DELETE and PUT status reject non-admins", async () => {
    const cls = await createClass(db, { status: "draft" });
    const params = { id: cls._id.toString() };
    for (const session of [null, user]) {
      setSession(session);
      const expected = session ? 403 : 401;
      expect((await callRoute(classRoute.PATCH, { method: "PATCH", body: { title: "Hacked" }, params })).status).toBe(expected);
      expect((await callRoute(statusRoute.PUT, { method: "PUT", body: { status: "published" }, params })).status).toBe(expected);
      expect((await callRoute(classRoute.DELETE, { method: "DELETE", params })).status).toBe(expected);
    }
    const saved = await db.collection("classes").findOne({ _id: cls._id });
    expect(saved).toMatchObject({ title: "Test class", status: "draft" });
  });

  it("removing another participant and reminders reject a regular user", async () => {
    const cls = await createClass(db, { participants: [other._id] });
    setSession(user);
    const res = await callRoute(participantRoute.DELETE, {
      method: "DELETE",
      params: { id: cls._id.toString(), userId: other._id.toString() },
    });
    expect(res.status).toBe(403);
    expect((await callRoute(remindersRoute.POST, { method: "POST", body: {}, params: { id: cls._id.toString() } })).status).toBe(403);
    expect((await db.collection("classes").findOne({ _id: cls._id })).participants).toHaveLength(1);
  });

  it.each([["status"], ["editionId"], ["recording_url"], ["resources"]])(
    "PATCH rejects %s (it has its own endpoint)",
    async (field) => {
      const cls = await createClass(db, { status: "draft" });
      setSession(admin);
      const res = await callRoute(classRoute.PATCH, {
        method: "PATCH",
        body: { ...newClassBody(), [field]: "x" },
        params: { id: cls._id.toString() },
      });
      expect(res.status).toBe(400);
    },
  );

  it("rejects malformed JSON with 400", async () => {
    setSession(admin);
    const req = new Request("http://localhost/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    const res = await classesRoute.POST(req);
    expect(res.status).toBe(400);
  });
});

describe("listings", () => {
  it("public listing exposes neither participants nor links", async () => {
    await createClass(db, { participants: [user._id], createdBy: admin._id, googleMeetLink: MEET });
    const res = await callRoute(classesRoute.GET, { path: "/api/classes" });
    expect(res.status).toBe(200);
    const [pub] = res.json.data;
    expect(pub.participantsCount).toBe(1);
    expect(pub).not.toHaveProperty("participants");
    expect(pub).not.toHaveProperty("createdBy");
    expect(pub).not.toHaveProperty("googleMeetLink");
  });

  it("public listing flags only the viewer's own participation", async () => {
    await createClass(db, { participants: [user._id], createdBy: admin._id });
    const list = async (session) => {
      setSession(session);
      const res = await callRoute(classesRoute.GET, { path: "/api/classes" });
      expect(res.status).toBe(200);
      const [pub] = res.json.data;
      expect(pub.participantsCount).toBe(1);
      expect(pub).not.toHaveProperty("participants");
      expect(pub).not.toHaveProperty("createdBy");
      expect(JSON.stringify(res.json.data)).not.toContain(user._id.toString());
      return pub;
    };
    expect((await list(null)).isParticipant).toBe(false);
    expect((await list(user)).isParticipant).toBe(true);
    expect((await list(other)).isParticipant).toBe(false);
  });

  it.each([
    ["/api/classes?showAll=true"],
    ["/api/classes?editionId=507f1f77bcf86cd799439011"],
  ])("%s: anonymous 401, user 403", async (path) => {
    expect((await callRoute(classesRoute.GET, { path })).status).toBe(401);
    setSession(user);
    expect((await callRoute(classesRoute.GET, { path })).status).toBe(403);
  });

  it("the admin listing adds course id, course title and edition date label to edition classes", async () => {
    const course = await createCourseDoc(db, { title: "Meta Ads" });
    const first = await createEdition(db, course);
    const second = await createEdition(db, course);
    await createClass(db, { status: "enrolled", editionId: first._id, start_date: new Date("2030-09-02T22:00:00Z") });
    await createClass(db, {
      status: "enrolled",
      editionId: second._id,
      title: "Edition class",
      start_date: new Date("2030-09-20T22:00:00Z"),
    });
    await createClass(db, { title: "Standalone" });

    setSession(admin);
    const rows = (await callRoute(classesRoute.GET, { path: "/api/classes?showAll=true" })).json.data;
    const byTitle = Object.fromEntries(rows.map((r) => [r.title, r]));
    expect(byTitle["Edition class"]).toMatchObject({
      courseId: course._id.toString(),
      courseTitle: "Meta Ads",
      editionLabel: "Septiembre 2030 (2)",
      editionId: second._id.toString(),
    });
    expect(byTitle["Edition class"]).not.toHaveProperty("editionNumber");
    expect(byTitle.Standalone).not.toHaveProperty("courseId");
    expect(byTitle.Standalone).not.toHaveProperty("editionLabel");

    const editionRows = (await callRoute(classesRoute.GET, { path: `/api/classes?editionId=${second._id}` })).json.data;
    expect(editionRows.map((r) => r.title)).toEqual(["Edition class"]);
  });

  it("myClasses requires a session", async () => {
    expect((await callRoute(classesRoute.GET, { path: "/api/classes?myClasses=true" })).status).toBe(401);
  });
});

describe("paywall on class detail", () => {
  const getDetail = (cls) => callRoute(classRoute.GET, { params: { id: cls._id.toString() } });

  it("standalone class: only participants see the link", async () => {
    const cls = await createClass(db, { participants: [user._id], googleMeetLink: MEET });
    expect((await getDetail(cls)).json.data.googleMeetLink).toBeUndefined();
    setSession(other);
    expect((await getDetail(cls)).json.data.googleMeetLink).toBeUndefined();
    setSession(user);
    const res = await getDetail(cls);
    expect(res.json.data.googleMeetLink).toBe(MEET);
    expect(res.json.data).not.toHaveProperty("participants");
  });

  it("edition class: the link only shows up once that edition is paid", async () => {
    const edition = await newEdition(db, { title: "Meta Ads" });
    const cls = await createClass(db, {
      status: "enrolled",
      editionId: edition._id,
      googleMeetLink: MEET,
      recording_url: "https://example.test/rec",
    });
    await enrollInEditionDoc(db, user, edition, "pending");
    setSession(user);
    let data = (await getDetail(cls)).json.data;
    expect(data.googleMeetLink).toBeUndefined();
    expect(data.recording_url).toBeUndefined();
    expect(data).toMatchObject({
      userEditionPaymentStatus: "pending",
      courseTitle: "Meta Ads",
      editionLabel: expect.stringMatching(/^[A-ZÁÉÍÓÚ][a-záéíóú]+ \d{4}$/),
    });
    expect(data).not.toHaveProperty("editionNumber");

    await db.collection("courseEnrollments").updateOne({ userId: user._id }, { $set: { paymentStatus: "paid" } });
    data = (await getDetail(cls)).json.data;
    expect(data.googleMeetLink).toBe(MEET);
    expect(data.recording_url).toBe("https://example.test/rec");
    expect(data.userEditionPaymentStatus).toBe("paid");
  });

  it("edition class: paying another edition of the same course gives no access", async () => {
    const course = await createCourseDoc(db);
    const first = await createEdition(db, course);
    const second = await createEdition(db, course);
    const cls = await createClass(db, { status: "enrolled", editionId: second._id, googleMeetLink: MEET });
    await enrollInEditionDoc(db, user, first, "paid");
    setSession(user);
    const data = (await getDetail(cls)).json.data;
    expect(data.googleMeetLink).toBeUndefined();
    expect(data.userEditionPaymentStatus).toBeNull();
    expect(data.isParticipant).toBe(false);
  });

  it("admin sees everything, including participants", async () => {
    const cls = await createClass(db, { participants: [user._id], googleMeetLink: MEET });
    setSession(admin);
    const data = (await getDetail(cls)).json.data;
    expect(data.googleMeetLink).toBe(MEET);
    expect(data.participants).toHaveLength(1);
  });
});

describe("class enrollment", () => {
  const signUp = (cls) =>
    callRoute(participantsRoute.POST, { method: "POST", params: { id: cls._id.toString() } });
  const leave = (cls, userId) =>
    callRoute(participantRoute.DELETE, {
      method: "DELETE",
      params: { id: cls._id.toString(), userId: userId.toString() },
    });

  it("requires a session", async () => {
    const cls = await createClass(db);
    expect((await signUp(cls)).status).toBe(401);
  });

  it("rejects drafts, past classes, course classes and admins", async () => {
    setSession(user);
    expect((await signUp(await createClass(db, { status: "draft" }))).status).toBe(400);
    expect((await signUp(await createClass(db, { start_date: new Date(Date.now() - 86400000) }))).status).toBe(400);
    const edition = await newEdition(db);
    expect((await signUp(await createClass(db, { status: "enrolled", editionId: edition._id }))).status).toBe(400);
    setSession(admin);
    expect((await signUp(await createClass(db))).status).toBe(403);
  });

  it("enforces capacity and prevents double enrollment", async () => {
    const cls = await createClass(db, { max_participants: 1 });
    setSession(user);
    expect((await signUp(cls)).status).toBe(201);
    expect((await signUp(cls)).status).toBe(400);
    setSession(other);
    expect((await signUp(cls)).status).toBe(400);
    const saved = await db.collection("classes").findOne({ _id: cls._id });
    expect(saved.participants).toHaveLength(1);
  });

  it("a user leaves; an admin removes someone else with a different notification", async () => {
    const cls = await createClass(db, { participants: [user._id, other._id], createdBy: admin._id });
    setSession(user);
    expect((await leave(cls, user._id)).status).toBe(200);
    expect((await leave(cls, user._id)).status).toBe(400);
    setSession(admin);
    expect((await leave(cls, other._id)).status).toBe(200);

    expect((await db.collection("classes").findOne({ _id: cls._id })).participants).toEqual([]);
    const types = (await db.collection("notifications").find().toArray()).map((n) => n.type).sort();
    expect(types).toEqual([
      "class.participant_left",
      "class.participant_removed",
      "class.removed_by_admin",
      "class.unenrolled",
    ]);
  });

  it("edition classes are managed from the edition", async () => {
    const edition = await newEdition(db);
    const cls = await createClass(db, { status: "enrolled", editionId: edition._id });
    await enrollInEditionDoc(db, user, edition, "pending");
    setSession(admin);
    expect((await leave(cls, user._id)).status).toBe(400);
  });
});
