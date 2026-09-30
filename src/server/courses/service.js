// Course use cases. Every function receives the acting user (or null) and enforces
// its own authorization, so REST routes and Server Actions can share them.
import { ObjectId } from "mongodb";
import { courseObjectId } from "@/server/ids";
import { getDb } from "@/lib/db";
import { notifyMany } from "@/server/notifications";
import { withTransaction } from "@/server/transactions";
import { CourseFormSchema, PublishedCourseEditSchema, StatusUpdateSchema } from "@/utils/validation";
import { HttpError, assertAdmin, isAdminActor, parseOrThrow, toObjectId } from "@/server/errors";
import { addTimestampToUpdate, prepareCourseForDB } from "@/models/schemas";
import { courseAggregationPipeline, getCourseTimeStatusFromClasses } from "./queries";
import { getReviewStats, getReviewStatsByEntity } from "@/server/reviews/queries";

// Status changes go through setCourseStatus, never through the generic edit
const CourseEditSchema = CourseFormSchema.omit({ status: true });

const hideAdminFields = (course) => {
  delete course.createdBy;
};

async function findCourseOrThrow(db, courseId, options) {
  const course = await db.collection("courses").findOne({ _id: courseId }, options);
  if (!course) throw new HttpError(404, "Curso no encontrado");
  return course;
}

// ---------- Reads ----------

/**
 * Course listing with schedule, enrollment counts and review stats.
 * `showAll` (admin) includes drafts and paid counts; logged-in users also get
 * their own `userPaymentStatus`.
 */
export async function listCourses(actor, { showAll } = {}) {
  if (showAll) assertAdmin(actor);
  const admin = isAdminActor(actor);

  const db = await getDb();
  const courses = await db
    .collection("courses")
    .aggregate(courseAggregationPipeline(showAll ? {} : { status: "published" }, { sort: { createdAt: -1 } }))
    .toArray();
  if (courses.length === 0) return courses;

  const courseIds = courses.map((c) => c._id);
  const enrollments = await db
    .collection("courseEnrollments")
    .find({ courseId: { $in: courseIds } }, { projection: { courseId: 1, userId: 1, paymentStatus: 1 } })
    .toArray();

  const counts = {};
  const mine = {};
  for (const e of enrollments) {
    const key = e.courseId.toString();
    counts[key] ??= { total: 0, paid: 0 };
    counts[key].total++;
    if (e.paymentStatus === "paid") counts[key].paid++;
    if (actor?.id && e.userId.toString() === actor.id) mine[key] = e.paymentStatus;
  }
  const reviews = await getReviewStatsByEntity(db, "courseId", courseIds);

  for (const course of courses) {
    const key = course._id.toString();
    const { total, paid } = counts[key] ?? { total: 0, paid: 0 };
    course.enrollmentCount = total;
    if (actor?.id) course.userPaymentStatus = mine[key] ?? null;
    if (admin) {
      course.enrolledCount = total;
      course.paidCount = paid;
    } else {
      hideAdminFields(course);
    }
    Object.assign(course, reviews[key] ?? { avgRating: null, reviewCount: 0 });
  }
  return courses;
}

/**
 * Course detail. Drafts are only visible to admins and enrolled users. Admins also
 * get `enrollmentMap` (userId → paymentStatus).
 */
export async function getCourseDetail(actor, id) {
  const courseId = courseObjectId(id);
  const db = await getDb();
  const [course] = await db
    .collection("courses")
    .aggregate(courseAggregationPipeline({ _id: courseId }))
    .toArray();
  if (!course) throw new HttpError(404, "Curso no encontrado");

  const admin = isAdminActor(actor);
  if (actor?.id) {
    const enrollment = await db
      .collection("courseEnrollments")
      .findOne({ userId: toObjectId(actor.id), courseId }, { projection: { paymentStatus: 1 } });
    course.userPaymentStatus = enrollment?.paymentStatus ?? null;
  }
  if (course.status !== "published" && !admin && !course.userPaymentStatus) {
    throw new HttpError(404, "Curso no encontrado");
  }

  const enrollments = await db
    .collection("courseEnrollments")
    .find({ courseId }, { projection: { userId: 1, paymentStatus: 1 } })
    .toArray();
  course.enrollmentCount = enrollments.length;
  if (admin) {
    course.enrollmentMap = Object.fromEntries(
      enrollments.map((e) => [e.userId.toString(), e.paymentStatus]),
    );
  } else {
    hideAdminFields(course);
  }

  Object.assign(course, await getReviewStats(db, { courseId }));
  if (actor?.id) {
    course.userReview =
      (await db.collection("reviews").findOne({ courseId, userId: toObjectId(actor.id) })) ?? null;
  }
  return course;
}

// ---------- Writes (admin) ----------

/** Creates a draft course as the first iteration of its own series. Returns its id. */
export async function createCourse(actor, input) {
  assertAdmin(actor);
  const fields = parseOrThrow(CourseEditSchema, input);
  const db = await getDb();
  // One insert: the id is generated here so the course can reference its own series
  const _id = new ObjectId();
  await db
    .collection("courses")
    .insertOne({ ...prepareCourseForDB(fields, toObjectId(actor.id)), _id, courseSeriesId: _id });
  return { _id: _id.toString() };
}

