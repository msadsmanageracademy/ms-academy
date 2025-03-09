import { RegisterFormSchema } from "@/utils/definitions";
import clientPromise from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    const body = await req.json();

    const parsedBody = RegisterFormSchema.safeParse(body);

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

    const client = await clientPromise; // Obtener el cliente de MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME); // Seleccionar la base de datos
    const usersCollection = db.collection("users"); // Seleccionar la colección

    const userExists = await usersCollection.findOne({ email: body.email });
    if (userExists) {
      return Response.json(
        { error: "El email ya está registrado" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(body.password, 10);

    const newUser = {
      ...body,
      password: hashedPassword,
    };

    const result = await usersCollection.insertOne(newUser);

    return Response.json(
      {
        success: true,
        data: { id: result.insertedId, first_name: body.first_name },
        message: "Usuario registrado con éxito",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error en registro:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
