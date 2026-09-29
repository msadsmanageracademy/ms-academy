import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import {
  HttpError,
  handleApiError,
  isAdmin,
  requireSession,
  resolveTargetUserId,
} from "@/lib/api/guards";
import {
  prepareCourseEnrollmentForDB,
  prepareNotificationForDB,
} from "@/models/schemas";

export async function PATCH(req, { params }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    if (!ObjectId.isValid(id)) throw new HttpError(400, "ID de curso inválido");
    if (isAdmin(session)) {
      throw new HttpError(403, "Los administradores no pueden inscribirse");
    }

    const userId = new ObjectId(resolveTargetUserId(session, body.userId));
    const courseId = new ObjectId(id);

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const coursesCollection = db.collection("courses");
    const enrollmentsCollection = db.collection("courseEnrollments");

    const course = await coursesCollection.findOne(
      { _id: courseId },
      { projection: { title: 1, createdBy: 1, status: 1, max_participants: 1 } },
    );
    if (!course) throw new HttpError(404, "Curso no encontrado");
    if (course.status !== "published") {
      throw new HttpError(400, "El curso no está publicado");
    }

    const hasCapacity =
      course.max_participants !== null && course.max_participants !== undefined;

    if (hasCapacity) {
      const enrollmentCount = await enrollmentsCollection.countDocuments({ courseId });
      if (enrollmentCount >= course.max_participants) {
        throw new HttpError(400, "El cupo máximo de este curso ha sido alcanzado");
      }
    }

    // Create enrollment with pending payment status.
    // The unique index (userId, courseId) rejects duplicates, even under concurrency.
    let insertedId;
    try {
      ({ insertedId } = await enrollmentsCollection.insertOne(
        prepareCourseEnrollmentForDB(userId, courseId),
      ));
    } catch (error) {
      if (error?.code === 11000) throw new HttpError(400, "Ya estás inscripto en este curso");
      throw error;
    }

    // Capacity check after inserting: enrollments are ordered by _id (creation order),
    // so if two users take the last seat at the same time, the later one is rolled back.
    if (hasCapacity) {
      const earlierOrSame = await enrollmentsCollection.countDocuments({
        courseId,
        _id: { $lte: insertedId },
      });
      if (earlierOrSame > course.max_participants) {
        await enrollmentsCollection.deleteOne({ _id: insertedId });
        throw new HttpError(400, "El cupo máximo de este curso ha sido alcanzado");
      }
    }

    await db.collection("classes").updateMany(
      { courseId },
      {
        $addToSet: { participants: userId },
        $set: { updatedAt: new Date() },
      },
    );

    const notificationsToCreate = [
      prepareNotificationForDB({
        userId,
        type: "course.pre_enrolled",
        title: "Pre-inscripción realizada",
        message: `Te pre-inscribiste en el curso "${course.title}". Completá el pago para confirmar tu inscripción.`,
        relatedId: courseId,
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
          relatedId: courseId,
          relatedType: "course",
          actorId: userId,
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
    return handleApiError(error, "Error en la inscripción al curso");
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    if (!ObjectId.isValid(id)) throw new HttpError(400, "ID de curso inválido");

    const userId = new ObjectId(
      resolveTargetUserId(session, searchParams.get("userId")),
    );
    const courseId = new ObjectId(id);

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const coursesCollection = db.collection("courses");
    const enrollmentsCollection = db.collection("courseEnrollments");

    const course = await coursesCollection.findOne(
      { _id: courseId },
      { projection: { title: 1, createdBy: 1 } },
    );
    if (!course) throw new HttpError(404, "Curso no encontrado");

    const enrollment = await enrollmentsCollection.findOne({ userId, courseId });
    if (!enrollment) throw new HttpError(400, "No estás inscripto en este curso");

    // Paid enrollments cannot be cancelled by the student
    if (enrollment.paymentStatus === "paid" && !isAdmin(session)) {
      throw new HttpError(403, "No podés cancelar una inscripción ya pagada");
    }

    await enrollmentsCollection.deleteOne({ _id: enrollment._id });

    await coursesCollection.updateOne(
      { _id: courseId },
      {
        $pull: { participants: userId },
        $set: { updatedAt: new Date() },
      },
    );
    await db.collection("classes").updateMany(
      { courseId },
      {
        $pull: { participants: userId },
        $set: { updatedAt: new Date() },
      },
    );

    const notificationsToCreate = [
      prepareNotificationForDB({
        userId,
        type: "course.unenrolled",
        title: "Inscripción cancelada",
        message: `Cancelaste tu inscripción al curso "${course.title}".`,
        relatedId: courseId,
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
          relatedId: courseId,
          relatedType: "course",
          actorId: userId,
        }),
      );
    }
    await db.collection("notifications").insertMany(notificationsToCreate);

    return Response.json(
      { success: true, message: "Inscripción cancelada con éxito" },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "Error al cancelar inscripción al curso");
  }
}