/** Edits the course content. Published courses only accept title and descriptions. */
export async function updateCourse(actor, id, input) {
  assertAdmin(actor);
  const courseId = courseObjectId(id);
  if ("status" in input) {
    throw new HttpError(400, `"status" se modifica con /api/courses/${id}/status`);
  }

  const db = await getDb();
  const existing = await findCourseOrThrow(db, courseId, { projection: { status: 1 } });

  let changes;
  if (existing.status === "published") {
    changes = parseOrThrow(PublishedCourseEditSchema, input);
  } else {
    const fields = parseOrThrow(CourseEditSchema, input);
    changes = { ...fields, max_participants: fields.max_participants === 0 ? null : fields.max_participants };
  }

  const result = await db
    .collection("courses")
    .updateOne({ _id: courseId }, { $set: addTimestampToUpdate(changes) });
  if (result.matchedCount === 0) throw new HttpError(404, "Curso no encontrado");
}

/**
 * Publishes or archives a course.
 * Publishing requires classes, all with a date, and the first one in the future.
 * Archiving is blocked while the course is in progress; enrollees are kept.
 */
export async function setCourseStatus(actor, id, input) {
  assertAdmin(actor);
  const courseId = courseObjectId(id);
  const { status } = parseOrThrow(StatusUpdateSchema, input, { useIssueMessage: true });

  const db = await getDb();
  await findCourseOrThrow(db, courseId, { projection: { _id: 1 } });
  const classes = db.collection("classes");

  if (status === "published") {
    if ((await classes.countDocuments({ courseId })) === 0) {
      throw new HttpError(
        400,
        "No se puede publicar un curso sin clases asignadas. Asignale al menos una clase primero.",
      );
    }
    const missingDateCount = await classes.countDocuments({
      courseId,
      $or: [{ start_date: null }, { start_date: { $exists: false } }],
    });
    if (missingDateCount > 0) {
      throw new HttpError(
        400,
        `No se puede publicar: ${missingDateCount} clase(s) no tienen fecha asignada`,
      );
    }
    const earliest = await classes.findOne(
      { courseId },
      { projection: { start_date: 1 }, sort: { start_date: 1 } },
    );
    if (earliest?.start_date && new Date(earliest.start_date) < new Date()) {
      throw new HttpError(400, "No se puede publicar un curso cuya primera clase ya comenzó");
    }
  } else if ((await getCourseTimeStatusFromClasses(db, courseId, "published")) === "in-progress") {
    throw new HttpError(400, "No se puede archivar un curso que está en progreso en este momento");
  }

  await db
    .collection("courses")
    .updateOne({ _id: courseId }, { $set: { status, updatedAt: new Date() } });
  return { _id: courseId, status };
}

/**
 * Deletes an archived course and its enrollments. Its classes go back to standalone
 * drafts without participants, and the enrollees are notified for each class.
 */
export async function deleteCourse(actor, id) {
  assertAdmin(actor);
  const courseId = courseObjectId(id);

  // All or nothing: a half-deleted course would leave linked classes or orphan enrollments
  await withTransaction(async ({ db, session, afterCommit }) => {
    const course = await findCourseOrThrow(db, courseId, { session });
    if (course.status !== "draft") {
      throw new HttpError(400, "Solo se pueden eliminar cursos en estado archivado");
    }

    const classes = db.collection("classes");
    const enrollments = db.collection("courseEnrollments");
    const courseClasses = await classes
      .find({ courseId }, { projection: { _id: 1, title: 1 }, session })
      .toArray();
    const enrolleeIds = (
      await enrollments.find({ courseId }, { projection: { userId: 1 }, session }).toArray()
    ).map((e) => e.userId);

    await classes.updateMany(
      { courseId },
      { $unset: { courseId: "" }, $set: { status: "draft", participants: [], updatedAt: new Date() } },
      { session },
    );
    await enrollments.deleteMany({ courseId }, { session });
    await db.collection("courses").deleteOne({ _id: courseId, status: "draft" }, { session });

    afterCommit(() =>
      notifyMany(
        db,
        courseClasses.map((cls) => [
          "class.removed_by_admin.course_deleted",
          { to: enrolleeIds, vars: { classTitle: cls.title }, relatedId: cls._id },
        ]),
      ),
    );
  });
}

/**
 * Creates a new draft iteration of a course (same series) with copies of its
 * classes: no dates, participants, Calendar events, recordings or materials.
 * Returns the new course id.
 */
export async function cloneCourse(actor, id) {
  assertAdmin(actor);
  const courseId = courseObjectId(id);

  // The copy is complete or not created at all (never a course without its classes)
  return withTransaction(async ({ db, session }) => {
    const original = await findCourseOrThrow(db, courseId, { session });

    const now = new Date();
    const adminId = toObjectId(actor.id);
    const {
      _id,
      participants: _p,
      status: _s,
      createdAt: _ca,
      updatedAt: _ua,
      ...rest
    } = original;

    const { insertedId: newCourseId } = await db.collection("courses").insertOne(
      {
        ...rest,
        // Courses created before series existed fall back to their own id
        courseSeriesId: original.courseSeriesId ?? _id,
        status: "draft",
        createdBy: adminId,
        createdAt: now,
        updatedAt: now,
      },
      { session },
    );

    const originalClasses = await db.collection("classes").find({ courseId }, { session }).toArray();
    if (originalClasses.length > 0) {
      await db.collection("classes").insertMany(
        originalClasses.map(
          ({
            _id: _classId,
            participants: _cp,
            status: _cs,
            courseId: _cid,
            start_date: _sd,
            googleEventId: _ge,
            googleEventUrl: _gu,
            googleMeetLink: _gm,
            calendarEventLink: _cl,
            recording_url: _ru,
            resources: _r,
            createdAt: _cca,
            updatedAt: _cua,
            ...classRest
          }) => ({
            ...classRest,
            courseId: newCourseId,
            status: "enrolled",
            max_participants: null,
            start_date: null,
            resources: [],
            createdBy: adminId,
            createdAt: now,
            updatedAt: now,
          }),
        ),
        { session },
      );
    }
    return { _id: newCourseId.toString() };
  });
}
