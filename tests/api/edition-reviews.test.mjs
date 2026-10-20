// Edition reviews: one per student and edition, only after paying a finished edition,
// stored with the denormalized courseId of the edition.
import { beforeEach, describe, expect, it } from "vitest";
import { listCourseReviews, listMyReviews, submitEditionReview } from "@/server/reviews/service";
import {
  ObjectId,
  createAdmin,
  createClass,
  createCourseDoc,
  createEdition,
  createUser,
  daysFromNow,
  enrollInEditionDoc,
  resetDb,
} from "../helpers.mjs";
import { forAll, gen } from "../support/random.mjs";

let db;

const actorOf = (u) => ({ id: u._id.toString(), role: u.role, email: u.email, name: u.first_name });

/** Published edition whose only class is `startDays` from now (negative = finished). */
async function editionWithClass(course, startDays, overrides = {}) {
  const edition = await createEdition(db, course, overrides);
  await createClass(db, { editionId: edition._id, status: "enrolled", start_date: daysFromNow(startDays), duration: 60 });
  return edition;
}
const finishedEdition = (course, overrides) => editionWithClass(course, -10, overrides);

beforeEach(async () => {
  db = await resetDb();
});

describe("submitEditionReview", () => {
  it("Feature: course-editions, Property 14: Una reseña por alumno y edición", async () => {
    // Setup shared by every run: 2 courses × 2 finished editions, 3 students who paid all of them
    const courses = [await createCourseDoc(db, { title: "A" }), await createCourseDoc(db, { title: "B" })];
    const editions = [];
    for (const course of courses) {
      for (let i = 0; i < 2; i++) editions.push(await finishedEdition(course));
    }
    const students = await Promise.all(["Ana", "Bruno", "Carla"].map((first_name) => createUser(db, { first_name })));
    for (const student of students) {
      for (const edition of editions) await enrollInEditionDoc(db, student, edition, "paid");
    }

    const submissionGen = gen.record({
      student: gen.int(0, students.length - 1),
      edition: gen.int(0, editions.length - 1),
      rating: gen.int(1, 5),
      comment: gen.oneOf(gen.constant(undefined), gen.string({ min: 1, max: 30 })),
    });

    await forAll(gen.array(submissionGen, { min: 1, max: 10 }), async (submissions) => {
      await db.collection("reviews").deleteMany({});
      const expected = new Map(); // "student:edition" → last submission
      for (const submission of submissions) {
        const edition = editions[submission.edition];
        const saved = await submitEditionReview(actorOf(students[submission.student]), edition._id.toString(), {
          rating: submission.rating,
          ...(submission.comment !== undefined ? { comment: submission.comment } : {}),
        });
        expect(saved.courseId.equals(edition.courseId)).toBe(true);
        expected.set(`${submission.student}:${submission.edition}`, submission);
      }

      const stored = await db.collection("reviews").find({}).toArray();
      expect(stored).toHaveLength(expected.size);
      for (const [key, { student, edition, rating, comment }] of expected) {
        const matching = stored.filter(
          (r) => r.userId.equals(students[student]._id) && r.editionId.equals(editions[edition]._id),
        );
        expect(matching, key).toHaveLength(1);
        expect(matching[0]).toMatchObject({ rating, comment: comment ?? "", firstName: students[student].first_name });
        expect(matching[0].courseId.equals(editions[edition].courseId)).toBe(true);
      }
    });
    // 100 DB-backed runs: a few seconds alone, much slower while the whole suite runs in parallel
  }, 60_000);

  it("lets a student review every edition of the same course", async () => {
    const course = await createCourseDoc(db);
    const first = await finishedEdition(course);
    const second = await finishedEdition(course);
    const student = await createUser(db);
    await enrollInEditionDoc(db, student, first, "paid");
    await enrollInEditionDoc(db, student, second, "paid");

    await submitEditionReview(actorOf(student), first._id.toString(), { rating: 4 });
    await submitEditionReview(actorOf(student), second._id.toString(), { rating: 5, comment: "Mejor aún" });
    expect(await db.collection("reviews").countDocuments({ userId: student._id, courseId: course._id })).toBe(2);

    const mine = await listMyReviews(actorOf(student));
    expect(mine.map((r) => r.editionId.toString()).sort()).toEqual([first._id.toString(), second._id.toString()].sort());
    expect(mine[0]).toHaveProperty("courseId");
  });

  it("403 without a confirmed payment", async () => {
    const edition = await finishedEdition(await createCourseDoc(db));
    const pending = await createUser(db);
    const stranger = await createUser(db);
    await enrollInEditionDoc(db, pending, edition, "pending");

    for (const user of [pending, stranger]) {
      await expect(submitEditionReview(actorOf(user), edition._id.toString(), { rating: 5 })).rejects.toMatchObject({
        status: 403,
        message: "Solo inscriptos con pago confirmado pueden dejar una reseña",
      });
    }
    expect(await db.collection("reviews").countDocuments()).toBe(0);
  });

  it("403 while the edition has not finished (upcoming, in progress or draft)", async () => {
    const course = await createCourseDoc(db);
    const upcoming = await editionWithClass(course, 5);
    const inProgress = await createEdition(db, course);
    await createClass(db, { editionId: inProgress._id, status: "enrolled", start_date: daysFromNow(-3) });
    await createClass(db, { editionId: inProgress._id, status: "enrolled", start_date: daysFromNow(3) });
    const draft = await finishedEdition(course, { status: "draft" });
    const student = await createUser(db);
    for (const edition of [upcoming, inProgress, draft]) {
      await enrollInEditionDoc(db, student, edition, "paid");
      await expect(submitEditionReview(actorOf(student), edition._id.toString(), { rating: 5 })).rejects.toMatchObject({
        status: 403,
        message: "Solo podés dejar una reseña una vez que la edición haya finalizado",
      });
    }
    expect(await db.collection("reviews").countDocuments()).toBe(0);
  });

  it("validates the actor, the id, the edition and the rating", async () => {
    const edition = await finishedEdition(await createCourseDoc(db));
    const student = await createUser(db);
    await enrollInEditionDoc(db, student, edition, "paid");
    const id = edition._id.toString();

    await expect(submitEditionReview(null, id, { rating: 5 })).rejects.toMatchObject({ status: 401 });
    await expect(submitEditionReview(actorOf(student), "nope", { rating: 5 })).rejects.toMatchObject({
      status: 400,
      message: "ID de edición inválido",
    });
    await expect(
      submitEditionReview(actorOf(student), new ObjectId().toString(), { rating: 5 }),
    ).rejects.toMatchObject({ status: 404, message: "Edición no encontrada" });
    await expect(submitEditionReview(actorOf(student), id, { rating: 0 })).rejects.toMatchObject({ status: 400 });
    await expect(
      submitEditionReview(actorOf(student), id, { rating: 5, comment: "x".repeat(501) }),
    ).rejects.toMatchObject({ status: 400 });
    expect(await db.collection("reviews").countDocuments()).toBe(0);
  });

  it("admins can't review editions or classes (403), even finished ones", async () => {
    const { submitClassReview } = await import("@/server/reviews/service");
    const course = await createCourseDoc(db);
    const edition = await finishedEdition(course);
    const admin = await createAdmin(db, { first_name: "Admin" });
    const pastClass = await createClass(db, { start_date: daysFromNow(-3) });

    await expect(submitEditionReview(actorOf(admin), edition._id.toString(), { rating: 5 })).rejects.toMatchObject({
      status: 403,
      message: "Los administradores no pueden dejar reseñas",
    });
    await expect(submitClassReview(actorOf(admin), pastClass._id.toString(), { rating: 5 })).rejects.toMatchObject({
      status: 403,
    });
    expect(await db.collection("reviews").countDocuments()).toBe(0);
  });
});

