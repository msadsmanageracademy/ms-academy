// Class use cases. Every function receives the acting user (or null) and enforces
// its own authorization, so REST routes and Server Actions can share them.
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getCourseTimeStatusFromClasses } from "@/server/courses/queries";
import { getReviewStats } from "@/server/reviews/queries";
import { getClassStatus } from "@/utils/classStatus";
import { withTransaction } from "@/server/transactions";
import {
  ClassFormSchema,
  ClassResourcesUpdateSchema,
  CourseLinkSchema,
  PublishedClassEditSchema,
  RecordingUpdateSchema,
  StatusUpdateSchema,
} from "@/utils/validation";
import { HttpError, assertAdmin, assertUser, isAdminActor, parseOrThrow, toObjectId } from "@/server/errors";
import { addTimestampToUpdate, prepareClassForDB } from "@/models/schemas";
import { assignClassToCourse, unassignClassFromCourse } from "./courseLink";
import { classObjectId, courseObjectId } from "@/server/ids";
import { deleteClassCalendarEvent, syncClassCalendarEvent } from "./calendar";
import { getClassParticipantIds, withParticipantsCount } from "./audience";
import { notify, notifyMany } from "@/server/notifications";

/** Fields only visible to participants with access (paid, for course classes). */
export const RESTRICTED_CLASS_FIELDS = [
  "googleEventId",
  "googleEventUrl",
  "googleMeetLink",
  "calendarEventLink",
  "recording_url",
  "resources",
];

/** Fields that have their own endpoint and are rejected by the generic edit. */
const DEDICATED_FIELDS = {
  status: "status",
  courseId: "course",
  recording_url: "recording",
  resources: "resources",
};

const courseTitleLookup = [
  { $lookup: { from: "courses", localField: "courseId", foreignField: "_id", as: "courseData" } },
  { $addFields: { courseTitle: { $arrayElemAt: ["$courseData.title", 0] } } },
  { $unset: "courseData" },
];

const stripRestricted = (cls) => {
  const copy = { ...cls };
  RESTRICTED_CLASS_FIELDS.forEach((field) => delete copy[field]);
  return copy;
};

const toPublicClass = (cls) => {
  const { participants, createdBy: _createdBy, ...rest } = stripRestricted(cls);
  return { ...rest, participantsCount: participants?.length ?? 0 };
};

async function findClassOrThrow(db, classId, options) {
  const classItem = await db.collection("classes").findOne({ _id: classId }, options);
  if (!classItem) throw new HttpError(404, "Clase no encontrada");
  return classItem;
}

// ---------- Reads ----------

/**
 * Class listings:
 * - `courseId`: classes of a course (admin)
 * - `showAll`: every class with its course title (admin)
 * - `myClasses`: classes the user takes part in; course links only if paid
 * - default: public catalog of upcoming published classes
 */
export async function listClasses(actor, { courseId, showAll, myClasses } = {}) {
  if (courseId || showAll) assertAdmin(actor);
  else if (myClasses) assertUser(actor);

  const db = await getDb();
  const classes = db.collection("classes");

  if (courseId) {
    const courseClasses = await classes
      .find({ courseId: courseObjectId(courseId) })
      .sort({ start_date: 1 })
      .toArray();
    return withParticipantsCount(db, courseClasses);
  }

  if (showAll) {
    const all = await classes.aggregate([...courseTitleLookup, { $sort: { start_date: 1 } }]).toArray();
    return withParticipantsCount(db, all);
  }

  if (myClasses) {
    // Standalone classes the user joined + every class of the courses they enrolled in
    const userId = toObjectId(actor.id);
    const enrollments = await db
      .collection("courseEnrollments")
      .find({ userId }, { projection: { courseId: 1, paymentStatus: 1 } })
      .toArray();
    const mine = await classes
      .aggregate([
        {
          $match: {
            $or: [
              { participants: userId, courseId: { $exists: false } },
              { courseId: { $in: enrollments.map((e) => e.courseId) } },
            ],
          },
        },
        ...courseTitleLookup,
        { $sort: { start_date: 1 } },
      ])
      .toArray();
    const counted = await withParticipantsCount(db, mine);
    if (isAdminActor(actor)) return counted;

    const paymentByCourse = Object.fromEntries(
      enrollments.map((e) => [e.courseId.toString(), e.paymentStatus]),
    );
    return counted.map((cls) => {
      // Other students' ids are never exposed
      const { participants: _p, createdBy: _c, ...own } = cls;
      if (!own.courseId) return own;
      const paymentStatus = paymentByCourse[own.courseId.toString()] ?? null;
      const visible = paymentStatus === "paid" ? own : stripRestricted(own);
      return { ...visible, userCoursePaymentStatus: paymentStatus };
    });
  }

  const upcoming = await classes
    .find({ start_date: { $gt: new Date() }, status: "published" })
    .sort({ start_date: 1 })
    .toArray();
  return upcoming.map(toPublicClass);
}

