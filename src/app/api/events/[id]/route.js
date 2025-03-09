import { eventMongoSchema } from "@/utils/definitions";
import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";

export async function GET(req, { params }) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de evento inválido",
        },
        { status: 400 }
      );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const eventsCollection = db.collection("events");

    const event = await eventsCollection.findOne({ _id: new ObjectId(id) });

    if (!event) {
      return Response.json(
        { success: false, message: "Evento no encontrado" },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: event }, { status: 200 });
  } catch (error) {
    console.error("Error al recuperar el evento:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de evento inválido",
        },
        { status: 400 }
      );

    const body = await req.json();

    body.start_date = new Date(body.start_date);
    if (body.end_date) body.end_date = new Date(body.end_date);

    const parsedBody = eventMongoSchema.safeParse(body); // Paso el body por el schema de eventos previo a enviar a la DB

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
    const eventsCollection = db.collection("events");

    await eventsCollection.updateOne({ _id: new ObjectId(id) }, { $set: body });

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error al actualiza el evento:", error);
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
          message: "ID de evento inválido",
        },
        { status: 400 }
      );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const eventsCollection = db.collection("events");

    const result = await eventsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return new Response("Evento no encontrado", { status: 404 });
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error al eliminar el evento:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
