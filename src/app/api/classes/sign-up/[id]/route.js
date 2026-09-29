import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { prepareNotificationForDB } from "@/models/schemas";
import {
  HttpError,
  handleApiError,
  isAdmin,
  requireSession,
  resolveTargetUserId,
} from "@/lib/api/guards";

export async function PATCH(req, { params }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    if (!ObjectId.isValid(id)) throw new HttpError(400, "ID de clase inválido");
    if (isAdmin(session)) {
      throw new HttpError(403, "Los administradores no pueden inscribirse");
    }

    const userId = new ObjectId(resolveTargetUserId(session, body.userId));
    const classId = new ObjectId(id);

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");

    const classItem = await classesCollection.findOne({ _id: classId });
    if (!classItem) throw new HttpError(404, "Clase no encontrada");

    if (classItem.courseId) {
      throw new HttpError(
        400,
        "Esta clase pertenece a un curso. Inscribite al curso para acceder.",
      );
    }
    if (classItem.status !== "published") {
      throw new HttpError(400, "La clase no está disponible para inscripción");
    }
    if (!classItem.start_date || new Date(classItem.start_date) <= new Date()) {
      throw new HttpError(400, "La clase ya comenzó o finalizó");
    }
    if (
      (classItem.participants || []).some((p) => p.toString() === userId.toString())
    ) {
      throw new HttpError(400, "Ya estás inscripto en esta clase");
    }

    const result = await classesCollection.updateOne(
      {
        _id: classId,
        status: "published",
        courseId: { $exists: false },
        start_date: { $gt: new Date() },
        participants: { $ne: userId },
        $or: [
          { max_participants: null },
          {
            $expr: {
              $lt: [
                { $size: { $ifNull: ["$participants", []] } },
                "$max_participants",
              ],
            },
          },
        ],
      },
      {
        $addToSet: { participants: userId },
        $set: { updatedAt: new Date() },
      },
    );

    if (result.modifiedCount === 0) {
      throw new HttpError(400, "El cupo máximo de esta clase ha sido alcanzado");
    }

    const user = await db
      .collection("users")
      .findOne({ _id: userId }, { projection: { first_name: 1, last_name: 1 } });

    const notificationsToCreate = [
      prepareNotificationForDB({
        userId,
        type: "class.enrolled",
        title: "Inscripción exitosa",
        message: `Te has inscrito en la clase "${classItem.title}"`,
        relatedId: classId,
        relatedType: "class",
        actorId: userId,
      }),
    ];

    if (classItem.createdBy) {
      notificationsToCreate.push(
        prepareNotificationForDB({
          userId: new ObjectId(classItem.createdBy),
          type: "class.participant_joined",
          title: "Nuevo participante",
          message: `${user?.first_name || "Un usuario"} ${
            user?.last_name || ""
          } se ha inscrito en "${classItem.title}"`,
          relatedId: classId,
          relatedType: "class",
          actorId: userId,
        }),
      );
    }

    await db.collection("notifications").insertMany(notificationsToCreate);

    return Response.json(
      { success: true, message: "Inscripción realizada con éxito" },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "Error en la inscripción");
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    if (!ObjectId.isValid(id)) throw new HttpError(400, "ID de clase inválido");

    const userId = new ObjectId(
      resolveTargetUserId(session, searchParams.get("userId")),
    );
    const classId = new ObjectId(id);

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");

    const classItem = await classesCollection.findOne({ _id: classId });
    if (!classItem) throw new HttpError(404, "Clase no encontrada");

    if (classItem.courseId) {
      throw new HttpError(
        400,
        "Esta clase pertenece a un curso. Gestioná la inscripción desde el curso.",
      );
    }

    const result = await classesCollection.updateOne(
      { _id: classId },
      {
        $pull: { participants: userId },
        $set: { updatedAt: new Date() },
      },
    );

    if (result.modifiedCount === 0) {
      throw new HttpError(400, "No estás inscripto en esta clase");
    }

    const user = await db
      .collection("users")
      .findOne({ _id: userId }, { projection: { first_name: 1, last_name: 1 } });

    const notificationsToCreate = [
      prepareNotificationForDB({
        userId,
        type: "class.unenrolled",
        title: "Inscripción cancelada",
        message: `Has cancelado tu inscripción en la clase "${classItem.title}"`,
        relatedId: classId,
        relatedType: "class",
        actorId: userId,
      }),
    ];

    if (classItem.createdBy) {
      notificationsToCreate.push(
        prepareNotificationForDB({
          userId: new ObjectId(classItem.createdBy),
          type: "class.participant_left",
          title: "Cancelación de inscripción",
          message: `${user?.first_name || "Un usuario"} ${
            user?.last_name || ""
          } ha cancelado su inscripción en "${classItem.title}"`,
          relatedId: classId,
          relatedType: "class",
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
    return handleApiError(error, "Error al cancelar inscripción");
  }
}
