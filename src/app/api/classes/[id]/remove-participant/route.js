import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { prepareNotificationForDB } from "@/models/schemas";

export async function DELETE(req, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!ObjectId.isValid(id)) {
      return Response.json(
        {
          success: false,
          message: "ID de clase inválido",
        },
        { status: 400 }
      );
    }

    if (!userId || !ObjectId.isValid(userId)) {
      return Response.json(
        {
          success: false,
          message: "ID de usuario inválido",
        },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");
    const usersCollection = db.collection("users");

    // Get class details
    const classItem = await classesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!classItem) {
      return Response.json(
        {
          success: false,
          message: "Clase no encontrada",
        },
        { status: 404 }
      );
    }

    // Get user details
    const user = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    if (!user) {
      return Response.json(
        {
          success: false,
          message: "Usuario no encontrado",
        },
        { status: 404 }
      );
    }

    // Check if user is actually enrolled (participants are stored as ObjectId in MongoDB)
    const participantIds = classItem.participants || [];
    const isEnrolled = participantIds.some(
      (participantId) => participantId.toString() === userId
    );

    if (!isEnrolled) {
      return Response.json(
        {
          success: false,
          message: "El usuario no está inscrito en esta clase",
        },
        { status: 400 }
      );
    }

    // Remove participant from class (use ObjectId for $pull)
    const result = await classesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $pull: { participants: new ObjectId(userId) },
        $set: { updatedAt: new Date() },
      }
    );

    if (result.modifiedCount === 0) {
      return Response.json(
        {
          success: false,
          message: "No se pudo remover el participante",
        },
        { status: 500 }
      );
    }

    // Create notifications for both removed user and admin
    const notifications = db.collection("notifications");
    const notificationsToCreate = [];

    // Notification for the removed user
    notificationsToCreate.push(
      prepareNotificationForDB({
        userId: new ObjectId(userId),
        type: "user_unenroll",
        title: "Suscripción anulada",
        message: `Has sido dado de baja de la clase "${classItem.title}" por un administrador`,
        relatedId: new ObjectId(id),
        relatedType: "class",
        metadata: {
          classTitle: classItem.title,
          startDate: classItem.start_date,
          removedBy: "admin",
        },
      })
    );

    // Notification for the admin
    if (classItem.createdBy) {
      notificationsToCreate.push(
        prepareNotificationForDB({
          userId: new ObjectId(classItem.createdBy),
          type: "user_unenroll",
          title: "Participante removido",
          message: `Has removido a un usuario de la clase "${classItem.title}"`,
          relatedId: new ObjectId(id),
          relatedType: "class",
          metadata: {
            classTitle: classItem.title,
            startDate: classItem.start_date,
          },
        })
      );
    }

    if (notificationsToCreate.length > 0) {
      await notifications.insertMany(notificationsToCreate);
    }

    return Response.json(
      {
        success: true,
        message: "Participante removido con éxito",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al remover participante:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
