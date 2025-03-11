import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";

export async function PATCH(req, { params }) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de usuario inválido",
        },
        { status: 400 }
      );

    const body = await req.json();

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection("users");

    await usersCollection.updateOne({ _id: new ObjectId(id) }, { $set: body });

    return Response.json(
      { success: true, message: "Información actualizada con éxito" },
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
