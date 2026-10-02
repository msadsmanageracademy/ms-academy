// 3.2: Server Actions are thin wrappers over the services (same rules as the REST API).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import {
  createClassCalendarEventAction,
  enrollInClassAction,
  leaveClassAction,
  saveClassRecordingAction,
  setClassStatusAction,
} from "@/server/actions/classes";
import {
  cancelCourseEnrollmentAction,
  cloneCourseAction,
  confirmCoursePaymentAction,
  enrollInCourseAction,
} from "@/server/actions/courses";
import { actionResult } from "@/server/actions/result";
import {
  createAdmin,
  createClass,
  createCourse,
  createUser,
  enroll,
  resetDb,
  setSession,
} from "../helpers.mjs";

let db, admin, user;

beforeEach(async () => {
  db = await resetDb();
  admin = await createAdmin(db);
  user = await createUser(db);
  setSession(null);
  vi.mocked(revalidatePath).mockClear();
});

describe("actionResult", () => {
  it("returns plain data (ObjectId and Date become strings)", async () => {
    const res = await actionResult("ctx", async () => ({ message: "Hecho", data: { _id: admin._id, at: new Date(0) } }));
    expect(res).toEqual({
      ok: true,
      success: true,
      message: "Hecho",
      data: { _id: admin._id.toString(), at: "1970-01-01T00:00:00.000Z" },
    });
  });

  it("returns errors instead of throwing, without internal details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await actionResult("ctx", async () => {
      throw new Error("secret connection string");
    });
    expect(res).toEqual({ ok: false, success: false, status: 500, message: "Error en el servidor" });
  });
});

describe("class actions", () => {
  it("enroll and leave use the session user and refresh the pages", async () => {
    const cls = await createClass(db);
    expect(await enrollInClassAction(cls._id.toString())).toMatchObject({ ok: false, status: 401 });
    expect(revalidatePath).not.toHaveBeenCalled();

    setSession(user);
    expect(await enrollInClassAction(cls._id.toString())).toMatchObject({ ok: true, message: "Inscripción realizada con éxito" });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect((await db.collection("classes").findOne({ _id: cls._id })).participants).toHaveLength(1);

    expect(await leaveClassAction(cls._id.toString())).toMatchObject({ ok: true });
    expect((await db.collection("classes").findOne({ _id: cls._id })).participants).toEqual([]);
  });

  it("admin-only actions reject students and validate input", async () => {
    const cls = await createClass(db, { status: "draft" });
    setSession(user);
    expect(await setClassStatusAction(cls._id.toString(), "published")).toMatchObject({ ok: false, status: 403 });
    setSession(admin);
    expect(await setClassStatusAction(cls._id.toString(), "nope")).toMatchObject({ ok: false, status: 400 });
    expect(await setClassStatusAction("not-an-id", "published")).toMatchObject({ ok: false, status: 400 });
    const res = await setClassStatusAction(cls._id.toString(), "published");
    expect(res).toMatchObject({ ok: true, data: { _id: cls._id.toString(), status: "published" } });
  });

  it("saving an empty recording URL removes it", async () => {
    const course = await createCourse(db);
    const cls = await createClass(db, { status: "enrolled", courseId: course._id, recording_url: "https://example.test/r" });
    setSession(admin);
    expect(await saveClassRecordingAction(cls._id.toString(), "  ")).toMatchObject({ ok: true, message: "Grabación eliminada" });
    expect((await db.collection("classes").findOne({ _id: cls._id })).recording_url).toBeUndefined();
  });

  it("the Calendar action asks to authorize again when there are no tokens", async () => {
    const cls = await createClass(db, { status: "draft" });
    setSession(admin);
    const res = await createClassCalendarEventAction(cls._id.toString());
    expect(res).toMatchObject({ ok: false, status: 401, requiresReauth: true });
  });
});

describe("course actions", () => {
  it("pre-enroll, admin confirms the payment, a paid enrollment can't be cancelled", async () => {
    const course = await createCourse(db);
    const courseId = course._id.toString();
    setSession(user);
    expect(await enrollInCourseAction(courseId)).toMatchObject({ ok: true, data: { paymentStatus: "pending" } });
    expect(await confirmCoursePaymentAction(courseId, user._id.toString())).toMatchObject({ ok: false, status: 403 });

    setSession(admin);
    expect(await confirmCoursePaymentAction(courseId, user._id.toString())).toMatchObject({ ok: true });

    setSession(user);
    expect(await cancelCourseEnrollmentAction(courseId)).toMatchObject({ ok: false, status: 403 });
  });

  it("clone returns the new id as a string", async () => {
    const course = await createCourse(db);
    await enroll(db, user, course);
    setSession(admin);
    const res = await cloneCourseAction(course._id.toString());
    expect(res.ok).toBe(true);
    expect(typeof res.data._id).toBe("string");
    expect(await db.collection("courses").countDocuments()).toBe(2);
  });
});
