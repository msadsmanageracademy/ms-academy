// Dedicated class sub-resources: status, course link, recording and materials.
import { beforeEach, describe, expect, it } from "vitest";
import * as classRoute from "@/app/api/classes/[id]/route";
import * as statusRoute from "@/app/api/classes/[id]/status/route";
import * as courseRoute from "@/app/api/classes/[id]/course/route";
import * as recordingRoute from "@/app/api/classes/[id]/recording/route";
import * as resourcesRoute from "@/app/api/classes/[id]/resources/route";
import {
  callRoute,
  createAdmin,
  createClass,
  createCourse,
  createUser,
  daysFromNow,
  enroll,
  resetDb,
  setSession,
} from "../helpers.mjs";

let db, admin, user, other;

beforeEach(async () => {
  db = await resetDb();
  admin = await createAdmin(db);
  user = await createUser(db);
  other = await createUser(db);
  setSession(admin);
});

const params = (cls) => ({ id: cls._id.toString() });
const findClass = (cls) => db.collection("classes").findOne({ _id: cls._id });
const notificationTypes = async (userId) =>
  (await db.collection("notifications").find({ userId }).toArray()).map((n) => n.type);

describe("PUT /api/classes/[id]/status", () => {
  const setStatus = (cls, status) =>
    callRoute(statusRoute.PUT, { method: "PUT", body: { status }, params: params(cls) });

  it("publishes a dated future class and rejects invalid states", async () => {
    const cls = await createClass(db, { status: "draft", createdBy: admin._id });
    const res = await setStatus(cls, "published");
    expect(res.status).toBe(200);
    expect(res.json.data.status).toBe("published");
    expect((await setStatus(cls, "enrolled")).status).toBe(400);
    expect((await setStatus(await createClass(db, { status: "draft", start_date: null }), "published")).status).toBe(400);
    expect((await setStatus(await createClass(db, { status: "draft", start_date: daysFromNow(-1) }), "published")).status).toBe(400);
  });

  it("archiving removes and notifies the participants", async () => {
    const cls = await createClass(db, { participants: [user._id], createdBy: admin._id });
    const res = await setStatus(cls, "draft");
    expect(res.status).toBe(200);
    expect(res.json.data.participantsCount).toBe(0);
    expect((await findClass(cls)).participants).toEqual([]);
    expect(await notificationTypes(user._id)).toEqual(["class.removed_by_admin"]);
  });

  it("does not archive a class in progress or change a course class", async () => {
    const ongoing = await createClass(db, { start_date: new Date(Date.now() - 10 * 60000), duration: 60 });
    expect((await setStatus(ongoing, "draft")).status).toBe(400);
    const course = await createCourse(db);
    const courseClass = await createClass(db, { status: "enrolled", courseId: course._id });
    expect((await setStatus(courseClass, "published")).status).toBe(400);
  });
});

describe("/api/classes/[id]/course", () => {
  it("links a draft class (enrollees become its participants, nothing copied) and unlinks it", async () => {
    const course = await createCourse(db, { status: "draft" });
    await enroll(db, user, course, "pending");
    const cls = await createClass(db, { status: "draft", max_participants: 10, createdBy: admin._id });

    let res = await callRoute(courseRoute.PUT, { method: "PUT", body: { courseId: course._id.toString() }, params: params(cls) });
    expect(res.status).toBe(200);
    expect(res.json.data).toMatchObject({
      status: "enrolled",
      max_participants: null,
      courseId: course._id.toString(),
      participantsCount: 1,
    });
    expect((await findClass(cls)).participants).toBeUndefined();
    expect(await notificationTypes(user._id)).toEqual(["class.added_to_course"]);

    // Already linked
    res = await callRoute(courseRoute.PUT, { method: "PUT", body: { courseId: course._id.toString() }, params: params(cls) });
    expect(res.status).toBe(400);

    res = await callRoute(courseRoute.DELETE, { method: "DELETE", params: params(cls) });
    expect(res.status).toBe(200);
    const saved = await findClass(cls);
    expect(saved.courseId).toBeUndefined();
    expect(saved.status).toBe("draft");
    expect(saved.participants).toEqual([]);
  });

  it("validates the course id and rejects published classes", async () => {
    const cls = await createClass(db, { status: "draft" });
    expect((await callRoute(courseRoute.PUT, { method: "PUT", body: {}, params: params(cls) })).status).toBe(400);
    expect((await callRoute(courseRoute.PUT, { method: "PUT", body: { courseId: "nope" }, params: params(cls) })).status).toBe(400);
    const course = await createCourse(db);
    const published = await createClass(db);
    const res = await callRoute(courseRoute.PUT, { method: "PUT", body: { courseId: course._id.toString() }, params: params(published) });
    expect(res.status).toBe(400);
    expect((await callRoute(courseRoute.DELETE, { method: "DELETE", params: params(published) })).status).toBe(400);
  });
});

