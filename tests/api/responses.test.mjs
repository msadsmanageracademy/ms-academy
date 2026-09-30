// 2.5: reviews, notifications, users and contact go through services with the
// same response format: { success, message?, data? } and { success: false, message, details? }.
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { config } from "@/config";
import * as classReviewsRoute from "@/app/api/classes/[id]/reviews/route";
import * as courseReviewsRoute from "@/app/api/courses/[id]/reviews/route";
import * as myReviewsRoute from "@/app/api/reviews/route";
import * as notificationsRoute from "@/app/api/notifications/route";
import * as notificationRoute from "@/app/api/notifications/[id]/route";
import * as userRoute from "@/app/api/users/[id]/route";
import * as registerRoute from "@/app/api/auth/register/route";
import * as contactRoute from "@/app/api/contact/route";
import {
  callRoute,
  createAdmin,
  createClass,
  createCourse,
  createUser,
  daysFromNow,
  enroll,
  ObjectId,
  resetDb,
  setSession,
} from "../helpers.mjs";

// Resend is replaced so no email leaves the tests; `resendResult` controls the outcome
const resendResult = { current: { data: { id: "email-1" }, error: null } };
const sentEmails = [];
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (email) => {
        sentEmails.push(email);
        return resendResult.current;
      },
    };
  },
}));

let db, admin, user, other;

beforeEach(async () => {
  db = await resetDb();
  admin = await createAdmin(db);
  user = await createUser(db);
  other = await createUser(db);
  setSession(null);
  sentEmails.length = 0;
  resendResult.current = { data: { id: "email-1" }, error: null };
});

const expectError = (res, status) => {
  expect(res.status).toBe(status);
  expect(res.json.success).toBe(false);
  expect(typeof res.json.message).toBe("string");
};

describe("reviews", () => {
  it("course reviews: only paid enrollees; the series listing covers every iteration", async () => {
    const first = await createCourse(db);
    await db.collection("courses").updateOne({ _id: first._id }, { $set: { courseSeriesId: first._id } });
    const second = await createCourse(db, { courseSeriesId: first._id });
    await enroll(db, user, first, "paid");
    await enroll(db, other, second, "pending");
    const review = (course, body = { rating: 4, comment: "Bien" }) =>
      callRoute(courseReviewsRoute.POST, { method: "POST", body, params: { id: course._id.toString() } });

    expectError(await review(first), 401);
    setSession(other);
    expectError(await review(second), 403);
    setSession(user);
    expectError(await review(first, { rating: 9 }), 400);
    const saved = await review(first);
    expect(saved.status).toBe(200);
    expect(saved.json).toMatchObject({ success: true, message: "Reseña guardada", data: { rating: 4 } });
    // Upsert: a second review replaces the first one
    await review(first, { rating: 5 });
    expect(await db.collection("reviews").countDocuments()).toBe(1);

    await db.collection("reviews").insertOne({ courseId: second._id, userId: admin._id, rating: 3, createdAt: new Date() });
    const list = (params, path = "/") => callRoute(courseReviewsRoute.GET, { params, path });
    expect((await list({ id: second._id.toString() })).json.data).toHaveLength(1);
    expect((await list({ id: second._id.toString() }, "/?series=true")).json.data).toHaveLength(2);
    expectError(await list({ id: "nope" }), 400);
  });

  it("class reviews list and my reviews use the same envelope", async () => {
    const cls = await createClass(db, { participants: [user._id], start_date: daysFromNow(-1), duration: 30 });
    setSession(user);
    expect(
      (await callRoute(classReviewsRoute.POST, { method: "POST", body: { rating: 5 }, params: { id: cls._id.toString() } })).status,
    ).toBe(200);
    const list = await callRoute(classReviewsRoute.GET, { params: { id: cls._id.toString() } });
    expect(list.json).toMatchObject({ success: true, data: [{ rating: 5 }] });
    const mine = await callRoute(myReviewsRoute.GET);
    expect(mine.json.data).toHaveLength(1);
    setSession(null);
    expectError(await callRoute(myReviewsRoute.GET), 401);
  });
});