/**
 * Class detail with review stats. Non-admins get no participant list and only see
 * links/materials if they take part (standalone) or paid the course (course class).
 */
export async function getClassDetail(actor, id) {
  const classId = classObjectId(id);
  const db = await getDb();
  let classItem = await findClassOrThrow(db, classId);
  const participantIds = await getClassParticipantIds(db, classItem);

  if (isAdminActor(actor)) {
    classItem.participants = participantIds;
  } else {
    const userId = actor?.id;
    const isParticipant = !!userId && participantIds.some((p) => p.toString() === userId);
    let canSeeRestricted = isParticipant;

    if (classItem.courseId) {
      let paymentStatus = null;
      if (userId) {
        const enrollment = await db
          .collection("courseEnrollments")
          .findOne(
            { userId: toObjectId(userId), courseId: classItem.courseId },
            { projection: { paymentStatus: 1 } },
          );
        paymentStatus = enrollment?.paymentStatus ?? null;
      }
      classItem.userCoursePaymentStatus = paymentStatus;
      canSeeRestricted = paymentStatus === "paid";
    }

    if (!canSeeRestricted) classItem = stripRestricted(classItem);
    classItem.participantsCount = participantIds.length;
    classItem.isParticipant = isParticipant;
    delete classItem.participants;
    delete classItem.createdBy;
  }

  Object.assign(classItem, await getReviewStats(db, { classId }));
  if (actor?.id) {
    classItem.userReview =
      (await db.collection("reviews").findOne({ classId, userId: toObjectId(actor.id) })) ?? null;
  }
  return classItem;
}

// ---------- Writes (admin) ----------

/** Creates a draft class, optionally linked to a course. Returns its id. */
export async function createClass(actor, input) {
  assertAdmin(actor);
  const body = { ...input };
  if (body.start_date) body.start_date = new Date(body.start_date);
  const { courseId, googleEventId: _g1, googleEventUrl: _g2, ...fields } = parseOrThrow(ClassFormSchema, body);

  if (fields.start_date && fields.start_date <= new Date()) {
    throw new HttpError(
      400,
      "No se pueden crear clases con fechas pasadas. Solo se permiten eventos futuros.",
    );
  }
  if (courseId) courseObjectId(courseId);

  const adminId = toObjectId(actor.id);
  // Creating and linking is one unit: if the link fails, the class is not created
  return withTransaction(async (tx) => {
    const classData = { ...prepareClassForDB(fields, adminId), _id: new ObjectId() };
    await tx.db.collection("classes").insertOne(classData, { session: tx.session });
    if (courseId) await assignClassToCourse(tx, classData, courseId);

    tx.afterCommit(() =>
      notify(tx.db, "class.created", {
        to: adminId,
        vars: { classTitle: fields.title },
        relatedId: classData._id,
        actorId: adminId,
      }),
    );
    return { _id: classData._id.toString() };
  });
}

/**
 * Edits the class content. Published classes (and classes of a course in progress)
 * only accept title and short description. Status, course, recording and materials
 * have their own endpoints.
 */
