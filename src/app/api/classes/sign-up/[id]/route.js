import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";

export async function PATCH(req, { params }) {
  try {
    const body = await req.json();
    const { id } = params;
    const { userId } = body;

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de clase inválido",
        },
        { status: 400 }
      );

    if (!ObjectId.isValid(userId))
      return Response.json(
        {
          success: false,
          message: "ID de usuario inválido",
        },
        { status: 400 }
      );

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
        { success: false, message: "Clase no encontrada" },
        { status: 404 }
      );
    }

    // Get user details
    const user = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    const result = await classesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $addToSet: { participants: new ObjectId(userId) },
      }
    );

    if (result.modifiedCount === 0) {
      return Response.json(
        { success: false, message: "Ya estás inscripto en esta clase" },
        { status: 400 }
      );
    }

    // Create notifications
    const notifications = db.collection("notifications");
    const notificationsToCreate = [];

    // Notify user about signup
    notificationsToCreate.push({
      userId: new ObjectId(userId),
      type: "user_signup",
      title: "Inscripción exitosa",
      message: `Te has inscrito en la clase "${classItem.title}"`,
      relatedId: new ObjectId(id),
      relatedType: "class",
      read: false,
      createdAt: new Date(),
      metadata: {
        classTitle: classItem.title,
        startDate: classItem.start_date,
      },
    });

    // Notify admin about new signup
    if (classItem.createdBy) {
      notificationsToCreate.push({
        userId: new ObjectId(classItem.createdBy),
        type: "user_signup",
        title: "Nuevo participante",
        message: `${user?.first_name || "Un usuario"} ${
          user?.last_name || ""
        } se ha inscrito en "${classItem.title}"`,
        relatedId: new ObjectId(id),
        relatedType: "class",
        read: false,
        createdAt: new Date(),
        metadata: {
          classTitle: classItem.title,
          userName: `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
        },
      });
    }

    if (notificationsToCreate.length > 0) {
      await notifications.insertMany(notificationsToCreate);
    }

    return Response.json(
      { success: true, message: "Inscripción realizada con éxito" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error en la inscripción:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const { id } = params;

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de clase inválido",
        },
        { status: 400 }
      );

    if (!ObjectId.isValid(userId))
      return Response.json(
        {
          success: false,
          message: "ID de usuario inválido",
        },
        { status: 400 }
      );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");
    const usersCollection = db.collection("users");

    // Get class details before removing participant
    const classItem = await classesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!classItem) {
      return Response.json(
        { success: false, message: "Clase no encontrada" },
        { status: 404 }
      );
    }

    // Get user details
    const user = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    const result = await classesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $pull: { participants: new ObjectId(userId) },
      }
    );

    if (result.modifiedCount === 0) {
      return Response.json(
        { success: false, message: "No estás inscrito en esta clase" },
        { status: 400 }
      );
    }

    // Create notifications
    const notifications = db.collection("notifications");
    const notificationsToCreate = [];

    // Notify user about successful unenrollment
    notificationsToCreate.push({
      userId: new ObjectId(userId),
      type: "user_unenroll",
      title: "Inscripción cancelada",
      message: `Has cancelado tu inscripción en la clase "${classItem.title}"`,
      relatedId: new ObjectId(id),
      relatedType: "class",
      read: false,
      createdAt: new Date(),
      metadata: {
        classTitle: classItem.title,
        startDate: classItem.start_date,
      },
    });

    // Notify admin about unenrollment
    if (classItem.createdBy) {
      notificationsToCreate.push({
        userId: new ObjectId(classItem.createdBy),
        type: "user_unenroll",
        title: "Cancelación de inscripción",
        message: `${user?.first_name || "Un usuario"} ${
          user?.last_name || ""
        } ha cancelado su inscripción en "${classItem.title}"`,
        relatedId: new ObjectId(id),
        relatedType: "class",
        read: false,
        createdAt: new Date(),
        metadata: {
          classTitle: classItem.title,
          userName: `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
        },
      });
    }

    if (notificationsToCreate.length > 0) {
      await notifications.insertMany(notificationsToCreate);
    }

    return Response.json(
      { success: true, message: "Inscripción cancelada con éxito" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al cancelar inscripción:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