describe("recording and materials", () => {
  let course, cls;

  beforeEach(async () => {
    course = await createCourse(db);
    await enroll(db, user, course, "paid");
    await enroll(db, other, course, "pending");
    cls = await createClass(db, {
      status: "enrolled",
      courseId: course._id,
      createdBy: admin._id,
    });
  });

  it("sets and removes the recording, notifying only paid enrollees", async () => {
    const put = (body) => callRoute(recordingRoute.PUT, { method: "PUT", body, params: params(cls) });
    expect((await put({ url: "not a url" })).status).toBe(400);
    expect((await put({ url: "https://example.test/rec" })).status).toBe(200);
    expect((await findClass(cls)).recording_url).toBe("https://example.test/rec");
    expect(await notificationTypes(user._id)).toEqual(["class.recording_added"]);
    expect(await notificationTypes(other._id)).toEqual([]);

    expect((await callRoute(recordingRoute.DELETE, { method: "DELETE", params: params(cls) })).status).toBe(200);
    expect((await findClass(cls)).recording_url).toBeUndefined();
  });

  it("replaces the materials and validates them", async () => {
    const put = (resources) => callRoute(resourcesRoute.PUT, { method: "PUT", body: { resources }, params: params(cls) });
    expect((await put([{ title: "Slides", url: "bad" }])).status).toBe(400);
    expect((await put([{ title: "Slides", url: "https://example.test/slides" }])).status).toBe(200);
    expect((await findClass(cls)).resources).toEqual([{ title: "Slides", url: "https://example.test/slides" }]);
    expect(await notificationTypes(user._id)).toEqual(["class.resources_updated"]);
  });

  it("only course classes accept a recording or materials; users get 403", async () => {
    const standalone = await createClass(db);
    expect(
      (await callRoute(recordingRoute.PUT, { method: "PUT", body: { url: "https://example.test/rec" }, params: params(standalone) })).status,
    ).toBe(400);
    expect((await callRoute(resourcesRoute.PUT, { method: "PUT", body: { resources: [] }, params: params(standalone) })).status).toBe(400);
    setSession(user);
    expect(
      (await callRoute(recordingRoute.PUT, { method: "PUT", body: { url: "https://example.test/rec" }, params: params(cls) })).status,
    ).toBe(403);
  });
});

describe("PATCH /api/classes/[id]", () => {
  it("published classes only accept title and description", async () => {
    const cls = await createClass(db, { participants: [user._id], createdBy: admin._id });
    const res = await callRoute(classRoute.PATCH, {
      method: "PATCH",
      body: { title: "Renamed class", short_description: "New description", price: 999 },
      params: params(cls),
    });
    expect(res.status).toBe(200);
    const saved = await findClass(cls);
    expect(saved).toMatchObject({ title: "Renamed class", price: 0 });
    expect(await notificationTypes(user._id)).toEqual(["class.updated"]);
  });

  it("drafts are fully editable and validation errors include details", async () => {
    const cls = await createClass(db, { status: "draft" });
    let res = await callRoute(classRoute.PATCH, { method: "PATCH", body: { title: "x" }, params: params(cls) });
    expect(res.status).toBe(400);
    expect(Array.isArray(res.json.details)).toBe(true);

    res = await callRoute(classRoute.PATCH, {
      method: "PATCH",
      body: {
        title: "Edited draft",
        short_description: "Edited description",
        start_date: daysFromNow(3).toISOString(),
        duration: 90,
        price: 500,
        max_participants: 0,
      },
      params: params(cls),
    });
    expect(res.status).toBe(200);
    expect(await findClass(cls)).toMatchObject({ title: "Edited draft", duration: 90, price: 500, max_participants: null });
  });
});
