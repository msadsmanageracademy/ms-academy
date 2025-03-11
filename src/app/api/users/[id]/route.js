import { EditAccountFormSchema } from "@/utils/definitions";
import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";

export async function GET(req, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection("users");

    const { id } = params;

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de usuario inválido",
        },
        { status: 400 }
      );

    const user = await usersCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0 } } // No traigo la contraseña del user
    );

    if (!user) {
      return Response.json(
        { success: false, message: "Usuario no encontrado" },
        { status: 400 }
      );
    }

    return Response.json({ success: true, data: user }, { status: 200 });
  } catch (error) {
    console.error("Error al recuperar el usuario:", error);
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
          message: "ID de usuario inválido",
        },
        { status: 400 }
      );

    const body = await req.json();

    console.log(body);

    console.log(id);

    const parsedBody = EditAccountFormSchema.safeParse(body); // Paso el body por el schema de edición de perfil previo a enviar a la DB

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

    console.log(parsedBody);

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection("users");

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: body }
    );

    console.log(result);

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
