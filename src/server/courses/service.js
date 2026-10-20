// Course use cases. The course is the product; every time it is taught is an edition
// (see ./editions.js). Every function receives the acting user (or null) and enforces
// its own authorization, so REST routes and Server Actions can share them.
import { courseObjectId } from "@/server/ids";
import { deleteClassCalendarEvent } from "@/server/classes/calendar";
import { getDb } from "@/lib/db";
import { withTransaction } from "@/server/transactions";
import { CourseCreateSchema, CourseFormSchema, CourseStatusSchema } from "@/utils/validation";
import { HttpError, assertAdmin, isAdminActor, parseOrThrow, toObjectId } from "@/server/errors";
import { addTimestampToUpdate, prepareCourseForDB, prepareEditionForDB } from "@/models/schemas";
import { archiveCourseError, deleteCourseError } from "./rules";
import {
  courseMetrics,
  editionDate,
  pickCurrentEdition,
  pickOpenEdition,
  sortCourseCards,
  withEditionLabels,
  withTimeStatus,
} from "@/utils/courseEditions";
import {
  editionAggregationPipeline,
  findCourseEditions,
  getEnrollmentCounts,
  withEditionCounts,
} from "./queries";
import { getCourseReviewStats, getEditionReviewStats } from "@/server/reviews/queries";

const NO_REVIEWS = { avgRating: null, reviewCount: 0 };

// Stored course fields (legacy fields of older models are never returned)
const COURSE_FIELDS = {
  title: 1,
  short_description: 1,
  full_description: 1,
  status: 1,
  createdBy: 1,
  createdAt: 1,
  updatedAt: 1,
};

async function findCourseOrThrow(db, courseId, options) {
  const course = await db.collection("courses").findOne({ _id: courseId }, options);
  if (!course) throw new HttpError(404, "Curso no encontrado");
  return course;
}

/**
 * Aggregated editions (schedule, time status, label and adminNumber) of several courses,
 * drafts included (labels count every edition), in chronological order per course.
 */
async function findEditionsOf(db, courseIds) {
  if (courseIds.length === 0) return [];
  const editions = await db
    .collection("courseEditions")
    .aggregate(editionAggregationPipeline({ courseId: { $in: courseIds } }))
    .toArray();
  return withEditionLabels(editions.map(withTimeStatus));
}

function groupByCourse(editions) {
  const byCourse = new Map();
  for (const edition of editions) {
    const key = edition.courseId.toString();
    if (!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key).push(edition);
  }
  return byCourse;
}

/** The actor's payment status per edition: map editionId → "pending" | "paid". */
async function findMyPaymentStatuses(db, actor, editionIds) {
  if (!actor?.id || editionIds.length === 0) return {};
  const mine = await db
    .collection("courseEnrollments")
    .find(
      { userId: toObjectId(actor.id), editionId: { $in: editionIds } },
      { projection: { editionId: 1, paymentStatus: 1 } },
    )
    .toArray();
  return Object.fromEntries(mine.map((e) => [e.editionId.toString(), e.paymentStatus]));
}

/** Public shape of the edition open to enrollment (no paid counts, no edition number). */
function publicEdition(edition, counts, mine, actor) {
  const key = edition._id.toString();
  return {
    _id: edition._id,
    label: edition.label,
    price: edition.price,
    max_participants: edition.max_participants ?? null,
    start_date: edition.start_date ?? null,
    end_date: edition.end_date ?? null,
    amount_of_classes: edition.amount_of_classes,
    total_duration: edition.total_duration ?? 0,
    enrollmentCount: counts[key]?.total ?? 0,
    timeStatus: edition.timeStatus,
    ...(actor?.id ? { userPaymentStatus: mine[key] ?? null } : {}),
  };
}

/** Admin summary of an edition (cards and tables). */
const editionSummary = (edition) => ({
  _id: edition._id,
  adminNumber: edition.adminNumber,
  label: edition.label,
  status: edition.status,
  timeStatus: edition.timeStatus,
  price: edition.price,
  max_participants: edition.max_participants ?? null,
  start_date: edition.start_date,
  end_date: edition.end_date,
  amount_of_classes: edition.amount_of_classes,
  enrollmentCount: edition.enrollmentCount,
  paidCount: edition.paidCount,
});

// Most recent date among the editions (first class, else creation), or null
function latestEditionDate(editions) {
  let latest = null;
  for (const edition of editions) {
    const date = editionDate(edition);
    if (date && (latest === null || new Date(date) > new Date(latest))) latest = date;
  }
  return latest;
}

// Classes per edition: those of the current edition, else of the chronologically last one
const classesPerEdition = (current, editions) => (current ?? editions.at(-1))?.amount_of_classes ?? 0;

// ---------- Reads ----------

