// Shared course queries and notifications created by real API flows.
import { beforeEach, describe, expect, it } from "vitest";
import {
  courseAggregationPipeline,
  getCourseDateRange,
  getCourseTimeStatusFromClasses,
} from "@/server/courses/queries";
import * as courseStatusRoute from "@/app/api/courses/[id]/status/route";
import * as classParticipantsRoute from "@/app/api/classes/[id]/participants/route";
import * as classRoute from "@/app/api/classes/[id]/route";
import {
  callRoute,
  createAdmin,
  createClass,
  createCourse,
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

describe("course queries", () => {
  it("computes schedule fields from the linked classes", async () => {
    const course = await createCourse(db);
    await createClass(db, { courseId: course._id, status: "enrolled", start_date: daysFromNow(3), duration: 60 });
    const last = await createClass(db, { courseId: course._id, status: "enrolled", start_date: daysFromNow(10), duration: 90 });

    const [row] = await db.collection("courses").aggregate(courseAggregationPipeline({ _id: course._id })).toArray();
    expect(row.amount_of_classes).toBe(2);
    expect(row.total_duration).toBe(150);
    expect(row.end_date.getTime()).toBe(last.start_date.getTime() + 90 * 60000);

    const range = await getCourseDateRange(db, course._id);
    expect(range.start_date.getTime()).toBe(row.start_date.getTime());
    expect(range.end_date.getTime()).toBe(row.end_date.getTime());
  });

  it("can exclude a class and returns {} for courses without classes", async () => {
    const course = await createCourse(db);
    const only = await createClass(db, { courseId: course._id, status: "enrolled" });
    expect(await getCourseDateRange(db, course._id, { excludeClassId: only._id })).toEqual({});
    expect(await getCourseTimeStatusFromClasses(db, course._id, "published", { excludeClassId: only._id })).toBeNull();
  });

  it("detects a course in progress", async () => {
    const course = await createCourse(db);
    await createClass(db, { courseId: course._id, status: "enrolled", start_date: daysFromNow(-2) });
    await createClass(db, { courseId: course._id, status: "enrolled", start_date: daysFromNow(5) });
    expect(await getCourseTimeStatusFromClasses(db, course._id, "published")).toBe("in-progress");
  });

  it("the API refuses to archive a course in progress", async () => {
    const course = await createCourse(db);
    await createClass(db, { courseId: course._id, status: "enrolled", start_date: daysFromNow(-2) });
    await createClass(db, { courseId: course._id, status: "enrolled", start_date: daysFromNow(5) });
    setSession(admin);
    const res = await callRoute(courseStatusRoute.PUT, {
      method: "PUT",
      body: { status: "draft" },
      params: { id: course._id.toString() },
    });
    expect(res.status).toBe(400);
    expect((await db.collection("courses").findOne({ _id: course._id })).status).toBe("published");
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
