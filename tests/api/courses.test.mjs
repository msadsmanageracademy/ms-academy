// Authorization, capacity and payment rules for the courses API.
import { beforeEach, describe, expect, it } from "vitest";
import * as coursesRoute from "@/app/api/courses/route";
import * as courseRoute from "@/app/api/courses/[id]/route";
import * as statusRoute from "@/app/api/courses/[id]/status/route";
import * as enrollmentsRoute from "@/app/api/courses/[id]/enrollments/route";
import * as enrollmentRoute from "@/app/api/courses/[id]/enrollments/[userId]/route";
import * as cloneRoute from "@/app/api/courses/[id]/clone/route";
import * as classesRoute from "@/app/api/classes/route";
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

let db, admin, user, other;

beforeEach(async () => {
  db = await resetDb();
  admin = await createAdmin(db);
  user = await createUser(db);
  other = await createUser(db);
  setSession(null);
});

const params = (course) => ({ id: course._id.toString() });
const enrollmentParams = (course, student) => ({ id: course._id.toString(), userId: student._id.toString() });

describe("admin-only mutations", () => {
  const body = {
    title: "Course",
    short_description: "Short description",
    full_description: "Full description",
    max_participants: 0,
    price: 100,
  };

  it("POST /api/courses: anonymous 401, user 403, admin 201 as draft", async () => {
    expect((await callRoute(coursesRoute.POST, { method: "POST", body })).status).toBe(401);
    setSession(user);
    expect((await callRoute(coursesRoute.POST, { method: "POST", body })).status).toBe(403);
    setSession(admin);
    const res = await callRoute(coursesRoute.POST, { method: "POST", body: { ...body, status: "published" } });
    expect(res.status).toBe(201);
    const saved = await db.collection("courses").findOne({ _id: new ObjectId(res.json.data._id) });
    expect(saved.status).toBe("draft");
    expect(saved.courseSeriesId.equals(saved._id)).toBe(true);
  });

  it("PATCH, PUT status, DELETE, clone and removing a participant reject a regular user", async () => {
    const course = await createCourse(db, { status: "draft" });
    await enroll(db, other, course, "pending");
    setSession(user);
    expect((await callRoute(courseRoute.PATCH, { method: "PATCH", body: { title: "Hacked" }, params: params(course) })).status).toBe(403);
    expect((await callRoute(statusRoute.PUT, { method: "PUT", body: { status: "published" }, params: params(course) })).status).toBe(403);
    expect((await callRoute(courseRoute.DELETE, { method: "DELETE", params: params(course) })).status).toBe(403);
    expect((await callRoute(cloneRoute.POST, { method: "POST", params: params(course) })).status).toBe(403);
    expect((await callRoute(enrollmentRoute.DELETE, { method: "DELETE", params: enrollmentParams(course, other) })).status).toBe(403);
    expect(await db.collection("courses").countDocuments()).toBe(1);
    expect(await db.collection("courseEnrollments").countDocuments()).toBe(1);
  });

  it("PATCH does not change the status (it has its own endpoint)", async () => {
    const course = await createCourse(db, { status: "draft" });
    setSession(admin);
    const res = await callRoute(courseRoute.PATCH, { method: "PATCH", body: { ...body, status: "published" }, params: params(course) });
    expect(res.status).toBe(400);
    expect((await db.collection("courses").findOne({ _id: course._id })).status).toBe("draft");
  });

  it("publishing requires dated classes", async () => {
    const course = await createCourse(db, { status: "draft" });
    setSession(admin);
    const publish = () => callRoute(statusRoute.PUT, { method: "PUT", body: { status: "published" }, params: params(course) });
    expect((await publish()).status).toBe(400);
    await createClass(db, { courseId: course._id, status: "enrolled", start_date: null });
    expect((await publish()).json.message).toMatch(/no tienen fecha/);
    await db.collection("classes").updateMany({}, { $set: { start_date: new Date(Date.now() + 86400000) } });
    const res = await publish();
    expect(res.status).toBe(200);
    expect(res.json.data.status).toBe("published");
    expect((await callRoute(statusRoute.PUT, { method: "PUT", body: { status: "other" }, params: params(course) })).status).toBe(400);
  });
});

