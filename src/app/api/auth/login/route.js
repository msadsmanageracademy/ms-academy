import clientPromise from "@/lib/db";
import jwt from "jsonwebtoken"; // Para generar el token JWT
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    const client = await clientPromise; // Obtener el cliente de MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME); // Seleccionar la base de datos
    const usersCollection = db.collection("users"); // Seleccionar la colección

    const formData = await req.formData(); // Leer el FormData

    const email = formData.get("email");
    const password = formData.get("password");

    // Verificar que los campos obligatorios estén presentes
    if (!email || !password) {
      return Response.json(
        { error: "El email y la contraseña son obligatorios" },
        { status: 400 }
      );
    }

    // Buscar al usuario en la base de datos por email
    const user = await usersCollection.findOne({ email });
    if (!user) {
      return Response.json({ error: "El usuario no existe" }, { status: 400 });
    }

    // Verificar si la contraseña proporcionada coincide con la almacenada
    const passwordIsValid = await bcrypt.compare(password, user.password);
    if (!passwordIsValid) {
      return Response.json({ error: "Contraseña incorrecta" }, { status: 400 });
    }

    // Generar un JWT (Token de acceso) para el usuario
    const token = jwt.sign(
      { userId: user._id, email: user.email }, // Payload
      process.env.JWT_SECRET, // Clave secreta para firmar el token
      { expiresIn: "8h" } // El token expira en 1 hora
    );

    // Devolver el token en la respuesta
    return Response.json(
      { message: "Inicio de sesión exitoso", token },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error en el login:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