/**
 * Public catalog: active courses with an edition open to enrollment (see pickOpenEdition),
 * newest first. Ratings count every edition of the course; logged-in users also get
 * their own `userPaymentStatus` in the open edition.
 * → [{ _id, title, short_description, avgRating, reviewCount, openEdition: {...} }]
 */
export async function listCourses(actor) {
  const db = await getDb();
  const courses = await db
    .collection("courses")
    .find({ status: "active" }, { sort: { createdAt: -1 }, projection: { title: 1, short_description: 1 } })
    .toArray();
  // Every edition (drafts too) so the labels match the admin ones; pickOpenEdition skips drafts
  const byCourse = groupByCourse(await findEditionsOf(db, courses.map((c) => c._id)));

  const listed = courses
    .map((course) => ({ course, open: pickOpenEdition(byCourse.get(course._id.toString()) ?? []) }))
    .filter(({ open }) => open);
  if (listed.length === 0) return [];

  const openIds = listed.map(({ open }) => open._id);
  const [counts, stats, mine] = await Promise.all([
    getEnrollmentCounts(db, openIds),
    getCourseReviewStats(db, listed.map(({ course }) => course._id)),
    findMyPaymentStatuses(db, actor, openIds),
  ]);
  return listed.map(({ course, open }) => ({
    _id: course._id,
    title: course.title,
    short_description: course.short_description,
    ...(stats[course._id.toString()] ?? NO_REVIEWS),
    openEdition: publicEdition(open, counts, mine, actor),
  }));
}

/**
 * Admin: one card per course, sorted with sortCourseCards (current edition first).
 * → [{ _id, title, short_description, status, current, latest, lastDate, classesPerEdition,
 *      editionCount, timesTaught, enrolledCount, paidCount, estimatedRevenue, avgRating, reviewCount }]
 */
export async function listAdminCourses(actor) {
  assertAdmin(actor);
  const db = await getDb();
  const courses = await db
    .collection("courses")
    .find({}, { projection: { title: 1, short_description: 1, status: 1 } })
    .toArray();
  const editions = await findEditionsOf(db, courses.map((c) => c._id));
  const [counts, stats] = await Promise.all([
    getEnrollmentCounts(db, editions.map((e) => e._id)),
    getCourseReviewStats(db, courses.map((c) => c._id)),
  ]);
  const byCourse = groupByCourse(editions.map((e) => withEditionCounts(e, counts)));

  const cards = courses.map((course) => {
    const own = byCourse.get(course._id.toString()) ?? [];
    const current = pickCurrentEdition(own);
    const latest = own.at(-1) ?? null;
    return {
      _id: course._id,
      title: course.title,
      short_description: course.short_description,
      status: course.status,
      current: current ? editionSummary(current) : null,
      latest: latest ? editionSummary(latest) : null,
      lastDate: latestEditionDate(own),
      classesPerEdition: classesPerEdition(current, own),
      ...courseMetrics(own),
      ...(stats[course._id.toString()] ?? NO_REVIEWS),
    };
  });
  return sortCourseCards(cards);
}

/**
 * Public course page: the course, its open edition (or null) and the ratings of every
 * edition. Visible when the course is active with a published edition, to admins, and
 * to users enrolled in any of its editions; otherwise 404.
 */
export async function getCourseDetail(actor, id) {
  const courseId = courseObjectId(id);
  const db = await getDb();
  const course = await findCourseOrThrow(db, courseId, { projection: COURSE_FIELDS });
  const editions = await findCourseEditions(db, courseId);

  const admin = isAdminActor(actor);
  const mine = await findMyPaymentStatuses(db, actor, editions.map((e) => e._id));
  const listed = course.status === "active" && editions.some((e) => e.status === "published");
  if (!listed && !admin && Object.keys(mine).length === 0) {
    throw new HttpError(404, "Curso no encontrado");
  }

  const open = pickOpenEdition(editions);
  const [counts, stats] = await Promise.all([
    getEnrollmentCounts(db, open ? [open._id] : []),
    getCourseReviewStats(db, [courseId]),
  ]);
  if (!admin) delete course.createdBy;
  return {
    ...course,
    ...(stats[courseId.toString()] ?? NO_REVIEWS),
    openEdition: open ? publicEdition(open, counts, mine, actor) : null,
  };
}

/**
 * Admin course page: the course, every edition (schedule, time status, enrollment
 * counts and its own ratings) and the course-wide metrics.
 * → { ...course, editions: [...], metrics: { editionCount, timesTaught, enrolledCount,
 *     paidCount, estimatedRevenue, avgRating, reviewCount, classesPerEdition } }
 */
