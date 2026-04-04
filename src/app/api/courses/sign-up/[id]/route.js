import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  prepareCourseEnrollmentForDB,
  prepareNotificationForDB,
} from "@/models/schemas";

export async function PATCH(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(
        { success: false, message: "No autenticado" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { id } = params;
    const { userId } = body;

    if (!ObjectId.isValid(id))
      return Response.json(
        { success: false, message: "ID de curso inválido" },
        { status: 400 },
      );

    if (!ObjectId.isValid(userId))
      return Response.json(
        { success: false, message: "ID de usuario inválido" },
        { status: 400 },
      );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const coursesCollection = db.collection("courses");
    const enrollmentsCollection = db.collection("courseEnrollments");

    const course = await coursesCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { title: 1, createdBy: 1, status: 1 } },
    );
    if (!course) {
      return Response.json(
        { success: false, message: "Curso no encontrado" },
        { status: 404 },
      );
    }

    if (course.status !== "published") {
      return Response.json(
        { success: false, message: "El curso no está publicado" },
        { status: 400 },
      );
    }

    // Check for existing enrollment (any status)
    const existing = await enrollmentsCollection.findOne({
      userId: new ObjectId(userId),
      courseId: new ObjectId(id),
    });
    if (existing) {
      return Response.json(
        { success: false, message: "Ya estás inscripto en este curso" },
        { status: 400 },
      );
    }

    // Enforce max_participants capacity
    const courseWithParticipants = await coursesCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { max_participants: 1 } },
    );
    if (
      courseWithParticipants?.max_participants !== null &&
      courseWithParticipants?.max_participants !== undefined
    ) {
      const enrollmentCount = await enrollmentsCollection.countDocuments({
        courseId: new ObjectId(id),
      });
      if (enrollmentCount >= courseWithParticipants.max_participants) {
        return Response.json(
          {
            success: false,
            message: "El cupo máximo de este curso ha sido alcanzado",
          },
          { status: 400 },
        );
      }
    }

    // Create enrollment with pending payment status
    await enrollmentsCollection.insertOne(
      prepareCourseEnrollmentForDB(new ObjectId(userId), new ObjectId(id)),
    );

    // Add user as participant to all linked classes (NOT to course.participants yet)
    const classesCollection = db.collection("classes");
    await classesCollection.updateMany(
      { courseId: new ObjectId(id) },
      {
        $addToSet: { participants: new ObjectId(userId) },
        $set: { updatedAt: new Date() },
      },
    );

    // Notifications
    const notificationsToCreate = [
      prepareNotificationForDB({
        userId: new ObjectId(userId),
        type: "course.pre_enrolled",
        title: "Pre-inscripción realizada",
        message: `Te pre-inscribiste en el curso "${course.title}". Completá el pago para confirmar tu inscripción.`,
        relatedId: new ObjectId(id),
        relatedType: "course",
      }),
    ];
    if (course.createdBy) {
      notificationsToCreate.push(
        prepareNotificationForDB({
          userId: course.createdBy,
          type: "course.participant_pre_joined",
          title: "Nueva pre-inscripción",
          message: `Un usuario se pre-inscribió en el curso "${course.title}" y tiene pago pendiente.`,
          relatedId: new ObjectId(id),
          relatedType: "course",
          actorId: new ObjectId(userId),
        }),
      );
    }
    await db.collection("notifications").insertMany(notificationsToCreate);

    return Response.json(
      {
        success: true,
        message:
          "Pre-inscripción realizada con éxito. Completá el pago para confirmar.",
        data: { paymentStatus: "pending" },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error en la inscripción:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(
        { success: false, message: "No autenticado" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const { id } = params;

    if (!ObjectId.isValid(id))
      return Response.json(
        { success: false, message: "ID de curso inválido" },
        { status: 400 },
      );

    if (!ObjectId.isValid(userId))
      return Response.json(
        { success: false, message: "ID de usuario inválido" },
        { status: 400 },
      );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const coursesCollection = db.collection("courses");
    const enrollmentsCollection = db.collection("courseEnrollments");

    const course = await coursesCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { title: 1, createdBy: 1 } },
    );
    if (!course) {
      return Response.json(
        { success: false, message: "Curso no encontrado" },
        { status: 404 },
      );
    }

    const enrollment = await enrollmentsCollection.findOne({
      userId: new ObjectId(userId),
      courseId: new ObjectId(id),
    });
    if (!enrollment) {
      return Response.json(
        { success: false, message: "No estás inscrito en este curso" },
        { status: 400 },
      );
    }

    // Paid enrollments cannot be cancelled
    if (enrollment.paymentStatus === "paid" && session.user.role !== "admin") {
      return Response.json(
        {
          success: false,
          message: "No podés cancelar una inscripción ya pagada",
        },
        { status: 403 },
      );
    }

    // Delete enrollment
    await enrollmentsCollection.deleteOne({ _id: enrollment._id });

    // Remove from course.participants (in case they had paid) and all linked classes
    await coursesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $pull: { participants: new ObjectId(userId) },
        $set: { updatedAt: new Date() },
      },
    );
    const classesCollection = db.collection("classes");
    await classesCollection.updateMany(
      { courseId: new ObjectId(id) },
      {
        $pull: { participants: new ObjectId(userId) },
        $set: { updatedAt: new Date() },
      },
    );

    // Notifications
    const notificationsToCreate = [
      prepareNotificationForDB({
        userId: new ObjectId(userId),
        type: "course.unenrolled",
        title: "Inscripción cancelada",
        message: `Cancelaste tu inscripción al curso "${course.title}".`,
        relatedId: new ObjectId(id),
        relatedType: "course",
      }),
    ];
    if (course.createdBy) {
      notificationsToCreate.push(
        prepareNotificationForDB({
          userId: course.createdBy,
          type: "course.participant_left",
          title: "Un participante canceló su inscripción",
          message: `Un usuario canceló su inscripción al curso "${course.title}".`,
          relatedId: new ObjectId(id),
          relatedType: "course",
          actorId: new ObjectId(userId),
        }),
      );
    }
    await db.collection("notifications").insertMany(notificationsToCreate);

    return Response.json(
      { success: true, message: "Inscripción cancelada con éxito" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error al cancelar inscripción:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
