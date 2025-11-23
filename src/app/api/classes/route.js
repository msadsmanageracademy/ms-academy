import { ClassFormSchema } from "@/utils/validation";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/db";
import { getServerSession } from "next-auth";

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

    // Set type to class
    body.type = "class";

    // Set createdBy if session exists
    if (session?.user?.id) {
      body.createdBy = session.user.id;
    }

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

    const result = await classesCollection.insertOne(body);

    // Create notification for admin
    if (session?.user?.id) {
      const notifications = db.collection("notifications");
      await notifications.insertOne({
        userId: new ObjectId(session.user.id),
        type: "class_created",
        title: "Nueva clase creada",
        message: `Has creado la clase "${body.title}"`,
        relatedId: result.insertedId,
        relatedType: "class",
        read: false,
        createdAt: new Date(),
        metadata: {
          classTitle: body.title,
          startDate: body.start_date,
        },
      });
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
