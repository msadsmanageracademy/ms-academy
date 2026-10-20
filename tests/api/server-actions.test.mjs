// 3.2: Server Actions are thin wrappers over the services (same rules as the REST API).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import {
  createClassCalendarEventAction,
  enrollInClassAction,
  leaveClassAction,
  linkClassToEditionAction,
  saveClassRecordingAction,
  setClassStatusAction,
  unlinkClassFromEditionAction,
} from "@/server/actions/classes";
import {
  cancelEditionEnrollmentAction,
  confirmEditionPaymentAction,
  createEditionAction,
  deleteCourseAction,
  deleteEditionAction,
  enrollInEditionAction,
  removeEditionEnrollmentAction,
  setCourseStatusAction,
  setEditionStatusAction,
} from "@/server/actions/courses";
import { actionResult } from "@/server/actions/result";
import {
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
    const edition = await createEdition(db, await createCourseDoc(db));
    const cls = await createClass(db, { status: "enrolled", editionId: edition._id, recording_url: "https://example.test/r" });
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

describe("class ↔ edition actions", () => {
  it("link and unlink a draft class (admin only), with plain data", async () => {
    const edition = await createEdition(db, await createCourseDoc(db), { status: "draft" });
    const cls = await createClass(db, { status: "draft", createdBy: admin._id });
    const classId = cls._id.toString();
    const editionId = edition._id.toString();

    setSession(user);
    expect(await linkClassToEditionAction(classId, editionId)).toMatchObject({ ok: false, status: 403 });
    setSession(admin);
    expect(await linkClassToEditionAction(classId, "nope")).toMatchObject({ ok: false, status: 400 });
    expect(await linkClassToEditionAction(classId, editionId)).toMatchObject({
      ok: true,
      message: "Clase vinculada a la edición",
      data: { _id: classId, editionId, status: "enrolled" },
    });
    expect(await unlinkClassFromEditionAction(classId)).toMatchObject({
      ok: true,
      message: "Clase desvinculada de la edición",
      data: { status: "draft" },
    });
    expect((await db.collection("classes").findOne({ _id: cls._id })).editionId).toBeUndefined();
  });
});

describe("course and edition actions", () => {
  /** Published edition with one class in a week. */
  async function openEdition(course) {
    const edition = await createEdition(db, course);
    await createClass(db, { editionId: edition._id, status: "enrolled", start_date: daysFromNow(7) });
    return edition;
  }

  it("pre-enroll, admin confirms the payment, a paid enrollment can't be cancelled", async () => {
    const edition = await openEdition(await createCourseDoc(db));
    const editionId = edition._id.toString();
    setSession(user);
    expect(await enrollInEditionAction(editionId)).toMatchObject({ ok: true, data: { paymentStatus: "pending" } });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(await confirmEditionPaymentAction(editionId, user._id.toString())).toMatchObject({ ok: false, status: 403 });

    setSession(admin);
    expect(await confirmEditionPaymentAction(editionId, user._id.toString())).toMatchObject({
      ok: true,
      data: { paymentStatus: "paid" },
    });

    setSession(user);
    expect(await cancelEditionEnrollmentAction(editionId)).toMatchObject({ ok: false, status: 403 });
  });

  it("the student cancels a pending enrollment; the admin removes another one", async () => {
    const edition = await openEdition(await createCourseDoc(db));
    const editionId = edition._id.toString();
    const other = await createUser(db);
    await enrollInEditionDoc(db, user, edition, "pending");
    await enrollInEditionDoc(db, other, edition, "pending");

    setSession(user);
    expect(await removeEditionEnrollmentAction(editionId, other._id.toString())).toMatchObject({ ok: false, status: 403 });
    expect(await cancelEditionEnrollmentAction(editionId)).toMatchObject({ ok: true, message: "Inscripción cancelada con éxito" });
    setSession(admin);
    expect(await removeEditionEnrollmentAction(editionId, other._id.toString())).toMatchObject({
      ok: true,
      message: "Participante removido con éxito",
    });
    expect(await db.collection("courseEnrollments").countDocuments()).toBe(0);
  });

  it("createEdition returns the new id as a string (and no number)", async () => {
    const course = await createCourseDoc(db);
    await openEdition(course);
    setSession(user);
    expect(await createEditionAction(course._id.toString())).toMatchObject({ ok: false, status: 403 });
    setSession(admin);
    const res = await createEditionAction(course._id.toString());
    expect(res).toMatchObject({ ok: true, message: "Edición creada con éxito", data: { _id: expect.any(String) } });
    expect(res.data).not.toHaveProperty("number");
    expect(typeof res.data._id).toBe("string");
    expect(await db.collection("courseEditions").countDocuments({ courseId: course._id })).toBe(2);
  });

  it("edition status and deletion follow the service rules", async () => {
    const course = await createCourseDoc(db);
    const published = await openEdition(course);
    const draft = await createEdition(db, course, { status: "draft" });
    setSession(admin);
    expect(await setEditionStatusAction(draft._id.toString(), "published")).toMatchObject({ ok: false, status: 400 });
    expect(await deleteEditionAction(published._id.toString())).toMatchObject({ ok: false, status: 400 });
    expect(await setEditionStatusAction(published._id.toString(), "draft")).toMatchObject({
      ok: true,
      data: { _id: published._id.toString(), status: "draft" },
    });
    expect(await deleteEditionAction(draft._id.toString())).toMatchObject({ ok: true, message: "Edición eliminada con éxito" });
    expect(await db.collection("courseEditions").countDocuments()).toBe(1);
  });

  it("course status and deletion", async () => {
    const course = await createCourseDoc(db);
    await createEdition(db, course, { status: "draft" });
    const courseId = course._id.toString();
    setSession(user);
    expect(await setCourseStatusAction(courseId, "archived")).toMatchObject({ ok: false, status: 403 });
    setSession(admin);
    expect(await setCourseStatusAction(courseId, "draft")).toMatchObject({ ok: false, status: 400 });
    expect(await setCourseStatusAction(courseId, "archived")).toMatchObject({ ok: true, data: { status: "archived" } });
    expect(await deleteCourseAction(courseId)).toMatchObject({ ok: true, message: "Curso eliminado con éxito" });
    expect(await db.collection("courses").countDocuments()).toBe(0);
    expect(await db.collection("courseEditions").countDocuments()).toBe(0);
  });
});
