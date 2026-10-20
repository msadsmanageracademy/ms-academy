// Public catalog (listCourses): active courses with an edition open to enrollment,
// each with that edition and the ratings of the whole course.
import { beforeAll, describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { listCourses } from "@/server/courses/service";
import { createUser, resetDb } from "../helpers.mjs";
import { forAll, gen } from "../support/random.mjs";
import { pickOpenEdition, withEditionLabels, withTimeStatus } from "@/utils/courseEditions";

const DAY = 86400000;
const MINUTE = 60000;

let db;

// Whole days from now plus 30 minutes: no class starts or ends close to the moment the
// listing runs, so the time status cannot change between the model and the query
const classGen = gen.record({
  dayOffset: gen.oneOf(gen.int(-60, 60), gen.constant(null)),
  duration: gen.pick([60, 90, 120]),
});
const editionGen = gen.record({
  status: gen.pick(["draft", "published", "published"]),
  price: gen.pick([0, 1000, 2500, 49990]),
  max_participants: gen.oneOf(gen.constant(null), gen.int(1, 30)),
  classes: gen.array(classGen, { max: 3 }),
  enrollments: gen.int(0, 3),
});
const courseGen = gen.record({
  status: gen.pick(["active", "active", "archived"]),
  editions: gen.array(editionGen, { max: 4 }),
  ratings: gen.array(gen.int(1, 5), { max: 4 }),
});

const round = (n) => Math.round(n * 100) / 100;

async function insertScenario(courses, now) {
  const docs = { courses: [], courseEditions: [], classes: [], courseEnrollments: [], reviews: [] };
  const model = [];
  courses.forEach((course, i) => {
    const courseId = new ObjectId();
    docs.courses.push({
      _id: courseId,
      title: `Curso ${i}`,
      short_description: "Descripción corta",
      full_description: "Descripción completa",
      status: course.status,
      createdAt: new Date(now.getTime() - i * MINUTE),
      updatedAt: now,
    });
    const editions = course.editions.map((edition) => {
      const editionId = new ObjectId();
      docs.courseEditions.push({
        _id: editionId,
        courseId,
        price: edition.price,
        max_participants: edition.max_participants,
        status: edition.status,
        createdAt: now,
        updatedAt: now,
      });
      const starts = [];
      const ends = [];
      for (const cls of edition.classes) {
        const start = cls.dayOffset === null ? null : new Date(now.getTime() + cls.dayOffset * DAY + 30 * MINUTE);
        docs.classes.push({ editionId, status: "enrolled", title: "Clase", duration: cls.duration, start_date: start });
        if (start) {
          starts.push(start.getTime());
          ends.push(start.getTime() + cls.duration * MINUTE);
        }
      }
      for (let e = 0; e < edition.enrollments; e++) {
        docs.courseEnrollments.push({ userId: new ObjectId(), editionId, paymentStatus: "pending", createdAt: now });
      }
      return withTimeStatus({
        _id: editionId,
        courseId,
        createdAt: now,
        status: edition.status,
        price: edition.price,
        max_participants: edition.max_participants,
        start_date: starts.length ? new Date(Math.min(...starts)) : null,
        end_date: ends.length ? new Date(Math.max(...ends)) : null,
        enrollmentCount: edition.enrollments,
      });
    });
    for (const rating of course.ratings) {
      docs.reviews.push({ userId: new ObjectId(), courseId, editionId: editions[0]?._id ?? new ObjectId(), rating });
    }
    const stats = course.ratings.length
      ? { avgRating: round(course.ratings.reduce((s, r) => s + r, 0) / course.ratings.length), reviewCount: course.ratings.length }
      : { avgRating: null, reviewCount: 0 };
    // Labels count every edition of the course, drafts included
    model.push({ courseId, status: course.status, open: pickOpenEdition(withEditionLabels(editions)), stats });
  });
  for (const [name, list] of Object.entries(docs)) {
    if (list.length) await db.collection(name).insertMany(list);
  }
  return model;
}

describe("listCourses", () => {
  beforeAll(async () => {
    db = await resetDb();
  });

  it("Feature: course-editions, Property 20: Catálogo público", async () => {
    await forAll(gen.array(courseGen, { max: 5 }), async (courses) => {
      await Promise.all(
        ["courses", "courseEditions", "classes", "courseEnrollments", "reviews"].map((c) => db.collection(c).deleteMany({})),
      );
      const model = await insertScenario(courses, new Date());

      const listed = await listCourses(null);
      const expected = model.filter((m) => m.status === "active" && m.open);
      expect(listed.map((c) => c._id.toString()).sort()).toEqual(expected.map((m) => m.courseId.toString()).sort());

      for (const m of expected) {
        const row = listed.find((c) => c._id.equals(m.courseId));
        expect(row.openEdition._id.equals(m.open._id)).toBe(true);
        expect(row.openEdition).toMatchObject({
          label: m.open.label,
          price: m.open.price,
          max_participants: m.open.max_participants,
          timeStatus: m.open.timeStatus,
          enrollmentCount: m.open.enrollmentCount,
        });
        expect(row.openEdition.start_date?.getTime()).toBe(m.open.start_date.getTime());
        expect({ avgRating: row.avgRating, reviewCount: row.reviewCount }).toEqual(m.stats);
        // Public: no paid counts, no course-wide admin fields
        expect(row.openEdition).not.toHaveProperty("paidCount");
        expect(row.openEdition).not.toHaveProperty("adminNumber");
        expect(row.openEdition).not.toHaveProperty("number");
        expect(row).not.toHaveProperty("createdBy");
      }
    });
    // 100 DB-backed runs: a few seconds alone, much slower while the whole suite runs in parallel
  }, 60_000);

  it("logged-in users get their own payment status in the open edition", async () => {
    await Promise.all(
      ["courses", "courseEditions", "classes", "courseEnrollments", "reviews"].map((c) => db.collection(c).deleteMany({})),
    );
    const now = new Date();
    const [model] = await insertScenario(
      [
        {
          status: "active",
          editions: [{ status: "published", price: 1000, max_participants: null, classes: [{ dayOffset: 5, duration: 60 }], enrollments: 0 }],
          ratings: [],
        },
      ],
      now,
    );
    const user = await createUser(db);
    const actor = { id: user._id.toString(), role: "user" };
    expect((await listCourses(actor))[0].openEdition.userPaymentStatus).toBeNull();
    await db
      .collection("courseEnrollments")
      .insertOne({ userId: user._id, editionId: model.open._id, paymentStatus: "paid", createdAt: now });
    expect((await listCourses(actor))[0].openEdition).toMatchObject({ userPaymentStatus: "paid", enrollmentCount: 1 });
  });
});
