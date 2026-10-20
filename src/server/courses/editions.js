// Course editions (every time a course is taught): creation, price and capacity,
// publication and deletion. Editions have no stored number: they are named by the month
// of their first class and admins see their computed position (see labelEditions). Every function receives the acting user (or null) and
// enforces its own authorization, so REST routes and Server Actions can share them.
import { deleteClassCalendarEvent } from "@/server/classes/calendar";
import { getDb } from "@/lib/db";
import { getEditionReviewStats } from "@/server/reviews/queries";
import { notify } from "@/server/notifications";
import { withTransaction } from "@/server/transactions";
import { EditionFormSchema, StatusUpdateSchema } from "@/utils/validation";
import { HttpError, assertAdmin, isAdminActor, parseOrThrow, toObjectId } from "@/server/errors";
import { addTimestampToUpdate, prepareEditionForDB } from "@/models/schemas";
import {
  copyClassForEdition,
  deleteEditionError,
  editionEditError,
  publishEditionError,
  unpublishEditionError,
} from "./rules";
import { courseObjectId, editionObjectId } from "@/server/ids";
import {
  editionAggregationPipeline,
  getEditionLabels,
  getEditionTimeStatusFromClasses,
  getEnrollmentCounts,
  withEditionCounts,
} from "./queries";
import { editionName, withEditionLabels, withTimeStatus } from "@/utils/courseEditions";

const editionNotFound = () => new HttpError(404, "Edición no encontrada");
const courseNotFound = () => new HttpError(404, "Curso no encontrado");

async function findEditionOrThrow(db, editionId, options) {
  const edition = await db.collection("courseEditions").findOne({ _id: editionId }, options);
  if (!edition) throw editionNotFound();
  return edition;
}

// Edition with schedule, time status, enrollment counts, its own ratings, its label,
// adminNumber and the edition count of its course (editionCount)
async function loadEdition(db, match) {
  const [found] = await db.collection("courseEditions").aggregate(editionAggregationPipeline(match)).toArray();
  if (!found) return null;
  const ids = [found._id];
  const [counts, stats, labels] = await Promise.all([
    getEnrollmentCounts(db, ids),
    getEditionReviewStats(db, ids),
    getEditionLabels(db, [found.courseId]),
  ]);
  return {
    ...withEditionCounts(withTimeStatus(found), counts, stats),
    ...labels.get(found._id.toString()),
    editionCount: labels.size,
  };
}

// ---------- Reads ----------

/**
 * Admin edition page (/dashboard/courses/[courseId]/editions/[editionId]): the edition
 * (with label, adminNumber and editionCount for the breadcrumb "Edición N de M") and its
 * course. 400 for malformed ids; 404 when the course or the edition does not exist, or
 * the edition belongs to another course.
 */
export async function getAdminEdition(actor, courseIdRaw, editionIdRaw) {
  assertAdmin(actor);
  const courseId = courseObjectId(courseIdRaw);
  const editionId = editionObjectId(editionIdRaw);

  const db = await getDb();
  const course = await db
    .collection("courses")
    .findOne({ _id: courseId }, { projection: { title: 1, short_description: 1, full_description: 1, status: 1 } });
  if (!course) throw courseNotFound();
  const edition = await loadEdition(db, { _id: editionId, courseId });
  if (!edition) throw editionNotFound();
  return { ...edition, course };
}

/**
 * Admin: every edition of every course (schedule, time status, label and adminNumber),
 * with its course title, ordered by course and chronologically. Used by the dashboard
 * summary and to pick an edition when linking a class.
 * → [{ _id, courseId, courseTitle, short_description, adminNumber, label, title, status,
 *      timeStatus, price, max_participants, start_date, end_date, amount_of_classes }]
 */
