// Restricted class fields (Meet, Calendar, recording, materials) per edition payment:
// a student sees them in a class only after paying that class's edition.
import { beforeAll, describe, expect, it } from "vitest";
import { RESTRICTED_CLASS_FIELDS, getClassDetail, listClasses } from "@/server/classes/service";
import { createClass, createCourseDoc, createEdition, createUser, resetDb } from "../helpers.mjs";
import { forAll, gen } from "../support/random.mjs";

const RESTRICTED = {
  googleEventId: "evt-1",
  googleEventUrl: "https://calendar.google.com/event?eid=abc",
  googleMeetLink: "https://meet.google.com/abc-defg-hij",
  calendarEventLink: "https://calendar.google.com/x",
  recording_url: "https://example.test/recording",
  resources: [{ title: "Slides", url: "https://example.test/slides" }],
};
const STATUSES = ["none", "pending", "paid"];

let db, student, other;

const actorOf = (u) => ({ id: u._id.toString(), role: u.role, email: u.email });

function expectRestricted(cls, visible) {
  for (const field of RESTRICTED_CLASS_FIELDS) {
    if (visible) expect(cls).toHaveProperty(field);
    else expect(cls).not.toHaveProperty(field);
  }
}

beforeAll(async () => {
  db = await resetDb();
  student = await createUser(db, { first_name: "Ana" });
  other = await createUser(db, { first_name: "Bruno" });
});

describe("edition class access", () => {
  it("Feature: course-editions, Property 13: Campos restringidos según pago en la edición", async () => {
    const caseGen = gen.record({
      // The student's and another student's payment status in each edition
      mine: gen.array(gen.pick(STATUSES), { min: 1, max: 4 }),
      theirs: gen.array(gen.pick(STATUSES), { min: 4, max: 4 }),
      classesPerEdition: gen.int(1, 2),
    });

    await forAll(caseGen, async ({ mine, theirs, classesPerEdition }) => {
      await Promise.all(
        ["courses", "courseEditions", "classes", "courseEnrollments"].map((c) => db.collection(c).deleteMany({})),
      );
      const course = await createCourseDoc(db);
      const byClass = new Map();
      const enrollments = [];
      for (const [i, status] of mine.entries()) {
        const edition = await createEdition(db, course);
        for (let c = 0; c < classesPerEdition; c++) {
          const cls = await createClass(db, { editionId: edition._id, status: "enrolled", ...RESTRICTED });
          byClass.set(cls._id.toString(), { cls, status });
        }
        const now = new Date();
        for (const [user, paymentStatus] of [
          [student, status],
          [other, theirs[i]],
        ]) {
          if (paymentStatus === "none") continue;
          enrollments.push({ userId: user._id, editionId: edition._id, paymentStatus, createdAt: now, updatedAt: now });
        }
      }
      if (enrollments.length) await db.collection("courseEnrollments").insertMany(enrollments);

      const actor = actorOf(student);
      for (const { cls, status } of byClass.values()) {
        const detail = await getClassDetail(actor, cls._id.toString());
        expectRestricted(detail, status === "paid");
        expect(detail.userEditionPaymentStatus).toBe(status === "none" ? null : status);
      }

      const listed = await listClasses(actor, { myClasses: true });
      const expectedIds = [...byClass.entries()].filter(([, { status }]) => status !== "none").map(([id]) => id);
      expect(listed.map((c) => c._id.toString()).sort()).toEqual(expectedIds.sort());
      for (const row of listed) {
        const { status } = byClass.get(row._id.toString());
        expectRestricted(row, status === "paid");
        expect(row.userEditionPaymentStatus).toBe(status);
        expect(row.courseId.equals(course._id)).toBe(true);
        expect(row).not.toHaveProperty("participants");
      }
    });
    // 100 DB-backed runs: ~9 s alone, slower while the whole suite runs in parallel
  }, 60_000);
});
