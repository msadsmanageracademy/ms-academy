// Class use cases. Every function receives the acting user (or null) and enforces
// its own authorization, so REST routes and Server Actions can share them.
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getEditionLabels, getEditionTimeStatusFromClasses } from "@/server/courses/queries";
import { getReviewStats } from "@/server/reviews/queries";
import { getClassStatus } from "@/utils/classStatus";
import { withTransaction } from "@/server/transactions";
import {
  ClassFormSchema,
  ClassResourcesUpdateSchema,
  EditionLinkSchema,
  PublishedClassEditSchema,
  RecordingUpdateSchema,
  StatusUpdateSchema,
} from "@/utils/validation";
import { HttpError, assertAdmin, assertUser, isAdminActor, parseOrThrow, toObjectId } from "@/server/errors";
import { addTimestampToUpdate, prepareClassForDB } from "@/models/schemas";
import { assignClassToEdition, unassignClassFromEdition } from "./editionLink";
import { classObjectId, editionObjectId } from "@/server/ids";
import { deleteClassCalendarEvent, syncClassCalendarEvent } from "./calendar";
import { getClassParticipantIds, withParticipantsCount } from "./audience";
import { notify, notifyMany } from "@/server/notifications";

/** Fields only visible to participants with access (paid edition, for edition classes). */
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
  editionId: "edition",
  recording_url: "recording",
  resources: "resources",
};

// Edition classes get their course id and title (standalone classes have none of them);
// their edition label is added afterwards by withClassEditionLabels
const editionLookup = [
  {
    $lookup: {
      from: "courseEditions",
      localField: "editionId",
      foreignField: "_id",
      pipeline: [{ $project: { courseId: 1 } }],
      as: "editionData",
    },
  },
  {
    $lookup: {
      from: "courses",
      localField: "editionData.courseId",
      foreignField: "_id",
      pipeline: [{ $project: { title: 1 } }],
      as: "courseData",
    },
  },
  {
    $addFields: {
      courseId: { $arrayElemAt: ["$editionData.courseId", 0] },
      courseTitle: { $arrayElemAt: ["$courseData.title", 0] },
    },
  },
  { $unset: ["editionData", "courseData"] },
];

/** Sets the date label of its edition ("Septiembre 2026") on every edition class. */
async function withClassEditionLabels(db, classes) {
  const courseIds = [
    ...new Map(classes.filter((c) => c.courseId).map((c) => [c.courseId.toString(), c.courseId])).values(),
  ];
  const labels = await getEditionLabels(db, courseIds);
  return classes.map((cls) =>
    cls.editionId && labels.has(cls.editionId.toString())
      ? { ...cls, editionLabel: labels.get(cls.editionId.toString()).label }
      : cls,
  );
}

const stripRestricted = (cls) => {
  const copy = { ...cls };
  RESTRICTED_CLASS_FIELDS.forEach((field) => delete copy[field]);
  return copy;
};

// `isParticipant` only tells the viewer about themselves; participant ids never leave the server.
const toPublicClass = (cls, viewerId = null) => {
  const { participants, createdBy: _createdBy, ...rest } = stripRestricted(cls);
  return {
    ...rest,
    participantsCount: participants?.length ?? 0,
    isParticipant: !!viewerId && (participants ?? []).some((p) => p.toString() === viewerId),
  };
};

async function findClassOrThrow(db, classId, options) {
  const classItem = await db.collection("classes").findOne({ _id: classId }, options);
  if (!classItem) throw new HttpError(404, "Clase no encontrada");
  return classItem;
}

// ---------- Reads ----------

/**
 * Class listings:
 * - `editionId`: classes of an edition (admin)
 * - `showAll`: every class; edition classes with courseId, courseTitle and editionLabel (admin)
 * - `myClasses`: classes the user takes part in; edition links only if that edition is paid
 *   (`userEditionPaymentStatus`)
 * - default: public catalog of upcoming published classes, flagging the viewer's own
 *   participation as `isParticipant`
 */