export async function getAdminCourse(actor, id) {
  assertAdmin(actor);
  const courseId = courseObjectId(id);
  const db = await getDb();
  const course = await findCourseOrThrow(db, courseId, { projection: COURSE_FIELDS });
  const found = await findCourseEditions(db, courseId);

  const ids = found.map((e) => e._id);
  const [counts, editionStats, courseStats] = await Promise.all([
    getEnrollmentCounts(db, ids),
    getEditionReviewStats(db, ids),
    getCourseReviewStats(db, [courseId]),
  ]);
  const editions = found.map((e) => withEditionCounts(e, counts, editionStats));
  return {
    ...course,
    editions,
    metrics: {
      ...courseMetrics(editions),
      ...(courseStats[courseId.toString()] ?? NO_REVIEWS),
      classesPerEdition: classesPerEdition(pickCurrentEdition(editions), editions),
    },
  };
}

// ---------- Writes (admin) ----------

/**
 * Creates an active course and its first edition (draft, with the given price and
 * capacity) in one transaction. Returns { _id, editionId }.
 */
export async function createCourse(actor, input) {
  assertAdmin(actor);
  const { price, max_participants, ...content } = parseOrThrow(CourseCreateSchema, input);
  const adminId = toObjectId(actor.id);

  // Never a course without its first edition
  return withTransaction(async ({ db, session }) => {
    const { insertedId: courseId } = await db
      .collection("courses")
      .insertOne(prepareCourseForDB(content, adminId), { session });
    const { insertedId: editionId } = await db
      .collection("courseEditions")
      .insertOne(prepareEditionForDB({ courseId, price, max_participants }, adminId), { session });
    return { _id: courseId.toString(), editionId: editionId.toString() };
  });
}

/** Edits the course content (title and descriptions), whatever the state of its editions. */
export async function updateCourse(actor, id, input) {
  assertAdmin(actor);
  const courseId = courseObjectId(id);
  if (input && typeof input === "object" && "status" in input) {
    throw new HttpError(400, "El estado del curso se cambia por separado: enviá solo { status }");
  }
  const changes = parseOrThrow(CourseFormSchema, input);

  const db = await getDb();
  const result = await db
    .collection("courses")
    .updateOne({ _id: courseId }, { $set: addTimestampToUpdate(changes) });
  if (result.matchedCount === 0) throw new HttpError(404, "Curso no encontrado");
}

/**
 * Archives or reactivates a course. Archiving is blocked while an edition is
 * published and upcoming or in progress (see archiveCourseError).
 * The check and the write share a transaction that writes the course document;
 * publishing an edition writes it too (setEditionStatus), so an archive and a
 * concurrent publish conflict and the retried one sees the other's result.
 */
export async function setCourseStatus(actor, id, input) {
  assertAdmin(actor);
  const courseId = courseObjectId(id);
  const { status } = parseOrThrow(CourseStatusSchema, input, { useIssueMessage: true });

  return withTransaction(async ({ db, session }) => {
    const course = await db
      .collection("courses")
      .findOneAndUpdate({ _id: courseId }, { $set: { status, updatedAt: new Date() } }, { session });
    if (!course) throw new HttpError(404, "Curso no encontrado");
    if (status === "archived") {
      // Thrown inside the transaction: the status write above is rolled back
      const error = archiveCourseError({ editions: await findCourseEditions(db, courseId, { session }) });
      if (error) throw new HttpError(400, error);
    }
    return { _id: courseId, status };
  });
}

/**
 * Deletes a course without enrollments together with its editions, their classes and
 * the course reviews (one transaction). The Calendar events of those classes are
 * deleted after the commit. Courses with enrollments are archived instead.
 */
export async function deleteCourse(actor, id) {
  assertAdmin(actor);
  const courseId = courseObjectId(id);

  await withTransaction(async ({ db, session, afterCommit }) => {
    await findCourseOrThrow(db, courseId, { projection: { _id: 1 }, session });
    const editionIds = (
      await db.collection("courseEditions").find({ courseId }, { projection: { _id: 1 }, session }).toArray()
    ).map((e) => e._id);

    const enrollmentCount = await db
      .collection("courseEnrollments")
      .countDocuments({ editionId: { $in: editionIds } }, { session });
    const error = deleteCourseError({ enrollmentCount });
    if (error) throw new HttpError(400, error);

    const classes = db.collection("classes");
    const removedClasses = await classes
      .find({ editionId: { $in: editionIds } }, { projection: { googleEventId: 1, createdBy: 1 }, session })
      .toArray();
    await classes.deleteMany({ editionId: { $in: editionIds } }, { session });
    await db.collection("reviews").deleteMany({ courseId }, { session });
    await db.collection("courseEditions").deleteMany({ courseId }, { session });
    await db.collection("courses").deleteOne({ _id: courseId }, { session });

    afterCommit(() => Promise.all(removedClasses.map(deleteClassCalendarEvent)));
  });
}
