import { ClassFormSchema } from "@/utils/validation";
import { ObjectId } from "mongodb";
import { assignClassToCourse } from "@/lib/classes/courseLink";
import clientPromise from "@/lib/db";
import { prepareClassForDB, prepareNotificationForDB } from "@/models/schemas";
import {
  HttpError,
  handleApiError,
  isAdmin,
  requireAdmin,
  requireSession,
} from "@/lib/api/guards";

const PAID_ONLY_FIELDS = [
  "googleEventId",
  "googleMeetLink",
  "calendarEventLink",
  "recording_url",
  "resources",
];

const courseTitleLookup = [
  {
    $lookup: {
      from: "courses",
      localField: "courseId",
      foreignField: "_id",
      as: "courseData",
    },
  },
  {
    $addFields: {
      courseTitle: { $arrayElemAt: ["$courseData.title", 0] },
    },
  },
  { $unset: "courseData" },
];

function toPublicClass(cls) {
  const {
    participants,
    createdBy,
    googleEventId,
    googleEventUrl,
    googleMeetLink,
    calendarEventLink,
    recording_url,
    resources,
    ...rest
  } = cls;
  return { ...rest, participantsCount: participants?.length ?? 0 };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const showAll = searchParams.get("showAll") === "true";
    const courseId = searchParams.get("courseId");
    const myClasses = searchParams.get("myClasses") === "true";

    const session = courseId || showAll
      ? await requireAdmin()
      : myClasses
        ? await requireSession()
        : null;

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");

    if (courseId) {
      if (!ObjectId.isValid(courseId)) {
        throw new HttpError(400, "ID de curso inválido");
      }
      const classes = await classesCollection
        .find({ courseId: new ObjectId(courseId) })
        .sort({ start_date: 1 })
        .toArray();

      return Response.json({ success: true, data: classes }, { status: 200 });
    }
    
    if (myClasses) {
      let classes = await classesCollection
        .aggregate([
          { $match: { participants: new ObjectId(session.user.id) } },
          ...courseTitleLookup,
          { $sort: { start_date: 1 } },
        ])
        .toArray();

      // Strip Google links / materials for classes in courses the user hasn't paid
      if (!isAdmin(session)) {
        const enrollments = await db
          .collection("courseEnrollments")
          .find({ userId: new ObjectId(session.user.id) })
          .project({ courseId: 1, paymentStatus: 1 })
          .toArray();
        const enrollmentMap = Object.fromEntries(
          enrollments.map((e) => [e.courseId.toString(), e.paymentStatus]),
        );
        classes = classes.map((cls) => {
          if (!cls.courseId) return cls;
          const paymentStatus = enrollmentMap[cls.courseId.toString()] ?? null;
          const sanitized = { ...cls, userCoursePaymentStatus: paymentStatus };
          if (paymentStatus !== "paid") {
            PAID_ONLY_FIELDS.forEach((field) => delete sanitized[field]);
          }
          return sanitized;
        });
      }

      return Response.json({ success: true, data: classes }, { status: 200 });
    }

    if (showAll) {
      const classes = await classesCollection
        .aggregate([...courseTitleLookup, { $sort: { start_date: 1 } }])
        .toArray();

      return Response.json({ success: true, data: classes }, { status: 200 });
    }

    const classes = await classesCollection
      .find({ start_date: { $gt: new Date() }, status: "published" })
      .sort({ start_date: 1 })
      .toArray();

    return Response.json(
      { success: true, data: classes.map(toPublicClass) },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "Error al obtener las clases");
  }
}

export async function POST(req) {
  try {
    const session = await requireAdmin();
    const body = await req.json();

    if (body.start_date) body.start_date = new Date(body.start_date);

    const parsedBody = ClassFormSchema.safeParse(body);

    if (!parsedBody.success) {
      return Response.json(
        {
          success: false,
          message: "El formato de los datos es inválido",
          details: parsedBody.error.errors,
        },
        { status: 400 },
      );
    }

    const {
      courseId: courseIdRaw,
      googleEventId,
      googleEventUrl,
      ...classFields
    } = parsedBody.data;

    if (classFields.start_date && classFields.start_date <= new Date()) {
      return Response.json(
        {
          success: false,
          message:
            "No se pueden crear clases con fechas pasadas. Solo se permiten eventos futuros.",
        },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");

    if (courseIdRaw && !ObjectId.isValid(courseIdRaw)) {
      throw new HttpError(400, "courseId inválido");
    }

    const adminId = new ObjectId(session.user.id);
    const classData = prepareClassForDB(classFields, adminId);

    const result = await classesCollection.insertOne(classData);

    if (courseIdRaw) {
      try {
        await assignClassToCourse(
          db,
          { ...classData, _id: result.insertedId },
          courseIdRaw,
        );
      } catch (error) {
        await classesCollection.deleteOne({ _id: result.insertedId });
        throw error;
      }
    }

    await db.collection("notifications").insertOne(
      prepareNotificationForDB({
        userId: adminId,
        type: "class.created",
        title: "Nueva clase creada",
        message: `Has creado la clase "${classFields.title}"`,
        relatedId: result.insertedId,
        relatedType: "class",
        actorId: adminId,
      }),
    );

    return Response.json(
      {
        success: true,
        message: `Clase creada con éxito`,
        data: {
          _id: result.insertedId.toString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "Error al crear la clase");
  }
}