export async function listAdminEditions(actor) {
  assertAdmin(actor);
  const db = await getDb();
  const [found, courses] = await Promise.all([
    db.collection("courseEditions").aggregate(editionAggregationPipeline({})).toArray(),
    db.collection("courses").find({}, { projection: { title: 1, short_description: 1 } }).toArray(),
  ]);
  const courseById = new Map(courses.map((c) => [c._id.toString(), c]));
  const editions = withEditionLabels(found.map(withTimeStatus)).sort(
    (a, b) => String(a.courseId).localeCompare(String(b.courseId)) || a.adminNumber - b.adminNumber,
  );
  return editions.map((edition) => {
    const course = courseById.get(edition.courseId.toString());
    const courseTitle = course?.title ?? "";
    return {
      _id: edition._id,
      courseId: edition.courseId,
      courseTitle,
      short_description: course?.short_description ?? "",
      adminNumber: edition.adminNumber,
      label: edition.label,
      title: editionName(courseTitle, edition.label),
      status: edition.status,
      timeStatus: edition.timeStatus,
      price: edition.price,
      max_participants: edition.max_participants ?? null,
      start_date: edition.start_date ?? null,
      end_date: edition.end_date ?? null,
      amount_of_classes: edition.amount_of_classes,
    };
  });
}

/**
 * Edition detail (REST). Visible to admins, to users enrolled in it and, when it is
 * published and its course active, to everyone. Non-admins get no paid count.
 */
export async function getEditionDetail(actor, id) {
  const editionId = editionObjectId(id);
  const db = await getDb();
  const edition = await loadEdition(db, { _id: editionId });
  if (!edition) throw editionNotFound();
  const course = await db
    .collection("courses")
    .findOne({ _id: edition.courseId }, { projection: { title: 1, short_description: 1, status: 1 } });

  const admin = isAdminActor(actor);
  let userPaymentStatus = null;
  if (actor?.id) {
    const enrollment = await db
      .collection("courseEnrollments")
      .findOne({ userId: toObjectId(actor.id), editionId }, { projection: { paymentStatus: 1 } });
    userPaymentStatus = enrollment?.paymentStatus ?? null;
  }
  const listed = edition.status === "published" && course?.status === "active";
  if (!listed && !admin && !userPaymentStatus) throw editionNotFound();

  const detail = { ...edition, course, ...(actor?.id ? { userPaymentStatus } : {}) };
  if (!admin) {
    delete detail.createdBy;
    delete detail.paidCount;
    // The edition number is admin-only
    delete detail.adminNumber;
    delete detail.editionCount;
  }
  return detail;
}

// ---------- Writes (admin) ----------

/**
 * Creates a new edition of a course (draft) from its most recently created one: same
 * price and capacity, and copies of its classes without dates (copyClassForEdition).
 * The course document is touched inside the transaction, so a concurrent deleteCourse
 * (which deletes it in its own transaction) conflicts with the creation and the retried
 * one sees the other's result: no edition can outlive its course. Returns { _id }.
 */
export async function createEdition(actor, id) {
  assertAdmin(actor);
  const courseId = courseObjectId(id);
  const adminId = toObjectId(actor.id);

  // The new edition and its classes are created together or not at all
  return withTransaction(async ({ db, session }) => {
    const now = new Date();
    const course = await db
      .collection("courses")
      .findOneAndUpdate({ _id: courseId }, { $set: { updatedAt: now } }, { projection: { _id: 1 }, session });
    if (!course) throw courseNotFound();

    const editions = db.collection("courseEditions");
    const [source] = await editions
      .find({ courseId }, { sort: { createdAt: -1, _id: -1 }, limit: 1, session })
      .toArray();
    if (!source) throw new HttpError(400, "El curso no tiene ediciones para copiar");

    const { insertedId: editionId } = await editions.insertOne(
      prepareEditionForDB({ courseId, price: source.price, max_participants: source.max_participants }, adminId),
      { session },
    );

    const classes = await db.collection("classes").find({ editionId: source._id }, { session }).toArray();
    if (classes.length > 0) {
      await db
        .collection("classes")
        .insertMany(classes.map((cls) => copyClassForEdition(cls, { editionId, adminId, now })), { session });
    }
    return { _id: editionId.toString() };
  });
}

