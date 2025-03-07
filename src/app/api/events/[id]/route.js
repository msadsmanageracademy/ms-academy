import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";

export async function GET(req, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const eventsCollection = db.collection("events");

    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return new Response(JSON.stringify({ error: "ID inválido" }), {
        status: 400,
      });
    }

    const event = await eventsCollection.findOne({ _id: new ObjectId(id) });

    if (!event) {
      return new Response(JSON.stringify({ error: "Evento no encontrado" }), {
        status: 404,
      });
    }

    return Response.json({ success: true, data: event }, { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
