import clientPromise from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    const client = await clientPromise; // Obtener el cliente de MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME); // Seleccionar la base de datos
    const usersCollection = db.collection("users"); // Seleccionar la colección

    const formData = await req.formData(); // Leer el FormData

    const first_name = formData.get("first_name");
    const last_name = formData.get("last_name");
    const email = formData.get("email");
    const password = formData.get("password");

    // Verificar que los campos obligatorios estén presentes
    if (!first_name || !last_name || !email || !password) {
      return Response.json(
        { error: "Todos los campos son obligatorios" },
        { status: 400 }
      );
    }

    // Verificar si el usuario ya existe
    const userExists = await usersCollection.findOne({ email });
    if (userExists) {
      return Response.json(
        { error: "El email ya está registrado" },
        { status: 400 }
      );
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear el nuevo usuario
    const newUser = {
      first_name,
      last_name,
      email,
      password: hashedPassword,
    };

    await usersCollection.insertOne(newUser); // Guardar el usuario en MongoDB

    return Response.json(
      { data: { first_name }, message: "Usuario registrado con éxito" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error en registro:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
