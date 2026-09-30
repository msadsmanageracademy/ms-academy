// 2.3: courseEnrollments is the single source of course participants.
import { beforeEach, describe, expect, it } from "vitest";
import * as classesRoute from "@/app/api/classes/route";
import * as classRoute from "@/app/api/classes/[id]/route";
import * as classReviewsRoute from "@/app/api/classes/[id]/reviews/route";
import * as coursesRoute from "@/app/api/courses/route";
import * as courseRoute from "@/app/api/courses/[id]/route";
import { runDataFixes } from "@/lib/db/dataFixes.mjs";
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
  setSession(null);
});

describe("course classes derive their participants from the enrollments", () => {
  it("admin detail lists the enrollees; students only get the count", async () => {
    const course = await createCourse(db);
    const cls = await createClass(db, { status: "enrolled", courseId: course._id });
    await enroll(db, user, course, "paid");
    await enroll(db, other, course, "pending");

    setSession(admin);
    let data = (await callRoute(classRoute.GET, { params: { id: cls._id.toString() } })).json.data;
    expect(data.participants.sort()).toEqual([user._id.toString(), other._id.toString()].sort());

    setSession(other);
    data = (await callRoute(classRoute.GET, { params: { id: cls._id.toString() } })).json.data;
    expect(data).toMatchObject({ participantsCount: 2, isParticipant: true, userCoursePaymentStatus: "pending" });
    expect(data).not.toHaveProperty("participants");
  });

  it("admin listings count enrollees for course classes and stored participants otherwise", async () => {
    const course = await createCourse(db);
    await createClass(db, { status: "enrolled", courseId: course._id, title: "Course class" });
    await createClass(db, { participants: [other._id], title: "Standalone" });
    await enroll(db, user, course);
    await enroll(db, other, course);

    setSession(admin);
    const rows = (await callRoute(classesRoute.GET, { path: "/api/classes?showAll=true" })).json.data;
    const count = (title) => rows.find((r) => r.title === title).participantsCount;
    expect(count("Course class")).toBe(2);
    expect(count("Standalone")).toBe(1);

    const courseRows = (await callRoute(classesRoute.GET, { path: `/api/classes?courseId=${course._id}` })).json.data;
    expect(courseRows[0].participantsCount).toBe(2);
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
    const course = await createCourse(db, { participants: [user._id] });
    setSession(admin);
    const [row] = (await callRoute(coursesRoute.GET, { path: "/api/courses?showAll=true" })).json.data;
    expect(row).not.toHaveProperty("participants");
    const detail = (await callRoute(courseRoute.GET, { params: { id: course._id.toString() } })).json.data;
    expect(detail).not.toHaveProperty("participants");
  });

  it("only paid enrollees can review an ended course class", async () => {
    const course = await createCourse(db);
    const cls = await createClass(db, {
      status: "enrolled",
      courseId: course._id,
      start_date: daysFromNow(-2),
      duration: 60,
    });
    await enroll(db, user, course, "paid");
    await enroll(db, other, course, "pending");
    const review = () =>
      callRoute(classReviewsRoute.POST, { method: "POST", body: { rating: 5 }, params: { id: cls._id.toString() } });

    setSession(other);
    expect((await review()).status).toBe(403);
    setSession(user);
    expect((await review()).status).toBe(200);
  });

  it("deleting a course removes its enrollments and notifies the enrollees", async () => {
    const course = await createCourse(db, { status: "draft" });
    const cls = await createClass(db, { status: "enrolled", courseId: course._id, title: "Clase C" });
    await enroll(db, user, course, "paid");

    setSession(admin);
    expect((await callRoute(courseRoute.DELETE, { method: "DELETE", params: { id: course._id.toString() } })).status).toBe(200);
    expect(await db.collection("courseEnrollments").countDocuments()).toBe(0);
    const saved = await db.collection("classes").findOne({ _id: cls._id });
    expect(saved).toMatchObject({ status: "draft", participants: [] });
    expect(saved.courseId).toBeUndefined();
    const [notification] = await db.collection("notifications").find({ userId: user._id }).toArray();
    expect(notification.relatedId.equals(cls._id)).toBe(true);
  });
});

describe("db:migrate data fixes", () => {
  it("backfills paid enrollments, removes the copies and is idempotent", async () => {
    const course = await createCourse(db, { participants: [user._id, other._id] });
    await enroll(db, other, course, "pending");
    const courseClass = await createClass(db, { status: "enrolled", courseId: course._id, participants: [user._id] });
    const standalone = await createClass(db, { participants: [user._id] });

    const byDescription = Object.fromEntries(
      (await runDataFixes(db)).map(({ description, affected }) => [description, affected]),
    );
    expect(byDescription["Paid enrollments created for legacy course participants without one"]).toBe(1);
    expect(byDescription["Removed courses.participants (enrollments are the source)"]).toBe(1);
    expect(byDescription["Removed participants copied into course classes"]).toBe(1);

    const enrollments = await db.collection("courseEnrollments").find({ courseId: course._id }).toArray();
    const status = (u) => enrollments.find((e) => e.userId.equals(u._id)).paymentStatus;
    expect(status(user)).toBe("paid");
    // An existing enrollment is left as it was
    expect(status(other)).toBe("pending");

    expect((await db.collection("courses").findOne({ _id: course._id })).participants).toBeUndefined();
    expect((await db.collection("classes").findOne({ _id: courseClass._id })).participants).toBeUndefined();
    expect((await db.collection("classes").findOne({ _id: standalone._id })).participants).toHaveLength(1);

    const second = await runDataFixes(db);
    expect(second.every(({ affected }) => affected === 0)).toBe(true);
  });
});