/** Edits price and capacity (0 = no limit) of a draft edition. */
export async function updateEdition(actor, id, input) {
  assertAdmin(actor);
  const editionId = editionObjectId(id);
  const { price, max_participants } = parseOrThrow(EditionFormSchema, input);

  const db = await getDb();
  const edition = await findEditionOrThrow(db, editionId, { projection: { status: 1 } });
  const error = editionEditError(edition);
  if (error) throw new HttpError(400, error);

  const changes = { price, max_participants: max_participants || null };
  // Conditional: an edition published in the meantime keeps its price and capacity
  const result = await db
    .collection("courseEditions")
    .updateOne({ _id: editionId, status: "draft" }, { $set: addTimestampToUpdate(changes) });
  if (result.matchedCount === 0) {
    throw new HttpError(409, "La edición cambió mientras se editaba. Volvé a intentarlo.");
  }
  return { _id: editionId, ...changes };
}

/**
 * Publishes an edition (active course, at least one class, all dated, the first one in
 * the future: publishEditionError) or takes it back to draft (not while in progress).
 * Publishing touches the course inside the transaction, so it conflicts with a
 * concurrent archive (setCourseStatus) instead of both passing on stale reads.
 */
export async function setEditionStatus(actor, id, input) {
  assertAdmin(actor);
  const editionId = editionObjectId(id);
  const { status } = parseOrThrow(StatusUpdateSchema, input, { useIssueMessage: true });

  return withTransaction(async ({ db, session }) => {
    const edition = await findEditionOrThrow(db, editionId, { projection: { courseId: 1, status: 1 }, session });
    let error;
    if (status === "published") {
      const course = await db
        .collection("courses")
        .findOneAndUpdate(
          { _id: edition.courseId },
          { $set: { updatedAt: new Date() } },
          { projection: { status: 1 }, session },
        );
      const classes = await db
        .collection("classes")
        .find({ editionId }, { projection: { start_date: 1 }, session })
        .toArray();
      error = publishEditionError({ courseStatus: course?.status, classes, now: new Date() });
    } else {
      const timeStatus = await getEditionTimeStatusFromClasses(db, editionId, edition.status, { session });
      error = unpublishEditionError({ timeStatus });
    }
    if (error) throw new HttpError(400, error);

    const result = await db
      .collection("courseEditions")
      .updateOne({ _id: editionId }, { $set: { status, updatedAt: new Date() } }, { session });
    if (result.matchedCount === 0) throw editionNotFound();
    return { _id: editionId, status };
  });
}

/**
 * Deletes a draft edition with its classes, enrollments and reviews (one transaction).
 * After the commit its enrollees are notified ("course.edition_deleted") and the
 * Calendar events of its classes are deleted.
 */
export async function deleteEdition(actor, id) {
  assertAdmin(actor);
  const editionId = editionObjectId(id);

  await withTransaction(async ({ db, session, afterCommit }) => {
    const edition = await findEditionOrThrow(db, editionId, { session });
    const error = deleteEditionError(edition);
    if (error) throw new HttpError(400, error);

    const course = await db
      .collection("courses")
      .findOne({ _id: edition.courseId }, { projection: { title: 1 }, session });
    // Named before the deletes, while the edition still counts among its siblings
    const labels = await getEditionLabels(db, [edition.courseId], { session });
    const courseTitle = editionName(course?.title ?? "Curso", labels.get(editionId.toString())?.label);
    const classes = db.collection("classes");
    const enrollments = db.collection("courseEnrollments");
    const removedClasses = await classes
      .find({ editionId }, { projection: { googleEventId: 1, createdBy: 1 }, session })
      .toArray();
    const enrolleeIds = (
      await enrollments.find({ editionId }, { projection: { userId: 1 }, session }).toArray()
    ).map((e) => e.userId);

    await classes.deleteMany({ editionId }, { session });
    await enrollments.deleteMany({ editionId }, { session });
    await db.collection("reviews").deleteMany({ editionId }, { session });
    // Conditional: an edition published in the meantime is not deleted
    const { deletedCount } = await db
      .collection("courseEditions")
      .deleteOne({ _id: editionId, status: "draft" }, { session });
    if (deletedCount === 0) {
      throw new HttpError(409, "La edición cambió mientras se eliminaba. Volvé a intentarlo.");
    }

    afterCommit(() =>
      notify(db, "course.edition_deleted", {
        to: enrolleeIds,
        vars: { courseTitle },
        relatedId: editionId,
        relatedType: "edition",
        metadata: { courseId: edition.courseId },
      }),
    );
    afterCommit(() => Promise.all(removedClasses.map(deleteClassCalendarEvent)));
  });
}
