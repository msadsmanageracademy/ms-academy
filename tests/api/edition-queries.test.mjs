// Edition queries (src/server/courses/queries.js): schedule derived from the classes,
// enrollment counts and review stats per edition.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  editionAggregationPipeline,
  findCourseEditions,
  getEditionDateRange,
  getEditionLabels,
  getEditionTimeStatusFromClasses,
  getEnrollmentCounts,
} from "@/server/courses/queries";
import { getCourseReviewStats, getEditionReviewStats } from "@/server/reviews/queries";
import {
  ObjectId,
  createClass,
  createCourseDoc,
  createEdition,
  createUser,
  daysFromNow,
  enrollInEditionDoc,
  resetDb,
} from "../helpers.mjs";
import { dateAround, forAll, gen } from "../support/random.mjs";

let db;

const NOW = new Date("2026-06-15T15:00:00Z");
const MINUTE = 60000;

describe("editionAggregationPipeline", () => {
  beforeAll(async () => {
    db = await resetDb();
  });

  it("Feature: course-editions, Property 1: Fechas derivadas de las clases", async () => {
    const classGen = gen.record({
      start_date: gen.oneOf(dateAround(NOW), dateAround(NOW), gen.constant(null)),
      duration: gen.pick([30, 45, 60, 90, 120]),
    });
    const caseGen = gen.record({
      editionId: gen.objectId(),
      classes: gen.array(classGen, { max: 6 }),
      // Classes of another edition must never count
      noise: gen.array(classGen, { min: 1, max: 3 }),
    });

    await forAll(caseGen, async ({ editionId, classes, noise }) => {
      await db
        .collection("courseEditions")
        .insertOne({ _id: editionId, courseId: new ObjectId(), status: "published" });
      const otherId = new ObjectId();
      const docs = [
        ...classes.map((c) => ({ ...c, editionId, status: "enrolled", title: "Clase" })),
        ...noise.map((c) => ({ ...c, editionId: otherId, status: "enrolled", title: "Otra" })),
      ];
      await db.collection("classes").insertMany(docs);

      const dated = classes.filter((c) => c.start_date);
      const expectedStart = dated.length ? Math.min(...dated.map((c) => c.start_date.getTime())) : null;
      const expectedEnd = dated.length
        ? Math.max(...dated.map((c) => c.start_date.getTime() + c.duration * MINUTE))
        : null;

      const [row] = await db
        .collection("courseEditions")
        .aggregate(editionAggregationPipeline({ _id: editionId }))
        .toArray();
      expect(row.amount_of_classes).toBe(classes.length);
      expect(row.total_duration).toBe(classes.reduce((sum, c) => sum + c.duration, 0));
      expect(row.start_date?.getTime() ?? null).toBe(expectedStart);
      expect(row.end_date?.getTime() ?? null).toBe(expectedEnd);
      expect(row).not.toHaveProperty("editionClasses");

      // The date range query agrees with the aggregation
      const range = await getEditionDateRange(db, editionId);
      if (classes.length === 0) {
        expect(range).toEqual({});
      } else {
        expect(range.start_date?.getTime() ?? null).toBe(expectedStart);
        expect(range.end_date?.getTime() ?? null).toBe(expectedEnd);
      }
    });
    // 100 DB-backed runs: a few seconds alone, much slower while the whole suite runs in parallel
  }, 60_000);
});

