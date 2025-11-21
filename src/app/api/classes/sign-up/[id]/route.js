import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";

export async function PATCH(req, { params }) {
  try {
    const body = await req.json();
    const { id } = params;
    const { userId } = body;

    console.log(body);

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

    const result = await classesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $addToSet: { participants: new ObjectId(userId) }, // addToSet evita duplicados
      }
    );

    if (result.modifiedCount === 0) {
      return Response.json(
        { success: false, message: "Ya estás inscripto en esta clase" },
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

    return Response.json(
      { success: true, message: "Inscripción cancelada con éxito" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al cancelar inscripción:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
