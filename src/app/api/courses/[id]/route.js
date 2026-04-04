import {
  CourseFormSchema,
  PublishedCourseEditSchema,
} from "@/utils/validation";
import { ObjectId } from "mongodb";
import { addTimestampToUpdate } from "@/models/schemas";
import { auth } from "@/lib/auth";
import clientPromise from "@/lib/db";
import { getCourseTimeStatus } from "@/utils/classStatus";

const courseAggregationPipeline = (matchStage) => [
  { $match: matchStage },
  {
    $lookup: {
      from: "classes",
      let: { courseId: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$courseId", "$$courseId"] } } },
        { $sort: { start_date: 1 } },
      ],
      as: "assignedClasses",
    },
  },
  {
    $addFields: {
      amount_of_classes: { $size: "$assignedClasses" },
      start_date: { $min: "$assignedClasses.start_date" },
      end_date: {
        $max: {
          $map: {
            input: "$assignedClasses",
            as: "c",
            in: {
              $add: ["$$c.start_date", { $multiply: ["$$c.duration", 60000] }],
            },
          },
        },
      },
      total_duration: { $sum: "$assignedClasses.duration" },
    },
  },
  { $unset: "assignedClasses" },
];

export async function GET(req, { params }) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de curso inválido",
        },
        { status: 400 },
      );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const coursesCollection = db.collection("courses");

    const results = await coursesCollection
      .aggregate(courseAggregationPipeline({ _id: new ObjectId(id) }))
      .toArray();

    const course = results[0];

    if (!course) {
      return Response.json(
        {
          success: false,
          message: "Curso no encontrado",
        },
        { status: 404 },
      );
    }

    // Attach userPaymentStatus for authenticated users
    const session = await auth();
    if (session?.user?.id) {
      const enrollment = await db
        .collection("courseEnrollments")
        .findOne(
          { userId: new ObjectId(session.user.id), courseId: new ObjectId(id) },
          { projection: { paymentStatus: 1 } },
        );
      course.userPaymentStatus = enrollment?.paymentStatus ?? null;
    }

    // Build enrollmentMap from all courseEnrollments (pending + paid)
    const enrollments = await db
      .collection("courseEnrollments")
      .find(
        { courseId: new ObjectId(id) },
        { projection: { userId: 1, paymentStatus: 1 } },
      )
      .toArray();
    course.enrollmentMap = Object.fromEntries(
      enrollments.map((e) => [e.userId.toString(), e.paymentStatus]),
    );

    // Attach avg rating and review count
    const reviewStats = await db
      .collection("reviews")
      .aggregate([
        { $match: { courseId: new ObjectId(id) } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: "$rating" },
            reviewCount: { $sum: 1 },
          },
        },
      ])
      .toArray();
    const stats = reviewStats[0] ?? { avgRating: null, reviewCount: 0 };
    course.avgRating = stats.avgRating
      ? Math.round(stats.avgRating * 10) / 10
      : null;
    course.reviewCount = stats.reviewCount;

    // Attach user's own review if logged in
    if (session?.user?.id) {
      course.userReview =
        (await db.collection("reviews").findOne({
          courseId: new ObjectId(id),
          userId: new ObjectId(session.user.id),
        })) ?? null;
    }

    return Response.json(
      {
        success: true,
        data: course,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error al obtener el curso:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de curso inválido",
        },
        { status: 400 },
      );

    // Status-only toggle — skip full form validation
    if (Object.keys(body).length === 1 && "status" in body) {
      if (!["draft", "published"].includes(body.status)) {
        return Response.json(
          { success: false, message: "Estado inválido" },
          { status: 400 },
        );
      }
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME);
      if (body.status === "published") {
        const classCount = await db
          .collection("classes")
          .countDocuments({ courseId: new ObjectId(id) });
        if (classCount === 0) {
          return Response.json(
            {
              success: false,
              message:
                "No se puede publicar un curso sin clases asignadas. Asignale al menos una clase primero.",
            },
            { status: 400 },
          );
        }

        const missingDateCount = await db.collection("classes").countDocuments({
          courseId: new ObjectId(id),
          $or: [{ start_date: null }, { start_date: { $exists: false } }],
        });
        if (missingDateCount > 0) {
          return Response.json(
            {
              success: false,
              message: `No se puede publicar: ${missingDateCount} clase(s) no tienen fecha asignada`,
            },
            { status: 400 },
          );
        }

        const earliest = await db
          .collection("classes")
          .findOne(
            { courseId: new ObjectId(id) },
            { projection: { start_date: 1 }, sort: { start_date: 1 } },
          );
        if (
          earliest?.start_date &&
          new Date(earliest.start_date) < new Date()
        ) {
          return Response.json(
            {
              success: false,
              message:
                "No se puede publicar un curso cuya primera clase ya comenzó",
            },
            { status: 400 },
          );
        }
      }
      // When reverting to draft, only block if the course is currently in-progress.
      // Participants are NOT removed — finished courses stay in their dashboard.
      if (body.status === "draft") {
        const dateStats = await db
          .collection("classes")
          .aggregate([
            { $match: { courseId: new ObjectId(id) } },
            {
              $group: {
                _id: null,
                start_date: { $min: "$start_date" },
                end_date: {
                  $max: {
                    $add: ["$start_date", { $multiply: ["$duration", 60000] }],
                  },
                },
              },
            },
          ])
          .toArray();
        const { start_date: courseStart, end_date: courseEnd } =
          dateStats[0] ?? {};
        if (
          getCourseTimeStatus(courseStart, courseEnd, "published") ===
          "in-progress"
        ) {
          return Response.json(
            {
              success: false,
              message:
                "No se puede archivar un curso que está en progreso en este momento",
            },
            { status: 400 },
          );
        }

        await db
          .collection("courses")
          .updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: "draft", updatedAt: new Date() } },
          );

        return Response.json(
          { success: true, message: "Estado actualizado" },
          { status: 200 },
        );
      }

      const result = await db
        .collection("courses")
        .updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: body.status, updatedAt: new Date() } },
        );
      if (result.matchedCount === 0) {
        return Response.json(
          { success: false, message: "Curso no encontrado" },
          { status: 404 },
        );
      }
      return Response.json(
        { success: true, message: "Estado actualizado" },
        { status: 200 },
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const coursesCollection = db.collection("courses");
    const classesCollection = db.collection("classes");

    // Check current course status to determine which fields are editable
    const existingCourse = await coursesCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { status: 1 } },
    );

    if (!existingCourse) {
      return Response.json(
        { success: false, message: "Curso no encontrado" },
        { status: 404 },
      );
    }

    // Published courses: only title and descriptions are editable
    if (existingCourse.status === "published") {
      const parsedBody = PublishedCourseEditSchema.safeParse(body);
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
      const result = await coursesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: addTimestampToUpdate(parsedBody.data) },
      );
      if (result.matchedCount === 0) {
        return Response.json(
          { success: false, message: "Curso no encontrado" },
          { status: 404 },
        );
      }
      return Response.json(
        { success: true, message: "Curso actualizado con éxito" },
        { status: 200 },
      );
    }

    // Draft course: full validation
    const parsedBody = CourseFormSchema.safeParse(body);

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

    // If trying to publish, require at least one assigned class
    if (parsedBody.data.status === "published") {
      const classCount = await classesCollection.countDocuments({
        courseId: new ObjectId(id),
      });
      if (classCount === 0) {
        return Response.json(
          {
            success: false,
            message:
              "No se puede publicar un curso sin clases asignadas. Asignale al menos una clase primero.",
          },
          { status: 400 },
        );
      }
    }

    const { status, ...fieldsToUpdate } = parsedBody.data;

    const updateData = addTimestampToUpdate({
      ...fieldsToUpdate,
      max_participants:
        fieldsToUpdate.max_participants === 0
          ? null
          : fieldsToUpdate.max_participants,
    });

    if (status !== undefined) {
      updateData.status = status;
    }

    const result = await coursesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData },
    );

    if (result.matchedCount === 0) {
      return Response.json(
        {
          success: false,
          message: "Curso no encontrado",
        },
        { status: 404 },
      );
    }

    return Response.json(
      {
        success: true,
        message: "Curso actualizado con éxito",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error al actualizar el curso:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de curso inválido",
        },
        { status: 400 },
      );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const coursesCollection = db.collection("courses");
    const classesCollection = db.collection("classes");

    // Verify the course exists before deleting
    const course = await coursesCollection.findOne({ _id: new ObjectId(id) });
    if (!course) {
      return Response.json(
        {
          success: false,
          message: "Curso no encontrado",
        },
        { status: 404 },
      );
    }

    if (course.status !== "draft") {
      return Response.json(
        {
          success: false,
          message: "Solo se pueden eliminar cursos en estado archivado",
        },
        { status: 400 },
      );
    }

    // Find all classes associated with this course that have participants
    const affectedClasses = await classesCollection
      .find(
        { courseId: new ObjectId(id), "participants.0": { $exists: true } },
        { projection: { _id: 1, title: 1, participants: 1 } },
      )
      .toArray();

    // Unassign all classes from this course, revert to draft, and clear participants
    await classesCollection.updateMany(
      { courseId: new ObjectId(id) },
      {
        $unset: { courseId: "" },
        $set: { status: "draft", participants: [], updatedAt: new Date() },
      },
    );

    // Notify each participant removed from their class
    if (affectedClasses.length > 0) {
      const notificationsCollection = db.collection("notifications");
      const notificationsToCreate = [];

      for (const classItem of affectedClasses) {
        for (const participantId of classItem.participants) {
          notificationsToCreate.push(
            prepareNotificationForDB({
              userId: participantId,
              type: "class.removed_by_admin",
              title: "Suscripción anulada",
              message: `Has sido dado de baja de la clase "${classItem.title}" porque el curso al que pertenecía fue eliminado`,
              relatedId: classItem._id,
              relatedType: "class",
            }),
          );
        }
      }

      if (notificationsToCreate.length > 0) {
        await notificationsCollection.insertMany(notificationsToCreate);
      }
    }

    await coursesCollection.deleteOne({ _id: new ObjectId(id) });

    return Response.json(
      {
        success: true,
        message: "Curso eliminado con éxito",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error al eliminar el curso:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