export async function updateClass(actor, id, input) {
  assertAdmin(actor);
  const classId = classObjectId(id);

  const dedicated = Object.keys(DEDICATED_FIELDS).find((key) => key in input);
  if (dedicated) {
    throw new HttpError(
      400,
      `"${dedicated}" se modifica con /api/classes/${id}/${DEDICATED_FIELDS[dedicated]}`,
    );
  }

  const db = await getDb();
  const existing = await findClassOrThrow(db, classId);

  let restricted = existing.status === "published" || existing.status === "enrolled";
  // Enrolled classes stay fully editable unless their course is in progress
  if (existing.status === "enrolled" && existing.courseId) {
    const course = await db
      .collection("courses")
      .findOne({ _id: existing.courseId }, { projection: { status: 1 } });
    if (course) {
      const timeStatus = await getCourseTimeStatusFromClasses(db, existing.courseId, course.status);
      if (timeStatus !== "in-progress") restricted = false;
    }
  }

  let changes;
  if (restricted) {
    changes = parseOrThrow(PublishedClassEditSchema, input);
  } else {
    const body = { ...input };
    if (body.start_date) body.start_date = new Date(body.start_date);
    const { courseId: _c, googleEventId: _g1, googleEventUrl: _g2, ...fields } = parseOrThrow(ClassFormSchema, body);
    changes = { ...fields, max_participants: fields.max_participants === 0 ? null : fields.max_participants };
  }

  const result = await db
    .collection("classes")
    .updateOne({ _id: classId }, { $set: addTimestampToUpdate(changes) });
  if (result.matchedCount === 0) throw new HttpError(404, "Clase no encontrada");

  await notify(db, "class.updated", {
    to: await getClassParticipantIds(db, existing),
    vars: { classTitle: changes.title || existing.title },
    relatedId: classId,
    actorId: existing.createdBy,
  });
  await syncClassCalendarEvent(existing, changes);
}

/**
 * Publishes or archives a standalone class. Archiving removes (and notifies) its
 * participants. Returns { _id, status, participantsCount }.
 */
export async function setClassStatus(actor, id, input) {
  assertAdmin(actor);
  const classId = classObjectId(id);
  const { status } = parseOrThrow(StatusUpdateSchema, input, { useIssueMessage: true });

  const db = await getDb();
  const classItem = await findClassOrThrow(db, classId, {
    projection: { status: 1, participants: 1, title: 1, createdBy: 1, start_date: 1, duration: 1 },
  });

  if (classItem.status === "enrolled") {
    throw new HttpError(400, "No se puede cambiar el estado de una clase asignada a un curso");
  }
  if (status === "published") {
    if (!classItem.start_date) {
      throw new HttpError(400, "No se puede publicar una clase sin fecha de inicio asignada");
    }
    if (new Date(classItem.start_date) < new Date()) {
      throw new HttpError(400, "No se puede publicar una clase cuya fecha de inicio ya pasó");
    }
  }
  if (
    status === "draft" &&
    getClassStatus(classItem.start_date, classItem.duration, classItem.status) === "ongoing"
  ) {
    throw new HttpError(400, "No se puede archivar una clase que está en curso en este momento");
  }

  // Atomic on the class document: the participants notified are exactly those removed,
  // even if someone enrolled between the read above and this update
  const before = await db.collection("classes").findOneAndUpdate(
    { _id: classId, status: { $ne: "enrolled" } },
    { $set: { status, updatedAt: new Date(), ...(status === "draft" ? { participants: [] } : {}) } },
    { returnDocument: "before", projection: { participants: 1 } },
  );
  if (!before) throw new HttpError(409, "La clase cambió mientras se actualizaba. Volvé a intentarlo.");
  const removed = status === "draft" ? before.participants ?? [] : [];

  await notifyMany(db, [
    [
      "class.removed_by_admin.archived",
      { to: removed, vars: { classTitle: classItem.title }, relatedId: classId },
    ],
    [
      "class.status_changed",
      {
        to: classItem.createdBy,
        vars: { classTitle: classItem.title, published: status === "published" },
        relatedId: classId,
        actorId: classItem.createdBy,
      },
    ],
  ]);

  const updated = await findClassOrThrow(db, classId, { projection: { status: 1, participants: 1 } });
  return { _id: updated._id, status: updated.status, participantsCount: updated.participants?.length ?? 0 };
}

async function findLinkState(db, classId) {
  const classItem = await findClassOrThrow(db, classId, {
    projection: { courseId: 1, status: 1, participants: 1, max_participants: 1 },
  });
  const [withCount] = await withParticipantsCount(db, [classItem]);
  delete withCount.participants;
  return withCount;
}

