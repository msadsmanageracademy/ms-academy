import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";

export async function PATCH(req, { params }) {
  try {
    const body = await req.json();
    const { id } = params;
    const { userId } = body;

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de evento inválido",
        },
        { status: 400 }
      );

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de usuario inválido",
        },
        { status: 400 }
      );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const eventsCollection = db.collection("events");

    const result = await eventsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $addToSet: { participants: new ObjectId(userId) }, // addToSet evita duplicados
      }
    );

    if (result.modifiedCount === 0) {
      return Response.json(
        { success: false, message: "Ya estás inscripto en este evento" },
        { status: 400 }
      );
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
