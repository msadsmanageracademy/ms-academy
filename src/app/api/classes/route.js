import { ClassFormSchema } from "@/utils/validation";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/db";
import { getServerSession } from "next-auth";
import { prepareClassForDB, prepareNotificationForDB } from "@/models/schemas";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");

    const currentDate = new Date();

    const classes = await classesCollection
      .find({ start_date: { $gt: currentDate } })
      .sort({ start_date: 1 }) // Ascendente
      .toArray();

    return Response.json(
      {
        success: true,
        data: classes,
      },
      { status: 200 }
    );
  } catch (error) {
    return Response.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();

    // Dado que JSON convierte todo a string, vuelvo a darle el formato a la fechas
    if (body.start_date) body.start_date = new Date(body.start_date);
    if (body.end_date) body.end_date = new Date(body.end_date);

    const parsedBody = ClassFormSchema.safeParse(body);

    if (!parsedBody.success) {
      return Response.json(
        {
          success: false,
          message: "El formato de los datos es inválido",
          details: parsedBody.error.errors,
        },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");

    const classData = prepareClassForDB(
      body,
      session?.user?.id ? new ObjectId(session.user.id) : undefined
    );

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
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al crear la clase:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