/** Links the class to a course. Returns { _id, courseId, status, max_participants, participantsCount }. */
export async function linkClassToCourse(actor, id, input) {
  assertAdmin(actor);
  const classId = classObjectId(id);
  const { courseId } = parseOrThrow(CourseLinkSchema, input, { useIssueMessage: true });
  await withTransaction(async (tx) => {
    const classItem = await findClassOrThrow(tx.db, classId, { session: tx.session });
    await assignClassToCourse(tx, classItem, courseId);
  });
  return findLinkState(await getDb(), classId);
}

/** Unlinks the class from its course. Returns the same shape as linkClassToCourse. */
export async function unlinkClassFromCourse(actor, id) {
  assertAdmin(actor);
  const classId = classObjectId(id);
  await withTransaction(async (tx) => {
    const classItem = await findClassOrThrow(tx.db, classId, { session: tx.session });
    await unassignClassFromCourse(tx, classItem);
  });
  return findLinkState(await getDb(), classId);
}

async function findCourseClassOrThrow(db, classId, message) {
  const classItem = await findClassOrThrow(db, classId);
  if (!classItem.courseId) throw new HttpError(400, message);
  return classItem;
}

/** Notifies the participants who paid the course (pending ones have no access). */
async function notifyPaidParticipants(db, key, classItem) {
  await notify(db, key, {
    to: await getClassParticipantIds(db, classItem, { paidOnly: true }),
    vars: { classTitle: classItem.title },
    relatedId: classItem._id,
    actorId: classItem.createdBy,
  });
}

/** Sets the recording link of a course class and notifies the paid participants. */
export async function setClassRecording(actor, id, input) {
  assertAdmin(actor);
  const classId = classObjectId(id);
  const { url } = parseOrThrow(RecordingUpdateSchema, input, { useIssueMessage: true });
  const db = await getDb();
  const classItem = await findCourseClassOrThrow(
    db,
    classId,
    "Solo se pueden agregar grabaciones a clases de un curso",
  );
  await db
    .collection("classes")
    .updateOne({ _id: classId }, { $set: { recording_url: url, updatedAt: new Date() } });
  await notifyPaidParticipants(db, "class.recording_added", classItem);
}

/** Removes the recording link of a class. */
export async function removeClassRecording(actor, id) {
  assertAdmin(actor);
  const classId = classObjectId(id);
  const db = await getDb();
  const result = await db
    .collection("classes")
    .updateOne({ _id: classId }, { $unset: { recording_url: "" }, $set: { updatedAt: new Date() } });
  if (result.matchedCount === 0) throw new HttpError(404, "Clase no encontrada");
}

/** Replaces the materials of a course class and notifies the paid participants. */
export async function setClassResources(actor, id, input) {
  assertAdmin(actor);
  const classId = classObjectId(id);
  const { resources } = parseOrThrow(ClassResourcesUpdateSchema, input, { useIssueMessage: true });
  const db = await getDb();
  const classItem = await findCourseClassOrThrow(
    db,
    classId,
    "Solo se pueden agregar materiales a clases de un curso",
  );
  await db
    .collection("classes")
    .updateOne({ _id: classId }, { $set: { resources, updatedAt: new Date() } });
  if (resources.length > 0) await notifyPaidParticipants(db, "class.resources_updated", classItem);
}

/** Deletes an archived class, its Calendar event, and notifies participants and admin. */
export async function deleteClass(actor, id) {
  assertAdmin(actor);
  const classId = classObjectId(id);
  const db = await getDb();
  const classItem = await findClassOrThrow(db, classId);
  if (classItem.status !== "draft") {
    throw new HttpError(400, "Solo se pueden eliminar clases en estado archivado");
  }

  // Database first (conditional on still being archived), then the external Calendar event
  const result = await db.collection("classes").deleteOne({ _id: classId, status: "draft" });
  if (result.deletedCount === 0) {
    throw new HttpError(409, "La clase cambió mientras se eliminaba. Volvé a intentarlo.");
  }
  await deleteClassCalendarEvent(classItem);

  const cancellation = {
    vars: { classTitle: classItem.title },
    relatedId: classId,
    metadata: { classTitle: classItem.title, startDate: classItem.start_date },
  };
  await notifyMany(db, [
    ["class.cancelled", { ...cancellation, to: await getClassParticipantIds(db, classItem) }],
    ["class.deleted", { ...cancellation, to: classItem.createdBy }],
  ]);
}