describe("reads", () => {
  it("showAll: anonymous 401, user 403", async () => {
    const path = "/api/courses?showAll=true";
    expect((await callRoute(coursesRoute.GET, { path })).status).toBe(401);
    setSession(user);
    expect((await callRoute(coursesRoute.GET, { path })).status).toBe(403);
  });

  it("public listing shows capacity but not who is enrolled", async () => {
    const course = await createCourse(db, { participants: [other._id] });
    await enroll(db, other, course, "paid");
    const [pub] = (await callRoute(coursesRoute.GET, { path: "/api/courses" })).json.data;
    expect(pub.enrollmentCount).toBe(1);
    expect(pub).not.toHaveProperty("participants");
    expect(pub).not.toHaveProperty("paidCount");
  });

  it("listing includes the user's own payment status", async () => {
    const course = await createCourse(db);
    await enroll(db, user, course, "pending");
    setSession(user);
    const [row] = (await callRoute(coursesRoute.GET, { path: "/api/courses" })).json.data;
    expect(row.userPaymentStatus).toBe("pending");
  });

  it("detail only shows enrollmentMap to admins", async () => {
    const course = await createCourse(db);
    await enroll(db, other, course, "pending");
    setSession(user);
    let data = (await callRoute(courseRoute.GET, { params: params(course) })).json.data;
    expect(data).not.toHaveProperty("enrollmentMap");
    expect(data.enrollmentCount).toBe(1);
    setSession(admin);
    data = (await callRoute(courseRoute.GET, { params: params(course) })).json.data;
    expect(data.enrollmentMap[other._id.toString()]).toBe("pending");
  });

  it("a draft course is hidden from users who are not enrolled", async () => {
    const course = await createCourse(db, { status: "draft" });
    setSession(user);
    expect((await callRoute(courseRoute.GET, { params: params(course) })).status).toBe(404);
  });
});

describe("enrollment", () => {
  const signUp = (course) => callRoute(enrollmentsRoute.POST, { method: "POST", params: params(course) });

  it("prevents duplicate enrollments, even concurrent ones", async () => {
    const course = await createCourse(db);
    setSession(user);
    const results = await Promise.all([1, 2, 3].map(() => signUp(course)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await db.collection("courseEnrollments").countDocuments({ userId: user._id })).toBe(1);
  });

  it("does not exceed capacity with concurrent enrollments", async () => {
    const course = await createCourse(db, { max_participants: 2 });
    const students = await Promise.all([1, 2, 3, 4, 5].map(() => createUser(db)));
    // The mocked auth() reads the session synchronously when each handler starts,
    // so setting it right before each call gives every request its own user.
    const results = await Promise.all(
      students.map((student) => {
        setSession(student);
        return signUp(course);
      }),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect(await db.collection("courseEnrollments").countDocuments({ courseId: course._id })).toBe(2);
  });

  it("the enrollment alone puts the student in the course classes; cancelling takes them out", async () => {
    const course = await createCourse(db);
    const courseClass = await createClass(db, { status: "enrolled", courseId: course._id });
    const myClasses = async () =>
      (await callRoute(classesRoute.GET, { path: "/api/classes?myClasses=true" })).json.data.map((c) => c._id);

    setSession(user);
    expect((await signUp(course)).status).toBe(201);
    expect(await myClasses()).toEqual([courseClass._id.toString()]);
    // Nothing is copied into the class or the course
    expect((await db.collection("classes").findOne({ _id: courseClass._id })).participants).toBeUndefined();
    expect((await db.collection("courses").findOne({ _id: course._id })).participants).toBeUndefined();

    const res = await callRoute(enrollmentRoute.DELETE, { method: "DELETE", params: enrollmentParams(course, user) });
    expect(res.status).toBe(200);
    expect(await db.collection("courseEnrollments").countDocuments()).toBe(0);
    expect(await myClasses()).toEqual([]);
  });

  it("admin removing a user who is not enrolled → 404", async () => {
    const course = await createCourse(db);
    setSession(admin);
    const res = await callRoute(enrollmentRoute.DELETE, { method: "DELETE", params: enrollmentParams(course, other) });
    expect(res.status).toBe(404);
  });
});

describe("payments", () => {
  const confirm = (course, body = { paymentStatus: "paid" }) =>
    callRoute(enrollmentRoute.PATCH, { method: "PATCH", body, params: enrollmentParams(course, user) });

  it("only admins confirm payments; then the student sees the Meet link", async () => {
    const course = await createCourse(db);
    await createClass(db, {
      status: "enrolled",
      courseId: course._id,
      googleMeetLink: "https://meet.google.com/test-link",
    });
    await enroll(db, user, course, "pending");

    setSession(user);
    expect((await confirm(course)).status).toBe(403);
    let [cls] = (await callRoute(classesRoute.GET, { path: "/api/classes?myClasses=true" })).json.data;
    expect(cls.googleMeetLink).toBeUndefined();

    setSession(admin);
    expect((await confirm(course, { paymentStatus: "pending" })).status).toBe(400);
    expect((await confirm(course)).status).toBe(200);
    expect((await confirm(course)).status).toBe(400);

    setSession(user);
    [cls] = (await callRoute(classesRoute.GET, { path: "/api/classes?myClasses=true" })).json.data;
    expect(cls.googleMeetLink).toBe("https://meet.google.com/test-link");
  });

  it("neither the student nor the admin can remove a paid enrollment", async () => {
    const course = await createCourse(db);
    await enroll(db, user, course, "paid");
    const remove = () => callRoute(enrollmentRoute.DELETE, { method: "DELETE", params: enrollmentParams(course, user) });
    setSession(user);
    expect((await remove()).status).toBe(403);
    setSession(admin);
    expect((await remove()).status).toBe(403);
    expect(await db.collection("courseEnrollments").countDocuments()).toBe(1);
  });
});