export async function listClasses(actor, { editionId, showAll, myClasses } = {}) {
  if (editionId || showAll) assertAdmin(actor);
  else if (myClasses) assertUser(actor);

  const db = await getDb();
  const classes = db.collection("classes");

  if (editionId) {
    const editionClasses = await classes
      .find({ editionId: editionObjectId(editionId) })
      .sort({ start_date: 1 })
      .toArray();
    return withParticipantsCount(db, editionClasses);
  }

  if (showAll) {
    const all = await classes.aggregate([...editionLookup, { $sort: { start_date: 1 } }]).toArray();
    return withParticipantsCount(db, await withClassEditionLabels(db, all));
  }

  if (myClasses) {
    // Standalone classes the user joined + every class of the editions they enrolled in
    const userId = toObjectId(actor.id);
    const enrollments = await db
      .collection("courseEnrollments")
      .find({ userId }, { projection: { editionId: 1, paymentStatus: 1 } })
      .toArray();
    const mine = await classes
      .aggregate([
        {
          $match: {
            $or: [
              { participants: userId, editionId: { $exists: false } },
              { editionId: { $in: enrollments.map((e) => e.editionId) } },
            ],
          },
        },
        ...editionLookup,
        { $sort: { start_date: 1 } },
      ])
      .toArray();
    const counted = await withParticipantsCount(db, await withClassEditionLabels(db, mine));
    if (isAdminActor(actor)) return counted;

    const paymentByEdition = Object.fromEntries(
      enrollments.map((e) => [e.editionId.toString(), e.paymentStatus]),
    );
    return counted.map((cls) => {
      // Other students' ids are never exposed
      const { participants: _p, createdBy: _c, ...own } = cls;
      if (!own.editionId) return own;
      const paymentStatus = paymentByEdition[own.editionId.toString()] ?? null;
      const visible = paymentStatus === "paid" ? own : stripRestricted(own);
      return { ...visible, userEditionPaymentStatus: paymentStatus };
    });
  }

  const upcoming = await classes
    .find({ start_date: { $gt: new Date() }, status: "published" })
    .sort({ start_date: 1 })
    .toArray();
  return upcoming.map((cls) => toPublicClass(cls, actor?.id ?? null));
}

/**
 * Class detail with review stats (edition classes also get courseId, courseTitle and
 * editionLabel). Non-admins get no participant list and only see links/materials if
 * they take part (standalone) or paid the edition of the class (`userEditionPaymentStatus`).
 */
