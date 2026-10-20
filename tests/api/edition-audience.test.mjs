// Participants of edition classes (src/server/classes/audience.js): they are the
// enrollees of the class's edition, never those of another edition of the same course.
// Reminders and recording notifications only reach the paid enrollees of that edition.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { getClassParticipantIds, isClassParticipant, withParticipantsCount } from "@/server/classes/audience";
import { sendClassReminders } from "@/server/classes/reminders";
import { setClassRecording } from "@/server/classes/service";
import { createAdmin, createClass, createCourseDoc, createEdition, createUser, resetDb } from "../helpers.mjs";
import { forAll, gen } from "../support/random.mjs";

// No email leaves the tests: the recipients are recorded instead
const sentTo = [];
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (email) => {
        sentTo.push(email.to);
        return { data: { id: "email-1" }, error: null };
      },
    };
    batch = {
      send: async (emails) => {
        sentTo.push(...emails.map((e) => e.to));
        return { data: { data: [] }, error: null };
      },
    };
  },
}));

const USERS = 8;
let db, admin, users;

const actorOf = (u) => ({ id: u._id.toString(), role: u.role, email: u.email });
const ids = (list) => list.map((id) => id.toString()).sort();

beforeAll(async () => {
  db = await resetDb();
  admin = await createAdmin(db);
  users = [];
  for (let i = 0; i < USERS; i++) users.push(await createUser(db, { first_name: `Alumno ${i}` }));
});

describe("edition class audience", () => {
  it("Feature: course-editions, Property 12: Participantes aislados por edición", async () => {
    const caseGen = gen.record({
      editionCount: gen.int(2, 4),
      classesPerEdition: gen.int(1, 2),
      enrollments: gen.array(
        gen.record({ user: gen.int(0, USERS - 1), edition: gen.int(0, 3), paid: gen.bool() }),
        { max: 16 },
      ),
      target: gen.int(0, 1000),
    });

    await forAll(caseGen, async ({ editionCount, classesPerEdition, enrollments, target }) => {
      await Promise.all(
        ["courses", "courseEditions", "classes", "courseEnrollments", "notifications"].map((c) =>
          db.collection(c).deleteMany({}),
        ),
      );
      sentTo.length = 0;

      const course = await createCourseDoc(db);
      const editions = [];
      for (let i = 0; i < editionCount; i++) editions.push(await createEdition(db, course));
      const classes = [];
      for (const edition of editions) {
        for (let i = 0; i < classesPerEdition; i++) {
          classes.push(await createClass(db, { editionId: edition._id, status: "enrolled", createdBy: admin._id }));
        }
      }

      // One enrollment per (user, edition): the first generated one wins
      const seen = new Set();
      const expected = editions.map(() => ({ all: [], paid: [] }));
      const docs = [];
      for (const { user, edition, paid } of enrollments) {
        const index = edition % editionCount;
        const key = `${user}:${index}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const now = new Date();
        docs.push({
          userId: users[user]._id,
          editionId: editions[index]._id,
          paymentStatus: paid ? "paid" : "pending",
          createdAt: now,
          updatedAt: now,
        });
        expected[index].all.push(users[user]._id);
        if (paid) expected[index].paid.push(users[user]._id);
      }
      if (docs.length) await db.collection("courseEnrollments").insertMany(docs);

      const counted = await withParticipantsCount(db, classes);
      for (const [i, cls] of classes.entries()) {
        const own = expected[editions.findIndex((e) => e._id.equals(cls.editionId))];
        expect(ids(await getClassParticipantIds(db, cls))).toEqual(ids(own.all));
        expect(ids(await getClassParticipantIds(db, cls, { paidOnly: true }))).toEqual(ids(own.paid));
        expect(counted[i].participantsCount).toBe(own.all.length);
      }

      // One class in detail: membership per user, reminders and recording notifications
      // reach exactly the (paid) enrollees of its edition
      const cls = classes[target % classes.length];
      const own = expected[editions.findIndex((e) => e._id.equals(cls.editionId))];
      for (const user of users) {
        const enrolled = own.all.some((id) => id.equals(user._id));
        const paid = own.paid.some((id) => id.equals(user._id));
        expect(await isClassParticipant(db, cls, user._id)).toBe(enrolled);
        expect(await isClassParticipant(db, cls, user._id, { paidOnly: true })).toBe(paid);
      }
      const paidEmails = users.filter((u) => own.paid.some((id) => id.equals(u._id))).map((u) => u.email).sort();
      if (paidEmails.length === 0) {
        await expect(sendClassReminders(actorOf(admin), cls._id.toString(), {})).rejects.toMatchObject({ status: 400 });
      } else {
        const { notifiedCount } = await sendClassReminders(actorOf(admin), cls._id.toString(), {});
        expect(notifiedCount).toBe(paidEmails.length);
        expect([...sentTo].sort()).toEqual(paidEmails);
      }

      await setClassRecording(actorOf(admin), cls._id.toString(), { url: "https://example.test/rec" });
      const notified = await db
        .collection("notifications")
        .find({ type: "class.recording_added" }, { projection: { userId: 1 } })
        .toArray();
      expect(ids(notified.map((n) => n.userId))).toEqual(ids(own.paid));
    });
    // 100 DB-backed runs: ~13 s alone, slower while the whole suite runs in parallel
  }, 60_000);
});