describe("edition queries", () => {
  let course, first, second;

  beforeEach(async () => {
    db = await resetDb();
    course = await createCourseDoc(db, { title: "Meta Ads" });
    first = await createEdition(db, course);
    second = await createEdition(db, course, { status: "draft" });
  });

  it("findCourseEditions returns every edition chronologically, with schedule, time status, label and adminNumber", async () => {
    await createEdition(db, await createCourseDoc(db)); // another course
    await createClass(db, { editionId: first._id, status: "enrolled", start_date: daysFromNow(-20), duration: 60 });
    await createClass(db, { editionId: first._id, status: "enrolled", start_date: daysFromNow(-10), duration: 60 });
    // Created last but starting first: the order follows the first class, not the creation
    const earliest = await createEdition(db, course);
    await createClass(db, { editionId: earliest._id, status: "enrolled", start_date: daysFromNow(-90), duration: 60 });

    const editions = await findCourseEditions(db, course._id);
    expect(editions.map((e) => [e._id.toString(), e.adminNumber, e.amount_of_classes, e.timeStatus])).toEqual([
      [earliest._id.toString(), 1, 1, "completed"],
      [first._id.toString(), 2, 2, "completed"],
      [second._id.toString(), 3, 0, null],
    ]);
    expect(editions[0].label).toMatch(/^[A-ZÁÉÍÓÚ][a-záéíóú]+ \d{4}$/);
    expect(editions[2]).toMatchObject({ label: "Sin fecha", start_date: null });
    expect(editions.every((e) => !("number" in e))).toBe(true);
  });

  it("getEditionLabels labels every edition of the given courses (drafts included)", async () => {
    const sep = (day) => new Date(Date.UTC(2030, 8, day, 22));
    await createClass(db, { editionId: first._id, status: "enrolled", start_date: sep(20) });
    await createClass(db, { editionId: second._id, status: "enrolled", start_date: sep(3) });
    await createClass(db, { editionId: second._id, status: "enrolled", start_date: sep(25) });
    const other = await createCourseDoc(db);
    const otherEdition = await createEdition(db, other);
    await createClass(db, { editionId: otherEdition._id, status: "enrolled", start_date: sep(1) });

    const labels = await getEditionLabels(db, [course._id]);
    expect(labels.size).toBe(2);
    expect(labels.get(second._id.toString())).toEqual({ label: "Septiembre 2030", adminNumber: 1 });
    expect(labels.get(first._id.toString())).toEqual({ label: "Septiembre 2030 (2)", adminNumber: 2 });
    expect((await getEditionLabels(db, [course._id, other._id])).get(otherEdition._id.toString())).toEqual({
      label: "Septiembre 2030",
      adminNumber: 1,
    });
    expect((await getEditionLabels(db, [])).size).toBe(0);
  });

  it("getEditionDateRange can exclude a class; the time status follows the classes", async () => {
    const past = await createClass(db, { editionId: first._id, status: "enrolled", start_date: daysFromNow(-2) });
    await createClass(db, { editionId: first._id, status: "enrolled", start_date: daysFromNow(5) });

    expect(await getEditionTimeStatusFromClasses(db, first._id, "published")).toBe("in-progress");
    expect(await getEditionTimeStatusFromClasses(db, first._id, "published", { excludeClassId: past._id })).toBe(
      "upcoming",
    );
    expect(await getEditionTimeStatusFromClasses(db, first._id, "draft")).toBeNull();
    expect(await getEditionDateRange(db, second._id)).toEqual({});
  });

  it("getEnrollmentCounts counts total and paid per edition", async () => {
    const users = await Promise.all([1, 2, 3].map(() => createUser(db)));
    await enrollInEditionDoc(db, users[0], first, "paid");
    await enrollInEditionDoc(db, users[1], first, "pending");
    await enrollInEditionDoc(db, users[2], second, "paid");

    expect(await getEnrollmentCounts(db, [first._id, second._id])).toEqual({
      [first._id.toString()]: { total: 2, paid: 1 },
      [second._id.toString()]: { total: 1, paid: 1 },
    });
    expect(await getEnrollmentCounts(db, [])).toEqual({});
  });

  it("review stats per edition and per course (every edition counts)", async () => {
    const users = await Promise.all([1, 2, 3].map(() => createUser(db)));
    const review = (user, edition, rating) =>
      db.collection("reviews").insertOne({
        userId: user._id,
        courseId: course._id,
        editionId: edition._id,
        rating,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    await review(users[0], first, 5);
    await review(users[1], first, 4);
    await review(users[2], second, 3);

    expect(await getEditionReviewStats(db, [first._id, second._id])).toEqual({
      [first._id.toString()]: { avgRating: 4.5, reviewCount: 2 },
      [second._id.toString()]: { avgRating: 3, reviewCount: 1 },
    });
    expect(await getCourseReviewStats(db, [course._id])).toEqual({
      [course._id.toString()]: { avgRating: 4, reviewCount: 3 },
    });
    expect(await getEditionReviewStats(db, [])).toEqual({});
  });
});
