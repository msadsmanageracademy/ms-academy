// Dedicated class sub-resources: status, edition link, recording and materials.
import { beforeEach, describe, expect, it } from "vitest";
import * as classRoute from "@/app/api/classes/[id]/route";
import * as statusRoute from "@/app/api/classes/[id]/status/route";
import * as recordingRoute from "@/app/api/classes/[id]/recording/route";
import * as resourcesRoute from "@/app/api/classes/[id]/resources/route";
import * as editionRoute from "@/app/api/classes/[id]/edition/route";
import {
  ObjectId,
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
    const edition = await createEdition(db, await createCourseDoc(db));
    const editionClass = await createClass(db, { status: "enrolled", editionId: edition._id });
    expect((await setStatus(editionClass, "published")).status).toBe(400);
  });
});

describe("PUT/DELETE /api/classes/[id]/edition", () => {
  const link = (cls, editionId) =>
    callRoute(editionRoute.PUT, { method: "PUT", body: editionId === undefined ? {} : { editionId }, params: params(cls) });
  const unlink = (cls) => callRoute(editionRoute.DELETE, { method: "DELETE", params: params(cls) });
  const editionStatus = async (edition) =>
    (await db.collection("courseEditions").findOne({ _id: edition._id })).status;

  it("links a draft class (enrollees become its participants, nothing copied) and unlinks it", async () => {
    const course = await createCourseDoc(db, { title: "Meta Ads" });
    const edition = await createEdition(db, course, { status: "draft" });
    await enrollInEditionDoc(db, user, edition, "pending");
    const cls = await createClass(db, {
      status: "draft",
      max_participants: 10,
      createdBy: admin._id,
      start_date: new Date("2030-09-10T22:00:00Z"),
    });

    const linked = await link(cls, edition._id.toString());
    expect(linked.status).toBe(200);
    expect(linked.json.data).toMatchObject({
      editionId: edition._id.toString(),
      status: "enrolled",
      max_participants: null,
      participantsCount: 1,
    });
    expect((await findClass(cls)).participants).toBeUndefined();
    expect(await notificationTypes(user._id)).toEqual(["class.added_to_course"]);
    const [adminNotice] = await db.collection("notifications").find({ userId: admin._id }).toArray();
    // Named after the link: the class gives the edition its first date
    expect(adminNotice.message).toContain("Meta Ads · Septiembre 2030");

    // Already linked
    expect((await link(cls, edition._id.toString())).status).toBe(400);

    const unlinked = await unlink(cls);
    expect(unlinked.status).toBe(200);
    expect(unlinked.json.data).toMatchObject({ status: "draft", participantsCount: 0 });
    const saved = await findClass(cls);
    expect(saved.editionId).toBeUndefined();
    expect(saved.status).toBe("draft");
    expect(saved.participants).toEqual([]);
    expect((await notificationTypes(user._id)).sort()).toEqual(["class.added_to_course", "class.removed_from_course"]);
    // Named before the unlink: the name the students know the edition by
    const removed = await db.collection("notifications").findOne({ userId: user._id, type: "class.removed_from_course" });
    expect(removed.message).toContain("Meta Ads · Septiembre 2030");
  });

  it("validates the edition id and rejects published classes and missing editions", async () => {
    const cls = await createClass(db, { status: "draft" });
    expect((await link(cls)).status).toBe(400);
    expect((await link(cls, "nope")).status).toBe(400);
    expect((await link(cls, new ObjectId().toString())).status).toBe(404);
    const edition = await createEdition(db, await createCourseDoc(db));
    const published = await createClass(db);
    expect((await link(published, edition._id.toString())).status).toBe(400);
    expect((await unlink(published)).status).toBe(400);
    setSession(user);
    expect((await link(cls, edition._id.toString())).status).toBe(403);
    expect((await findClass(cls)).editionId).toBeUndefined();
  });

  it("linking a class to a published edition that had finished takes it back to draft", async () => {
    const edition = await createEdition(db, await createCourseDoc(db));
    await createClass(db, { editionId: edition._id, status: "enrolled", start_date: daysFromNow(-20) });
    const cls = await createClass(db, { status: "draft", start_date: daysFromNow(5) });
    await link(cls, edition._id.toString());
    expect(await editionStatus(edition)).toBe("draft");

    // An upcoming published edition stays published
    const upcoming = await createEdition(db, await createCourseDoc(db));
    await createClass(db, { editionId: upcoming._id, status: "enrolled", start_date: daysFromNow(3) });
    await link(await createClass(db, { status: "draft", start_date: daysFromNow(6) }), upcoming._id.toString());
    expect(await editionStatus(upcoming)).toBe("published");
  });

  it("unlinking the last class of a published edition takes it back to draft", async () => {
    const edition = await createEdition(db, await createCourseDoc(db));
    const first = await createClass(db, { editionId: edition._id, status: "enrolled", start_date: daysFromNow(3) });
    const second = await createClass(db, { editionId: edition._id, status: "enrolled", start_date: daysFromNow(4) });
    await unlink(first);
    expect(await editionStatus(edition)).toBe("published");
    await unlink(second);
    expect(await editionStatus(edition)).toBe("draft");
  });
});

describe("recording and materials", () => {
  let cls;

  beforeEach(async () => {
    const course = await createCourseDoc(db);
    const edition = await createEdition(db, course);
    // Paid in another edition of the same course: no access to this class
    const otherEdition = await createEdition(db, course);
    await enrollInEditionDoc(db, user, edition, "paid");
    await enrollInEditionDoc(db, other, edition, "pending");
    await enrollInEditionDoc(db, other, otherEdition, "paid");
    cls = await createClass(db, {
      status: "enrolled",
      editionId: edition._id,
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

  it("only edition classes accept a recording or materials; users get 403", async () => {
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