export async function getClassDetail(actor, id) {
  const classId = classObjectId(id);
  const db = await getDb();
  let [classItem] = await db
    .collection("classes")
    .aggregate([{ $match: { _id: classId } }, ...editionLookup])
    .toArray();
  if (!classItem) throw new HttpError(404, "Clase no encontrada");
  [classItem] = await withClassEditionLabels(db, [classItem]);
  const participantIds = await getClassParticipantIds(db, classItem);

  if (isAdminActor(actor)) {
    classItem.participants = participantIds;
  } else {
    const userId = actor?.id;
    const isParticipant = !!userId && participantIds.some((p) => p.toString() === userId);
    let canSeeRestricted = isParticipant;

    if (classItem.editionId) {
      let paymentStatus = null;
      if (userId) {
        const enrollment = await db
          .collection("courseEnrollments")
          .findOne(
            { userId: toObjectId(userId), editionId: classItem.editionId },
            { projection: { paymentStatus: 1 } },
          );
        paymentStatus = enrollment?.paymentStatus ?? null;
      }
      classItem.userEditionPaymentStatus = paymentStatus;
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

/** Creates a draft class, optionally linked to an edition (`editionId`). Returns its id. */
export async function createClass(actor, input) {
  assertAdmin(actor);
  const body = { ...input };
  if (body.start_date) body.start_date = new Date(body.start_date);
  const { editionId, googleEventId: _g1, googleEventUrl: _g2, ...fields } = parseOrThrow(ClassFormSchema, body);

  if (fields.start_date && fields.start_date <= new Date()) {
    throw new HttpError(
      400,
      "No se pueden crear clases con fechas pasadas. Solo se permiten eventos futuros.",
    );
  }
  if (editionId) editionObjectId(editionId);

  const adminId = toObjectId(actor.id);
  // Creating and linking is one unit: if the link fails, the class is not created
  return withTransaction(async (tx) => {
    const classData = { ...prepareClassForDB(fields, adminId), _id: new ObjectId() };
    await tx.db.collection("classes").insertOne(classData, { session: tx.session });
    if (editionId) await assignClassToEdition(tx, classData, editionId);

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
 * Edits the class content. Published classes (and classes of an edition in progress)
 * only accept title and short description. Status, edition, recording and materials
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
  // Enrolled classes stay fully editable unless their edition is in progress
  if (existing.status === "enrolled" && existing.editionId) {
    const edition = await db
      .collection("courseEditions")
      .findOne({ _id: existing.editionId }, { projection: { status: 1 } });
    if (edition) {
      const timeStatus = await getEditionTimeStatusFromClasses(db, existing.editionId, edition.status);
      if (timeStatus !== "in-progress") restricted = false;
    }
  }

  let changes;
  if (restricted) {
    changes = parseOrThrow(PublishedClassEditSchema, input);
  } else {
    const body = { ...input };
    if (body.start_date) body.start_date = new Date(body.start_date);
    const { editionId: _e, googleEventId: _g1, googleEventUrl: _g2, ...fields } = parseOrThrow(ClassFormSchema, body);
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
    projection: { editionId: 1, status: 1, participants: 1, max_participants: 1 },
  });
  const [withCount] = await withParticipantsCount(db, [classItem]);
  delete withCount.participants;
  return withCount;
}

/** Links the class to an edition. Returns { _id, editionId, status, max_participants, participantsCount }. */
export async function linkClassToEdition(actor, id, input) {
  assertAdmin(actor);
  const classId = classObjectId(id);
  const { editionId } = parseOrThrow(EditionLinkSchema, input, { useIssueMessage: true });
  await withTransaction(async (tx) => {
    const classItem = await findClassOrThrow(tx.db, classId, { session: tx.session });
    await assignClassToEdition(tx, classItem, editionId);
  });
  return findLinkState(await getDb(), classId);
}

/** Unlinks the class from its edition. Returns the same shape as linkClassToEdition. */
export async function unlinkClassFromEdition(actor, id) {
  assertAdmin(actor);
  const classId = classObjectId(id);
  await withTransaction(async (tx) => {
    const classItem = await findClassOrThrow(tx.db, classId, { session: tx.session });
    await unassignClassFromEdition(tx, classItem);
  });
  return findLinkState(await getDb(), classId);
}

async function findEditionClassOrThrow(db, classId, message) {
  const classItem = await findClassOrThrow(db, classId);
  if (!classItem.editionId) throw new HttpError(400, message);
  return classItem;
}

/** Notifies the participants who paid the edition (pending ones have no access). */
async function notifyPaidParticipants(db, key, classItem) {
  await notify(db, key, {
    to: await getClassParticipantIds(db, classItem, { paidOnly: true }),
    vars: { classTitle: classItem.title },
    relatedId: classItem._id,
    actorId: classItem.createdBy,
  });
}

/** Sets the recording link of an edition class and notifies the paid participants. */
export async function setClassRecording(actor, id, input) {
  assertAdmin(actor);
  const classId = classObjectId(id);
  const { url } = parseOrThrow(RecordingUpdateSchema, input, { useIssueMessage: true });
  const db = await getDb();
  const classItem = await findEditionClassOrThrow(
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

/** Replaces the materials of an edition class and notifies the paid participants. */
export async function setClassResources(actor, id, input) {
  assertAdmin(actor);
  const classId = classObjectId(id);
  const { resources } = parseOrThrow(ClassResourcesUpdateSchema, input, { useIssueMessage: true });
  const db = await getDb();
  const classItem = await findEditionClassOrThrow(
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