describe("listCourseReviews", () => {
  it("404 for an unknown course or an edition of another course; 400 for invalid ids", async () => {
    const course = await createCourseDoc(db);
    await createEdition(db, course);
    const otherEdition = await createEdition(db, await createCourseDoc(db));
    const id = course._id.toString();

    await expect(listCourseReviews(new ObjectId().toString())).rejects.toMatchObject({
      status: 404,
      message: "Curso no encontrado",
    });
    await expect(listCourseReviews(id, { editionId: otherEdition._id.toString() })).rejects.toMatchObject({
      status: 404,
      message: "Edición no encontrada",
    });
    await expect(listCourseReviews(id, { editionId: new ObjectId().toString() })).rejects.toMatchObject({ status: 404 });
    await expect(listCourseReviews("nope")).rejects.toMatchObject({ status: 400, message: "ID de curso inválido" });
    await expect(listCourseReviews(id, { editionId: "nope" })).rejects.toMatchObject({
      status: 400,
      message: "ID de edición inválido",
    });
  });

  it("an empty course answers one empty page", async () => {
    const course = await createCourseDoc(db);
    await createEdition(db, course);
    expect(await listCourseReviews(course._id.toString(), { page: 3 })).toEqual({
      items: [],
      page: 1,
      totalPages: 1,
      total: 0,
    });
  });

  it("an out-of-range page falls back to the last one, with the edition of each review", async () => {
    const course = await createCourseDoc(db);
    const first = await finishedEdition(course);
    const second = await finishedEdition(course);
    const users = await Promise.all([0, 1, 2].map((i) => createUser(db, { first_name: `U${i}` })));
    for (const [i, edition] of [first, second, second].entries()) {
      await enrollInEditionDoc(db, users[i], edition, "paid");
      await submitEditionReview(actorOf(users[i]), edition._id.toString(), { rating: 3 + i });
    }

    const result = await listCourseReviews(course._id.toString(), { page: 99, pageSize: 2 });
    expect(result).toMatchObject({ page: 2, totalPages: 2, total: 3 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ editionId: first._id, rating: 3 });
    expect(result.items[0]).not.toHaveProperty("editionNumber");
    // Both editions start the same day: the first one has the bare month label
    expect(result.items[0].editionLabel).toMatch(/^[A-ZÁÉÍÓÚ][a-záéíóú]+ \d{4}$/);

    const onlySecond = await listCourseReviews(course._id.toString(), { editionId: second._id.toString() });
    expect(onlySecond).toMatchObject({ page: 1, totalPages: 1, total: 2 });
    expect(onlySecond.items.map((r) => r.editionLabel)).toEqual([
      `${result.items[0].editionLabel} (2)`,
      `${result.items[0].editionLabel} (2)`,
    ]);
  });
});
