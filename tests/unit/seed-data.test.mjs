// Demo seed data (src/lib/db/seedData.mjs): the generated scenario follows the domain rules
// for any seed date. Properties use the seeded PRNG.
import { afterEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { DEMO_USERS, buildSeedData } from "@/lib/db/seedData.mjs";
import {
  ClassDBSchema,
  CourseDBSchema,
  CourseEditionDBSchema,
  CourseEnrollmentDBSchema,
  ReviewDBSchema,
} from "@/models/schemas";
import { getClassStatus, getCourseTimeStatus } from "@/utils/classStatus";
import { labelEditions } from "@/utils/courseEditions";
import { dateAround, forAll, gen } from "../support/random.mjs";

const NOW = new Date("2026-06-15T15:00:00Z");
const key = (...ids) => ids.map(String).join(":");

const demoUsersGen = gen.map(gen.constant(null), (_unused, rng) =>
  DEMO_USERS.map((profile) => ({ ...profile, _id: gen.objectId()(rng) })),
);

const seedInputGen = gen.record({
  now: dateAround(NOW, 3650),
  adminId: gen.objectId(),
  ownUserId: gen.oneOf(gen.constant(null), gen.objectId()),
  demoUsers: demoUsersGen,
});

// Dates of each edition as the app derives them from its classes
function editionDates(edition, classes) {
  const dated = classes.filter((c) => c.editionId?.equals(edition._id) && c.start_date);
  const start = dated.length ? Math.min(...dated.map((c) => c.start_date.getTime())) : null;
  const end = dated.length ? Math.max(...dated.map((c) => c.start_date.getTime() + c.duration * 60000)) : null;
  return { start: start === null ? null : new Date(start), end: end === null ? null : new Date(end) };
}

// Time status of each edition as the app computes it
function editionTimeStatus(edition, classes) {
  const { start, end } = editionDates(edition, classes);
  return getCourseTimeStatus(start, end, edition.status);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("buildSeedData", () => {
  it("Feature: course-editions, Property 19: El seed cumple las reglas del dominio", async () => {
    await forAll(seedInputGen, ({ now, adminId, ownUserId, demoUsers }) => {
      const data = buildSeedData({ now, adminId, ownUserId, demoUsers });
      // The app derives time statuses from the clock: freeze it at the seed date
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(now);
      try {
        const editionsById = new Map(data.courseEditions.map((e) => [String(e._id), e]));
        const statusById = new Map(
          data.courseEditions.map((e) => [String(e._id), editionTimeStatus(e, data.classes)]),
        );

        // Editions store no number: the app names them by date and numbers them for admins
        for (const edition of data.courseEditions) expect(edition).not.toHaveProperty("number");

        // Expected time statuses of the scenario (by course, in the admins' chronological order)
        const statusesOf = (title) => {
          const course = data.courses.find((c) => c.title === title);
          const own = data.courseEditions
            .filter((e) => e.courseId.equals(course._id))
            .map((e) => ({ ...e, start_date: editionDates(e, data.classes).start }));
          const labels = labelEditions(own);
          return own
            .sort((a, b) => labels.get(String(a._id)).adminNumber - labels.get(String(b._id)).adminNumber)
            .map((e) => statusById.get(String(e._id)));
        };
        expect(statusesOf("Meta Ads desde cero")).toEqual(["completed", "completed", "upcoming"]);
        expect(statusesOf("Contenido para Instagram que vende")).toEqual(["completed", "in-progress"]);
        expect(statusesOf("Analítica de campañas con Meta")).toEqual([null]);

        // Classes: edition classes point to an existing edition; standalone ones are free
        // (2 upcoming, 1 past) and within their capacity
        for (const cls of data.classes.filter((c) => c.editionId)) {
          expect(editionsById.has(String(cls.editionId))).toBe(true);
          expect(cls.status).toBe("enrolled");
          expect(cls.participants).toBeUndefined();
        }
        const draftClasses = data.classes.filter(
          (c) => c.editionId && editionsById.get(String(c.editionId)).status === "draft",
        );
        expect(draftClasses.length).toBeGreaterThan(0);
        expect(draftClasses.every((c) => c.start_date === null)).toBe(true);
        const standalone = data.classes.filter((c) => !c.editionId);
        expect(standalone.every((c) => c.price === 0 && c.status === "published")).toBe(true);
        expect(standalone.map((c) => getClassStatus(c.start_date, c.duration, c.status)).sort()).toEqual([
          "completed",
          "upcoming",
          "upcoming",
        ]);
        for (const cls of standalone) {
          if (cls.max_participants !== null) {
            expect(cls.participants.length).toBeLessThanOrEqual(cls.max_participants);
          }
        }

        // Enrollments: unique per user and edition, only in published editions, within capacity,
        // never dated in the future
        const enrollmentKeys = data.courseEnrollments.map((e) => key(e.userId, e.editionId));
        expect(new Set(enrollmentKeys).size).toBe(enrollmentKeys.length);
        for (const edition of data.courseEditions) {
          const count = data.courseEnrollments.filter((e) => e.editionId.equals(edition._id)).length;
          if (edition.status === "draft") expect(count).toBe(0);
          if (edition.max_participants !== null) expect(count).toBeLessThanOrEqual(edition.max_participants);
        }
        for (const enrollment of data.courseEnrollments) {
          expect(enrollment.createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
          if (enrollment.paymentStatus === "paid") {
            expect(enrollment.paidAt.getTime()).toBeLessThanOrEqual(now.getTime());
          }
        }

        // Reviews: one per user and edition, only by paid enrollees of completed editions,
        // with the edition's courseId
        const paid = new Set(
          data.courseEnrollments.filter((e) => e.paymentStatus === "paid").map((e) => key(e.userId, e.editionId)),
        );
        const reviewKeys = data.reviews.map((r) => key(r.userId, r.editionId));
        expect(new Set(reviewKeys).size).toBe(reviewKeys.length);
        expect(data.reviews.length).toBeGreaterThan(0);
        for (const review of data.reviews) {
          expect(paid.has(key(review.userId, review.editionId))).toBe(true);
          expect(statusById.get(String(review.editionId))).toBe("completed");
          expect(review.courseId.equals(editionsById.get(String(review.editionId)).courseId)).toBe(true);
          expect(review.createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
        }

        // The own account takes part only when it exists
        const ownEnrollments = data.courseEnrollments.filter((e) => ownUserId && e.userId.equals(ownUserId));
        expect(ownEnrollments.length).toBe(ownUserId ? 3 : 0);
        const knownUsers = new Set([...demoUsers.map((u) => String(u._id)), ...(ownUserId ? [String(ownUserId)] : [])]);
        expect(data.courseEnrollments.every((e) => knownUsers.has(String(e.userId)))).toBe(true);
        expect(standalone.flatMap((c) => c.participants).every((id) => knownUsers.has(String(id)))).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("generates documents that match the database schemas", () => {
    const demoUsers = DEMO_USERS.map((profile) => ({ ...profile, _id: new ObjectId() }));
    const adminId = new ObjectId();
    const data = buildSeedData({ now: NOW, adminId, ownUserId: new ObjectId(), demoUsers });
    for (const course of data.courses) {
      expect(CourseDBSchema.safeParse(course).success).toBe(true);
      expect(course.status).toBe("active");
      expect(course.createdBy).toBe(adminId);
    }
    for (const edition of data.courseEditions) expect(CourseEditionDBSchema.safeParse(edition).success).toBe(true);
    for (const cls of data.classes) expect(ClassDBSchema.safeParse(cls).success).toBe(true);
    for (const enrollment of data.courseEnrollments) {
      expect(CourseEnrollmentDBSchema.safeParse(enrollment).success).toBe(true);
    }
    for (const review of data.reviews) {
      expect(ReviewDBSchema.safeParse(review).success).toBe(true);
      expect(review.firstName).toEqual(expect.any(String));
    }
    expect(data.courses).toHaveLength(3);
    expect(data.courseEditions).toHaveLength(6);
  });

  it("requires the demo users", () => {
    expect(() => buildSeedData({ now: NOW, adminId: new ObjectId(), demoUsers: [] })).toThrow(/demo users/);
  });
});