describe("notifications inbox", () => {
  const insertNotification = (owner, read = false) =>
    db.collection("notifications").insertOne({
      userId: owner._id,
      type: "class.created",
      title: "T",
      message: "M",
      read,
      createdAt: new Date(),
    });

  it("lists with pagination and only touches the user's own notifications", async () => {
    for (let i = 0; i < 12; i++) await insertNotification(user);
    const { insertedId: foreign } = await insertNotification(other);

    expectError(await callRoute(notificationsRoute.GET), 401);
    setSession(user);
    const page2 = await callRoute(notificationsRoute.GET, { path: "/?page=2" });
    expect(page2.json.data).toHaveLength(2);
    expect(page2.json.pagination).toEqual({ page: 2, limit: 10, total: 12, pages: 2 });

    // Someone else's notification looks like it doesn't exist
    expectError(await callRoute(notificationRoute.PATCH, { method: "PATCH", params: { id: foreign.toString() } }), 404);
    expectError(await callRoute(notificationRoute.DELETE, { method: "DELETE", params: { id: foreign.toString() } }), 404);
    expectError(await callRoute(notificationRoute.PATCH, { method: "PATCH", params: { id: "nope" } }), 400);
    expect((await db.collection("notifications").findOne({ _id: foreign })).read).toBe(false);
  });

  it("marks all as read and deletes the read ones", async () => {
    await insertNotification(user);
    await insertNotification(user);
    await insertNotification(other);
    setSession(user);

    expectError(await callRoute(notificationsRoute.PATCH, { method: "PATCH", body: {} }), 400);
    const marked = await callRoute(notificationsRoute.PATCH, { method: "PATCH", body: { read: true } });
    expect(marked.json.data).toEqual({ modifiedCount: 2 });

    const deleted = await callRoute(notificationsRoute.DELETE, { method: "DELETE" });
    expect(deleted.json).toMatchObject({ success: true, data: { deletedCount: 2 } });
    expect(await db.collection("notifications").countDocuments({ userId: other._id })).toBe(1);
  });
});

describe("users", () => {
  const registerBody = (overrides = {}) => ({
    first_name: "Ana",
    last_name: "Pérez",
    email: `Ana-${new ObjectId()}@Example.test`,
    password: "Str0ng!Passw0rd",
    ...overrides,
  });

  it("registers with a normalized email; duplicates and extra fields are rejected", async () => {
    // Registration is disabled in the app config; enabled only for this test
    const previous = config.allowRegistration;
    config.allowRegistration = true;
    onTestFinished(() => {
      config.allowRegistration = previous;
    });
    const body = registerBody();
    const res = await callRoute(registerRoute.POST, { method: "POST", body });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ success: true, data: { first_name: "Ana" } });
    const saved = await db.collection("users").findOne({ email: body.email.toLowerCase() });
    expect(saved.role).toBe("user");

    expectError(await callRoute(registerRoute.POST, { method: "POST", body }), 400);
    expectError(await callRoute(registerRoute.POST, { method: "POST", body: registerBody({ role: "admin" }) }), 400);
  });

  it("profile: read by self or admin, edited only by self", async () => {
    const params = { id: user._id.toString() };
    setSession(other);
    expectError(await callRoute(userRoute.GET, { params }), 403);
    setSession(admin);
    const read = await callRoute(userRoute.GET, { params });
    expect(read.json.data).not.toHaveProperty("password");
    expectError(await callRoute(userRoute.PATCH, { method: "PATCH", body: { first_name: "X" }, params }), 403);

    setSession(user);
    const edit = await callRoute(userRoute.PATCH, { method: "PATCH", body: { first_name: "Nuevo" }, params });
    expect(edit.json).toMatchObject({ success: true, data: { first_name: "Nuevo" } });
    expectError(await callRoute(userRoute.PATCH, { method: "PATCH", body: { role: "admin" }, params }), 400);
    expect((await db.collection("users").findOne({ _id: user._id })).role).toBe("user");
  });
});

describe("contact", () => {
  const body = { name: "Ana", email: "ana@example.test", subject: "Consulta", message: "Hola, quería consultar algo" };
  const send = (payload) => callRoute(contactRoute.POST, { method: "POST", body: payload });

  it("validates with the first issue's message and sends nothing", async () => {
    const res = await send({ ...body, email: "nope" });
    expectError(res, 400);
    expect(res.json.message).toBe("Ingresá un email válido");
    expect(sentEmails).toHaveLength(0);
  });

  it("sends the email; a Resend failure is reported instead of faking success", async () => {
    const okRes = await send(body);
    expect(okRes.json).toMatchObject({ success: true, message: "Mensaje enviado" });
    expect(sentEmails[0]).toMatchObject({ replyTo: "ana@example.test", subject: "[Contacto] Consulta" });

    vi.spyOn(console, "error").mockImplementation(() => {});
    resendResult.current = { data: null, error: { message: "down" } };
    expectError(await send(body), 502);
  });
});
