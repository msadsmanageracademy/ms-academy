// Authorization, capacity and payment rules for the courses API.
import { beforeEach, describe, expect, it } from "vitest";
import * as coursesRoute from "@/app/api/courses/route";
import * as courseRoute from "@/app/api/courses/[id]/route";
import * as signUpRoute from "@/app/api/courses/sign-up/[id]/route";
import * as confirmPaymentRoute from "@/app/api/courses/confirm-payment/[id]/route";
import * as cloneRoute from "@/app/api/courses/[id]/clone/route";
import * as removeParticipantRoute from "@/app/api/courses/[id]/remove-participant/route";
import * as classesRoute from "@/app/api/classes/route";
import {
  callRoute,
  createAdmin,
  createClass,
  createCourse,
  createUser,
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

const params = (course) => ({ id: course._id.toString() });

describe("admin-only mutations", () => {
  it("POST /api/courses: anonymous 401, user 403", async () => {
    const body = {
      title: "Course",
      short_description: "Short description",
      full_description: "Full description",
      max_participants: 0,
      price: 100,
    };
    expect((await callRoute(coursesRoute.POST, { method: "POST", body })).status).toBe(401);
    setSession(user);
    expect((await callRoute(coursesRoute.POST, { method: "POST", body })).status).toBe(403);
  });

  it("PATCH, DELETE, clone and remove-participant reject a regular user", async () => {
    const course = await createCourse(db, { status: "draft" });
    setSession(user);
    expect((await callRoute(courseRoute.PATCH, { method: "PATCH", body: { status: "published" }, params: params(course) })).status).toBe(403);
    expect((await callRoute(courseRoute.DELETE, { method: "DELETE", params: params(course) })).status).toBe(403);
    expect((await callRoute(cloneRoute.POST, { method: "POST", params: params(course) })).status).toBe(403);
    expect(
      (await callRoute(removeParticipantRoute.DELETE, { method: "DELETE", path: `/?userId=${other._id}`, params: params(course) })).status,
    ).toBe(403);
    expect(await db.collection("courses").countDocuments()).toBe(1);
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
  const signUp = (course, body = {}) =>
    callRoute(signUpRoute.PATCH, { method: "PATCH", body, params: params(course) });

  it("a user cannot enroll someone else", async () => {
    const course = await createCourse(db);
    setSession(user);
    expect((await signUp(course, { userId: other._id.toString() })).status).toBe(403);
  });

  it("prevents duplicate enrollments, even concurrent ones", async () => {
    const course = await createCourse(db);
    setSession(user);
    const results = await Promise.all([1, 2, 3].map(() => signUp(course)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
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
    expect(results.filter((r) => r.status === 200)).toHaveLength(2);
    expect(await db.collection("courseEnrollments").countDocuments({ courseId: course._id })).toBe(2);
  });
});

describe("payments", () => {
  it("only admins confirm payments; then the student sees the Meet link", async () => {
    const course = await createCourse(db);
    await createClass(db, {
      status: "enrolled",
      courseId: course._id,
      participants: [user._id],
      googleMeetLink: "https://meet.google.com/test-link",
    });
    await enroll(db, user, course, "pending");
    const confirm = () =>
      callRoute(confirmPaymentRoute.PATCH, { method: "PATCH", body: { userId: user._id.toString() }, params: params(course) });

    setSession(user);
    expect((await confirm()).status).toBe(403);
    let [cls] = (await callRoute(classesRoute.GET, { path: "/api/classes?myClasses=true" })).json.data;
    expect(cls.googleMeetLink).toBeUndefined();

    setSession(admin);
    expect((await confirm()).status).toBe(200);

    setSession(user);
    [cls] = (await callRoute(classesRoute.GET, { path: "/api/classes?myClasses=true" })).json.data;
    expect(cls.googleMeetLink).toBe("https://meet.google.com/test-link");
  });

  it("a student cannot cancel a paid course", async () => {
    const course = await createCourse(db);
    await enroll(db, user, course, "paid");
    setSession(user);
    const res = await callRoute(signUpRoute.DELETE, { method: "DELETE", params: params(course) });
    expect(res.status).toBe(403);
    expect(await db.collection("courseEnrollments").countDocuments()).toBe(1);
  });
});
