import { ClassFormSchema } from "@/utils/validation";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import clientPromise from "@/lib/db";
import { prepareClassForDB, prepareNotificationForDB } from "@/models/schemas";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const showAll = searchParams.get("showAll") === "true";
    const courseId = searchParams.get("courseId");
    const myClasses = searchParams.get("myClasses") === "true";

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");

    // When filtering by courseId, return all classes for that course (admin use)
    if (courseId) {
      const classes = await classesCollection
        .find({ courseId: new ObjectId(courseId) })
        .sort({ start_date: 1 })
        .toArray();

      return Response.json({ success: true, data: classes }, { status: 200 });
    }

    // User's own classes (enrolled or participant, any status)
    if (myClasses) {
      const session = await auth();
      if (!session) {
        return Response.json(
          { success: false, message: "No autorizado" },
          { status: 401 },
        );
      }
      let classes = await classesCollection
        .aggregate([
          { $match: { participants: new ObjectId(session.user.id) } },
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
          { $sort: { start_date: 1 } },
        ])
        .toArray();

      // Strip Google links for classes in courses where user hasn't paid
      if (session.user.role !== "admin") {
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
          const paid = paymentStatus === "paid";
          return {
            ...cls,
            userCoursePaymentStatus: paymentStatus,
            ...(paid
              ? {}
              : {
                  googleEventId: undefined,
                  googleMeetLink: undefined,
                  calendarEventLink: undefined,
                }),
          };
        });
      }

      return Response.json({ success: true, data: classes }, { status: 200 });
    }

    const currentDate = new Date();

    const baseFilter = { start_date: { $gt: currentDate } };
    if (!showAll) {
      // Public view: only standalone published classes
      baseFilter.status = "published";
    }

    let classes;
    if (showAll) {
      // Include courseTitle via lookup
      classes = await classesCollection
        .aggregate([
          { $match: baseFilter },
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
          { $sort: { start_date: 1 } },
        ])
        .toArray();

      // Attach userCoursePaymentStatus and strip Google links for unpaid users
      const session = await auth();
      if (session?.user?.id && session.user.role !== "admin") {
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
          const paid = paymentStatus === "paid";
          return {
            ...cls,
            userCoursePaymentStatus: paymentStatus,
            // Strip Google links if user hasn't paid
            ...(paid
              ? {}
              : {
                  googleEventId: undefined,
                  googleMeetLink: undefined,
                  calendarEventLink: undefined,
                }),
          };
        });
      }
    } else {
      classes = await classesCollection
        .find(baseFilter)
        .sort({ start_date: 1 })
        .toArray();
    }

    return Response.json(
      {
        success: true,
        data: classes,
      },
      { status: 200 },
    );
  } catch (error) {
    return Response.json(
      {
        error: error.message,
      },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    const body = await req.json();

    // Dado que JSON convierte todo a string, vuelvo a darle el formato a la fechas
    if (body.start_date) body.start_date = new Date(body.start_date);
    if (body.end_date) body.end_date = new Date(body.end_date);

    // Extract courseId before validation so it doesn't interfere with form schema
    const { courseId: courseIdRaw, ...bodyWithoutCourseId } = body;

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

    const now = new Date();
    if (body.start_date <= now) {
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

    const classData = prepareClassForDB(
      bodyWithoutCourseId,
      session?.user?.id ? new ObjectId(session.user.id) : undefined,
    );

    // Assign to course if a valid courseId was provided
    if (courseIdRaw && ObjectId.isValid(courseIdRaw)) {
      classData.courseId = new ObjectId(courseIdRaw);
      classData.status = "enrolled";
    }

    const result = await classesCollection.insertOne(classData);

    // Create notification for admin
    if (session?.user?.id) {
      const notifications = db.collection("notifications");
      const notification = prepareNotificationForDB({
        userId: new ObjectId(session.user.id),
        type: "class.created",
        title: "Nueva clase creada",
        message: `Has creado la clase "${body.title}"`,
        relatedId: result.insertedId,
        relatedType: "class",
        actorId: new ObjectId(session.user.id),
      });
      await notifications.insertOne(notification);
    }

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
    console.error("Error al crear la clase:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
