import { RegisterFormSchema } from "@/utils/validation";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/db";
import { handleApiError } from "@/lib/api/guards";
import { config } from "@/config";
import { prepareUserForDB } from "@/models/schemas";
import { getClientIp, hitRateLimit, tooManyRequests } from "@/lib/rateLimit";

const BCRYPT_ROUNDS = 12;
const REGISTER_LIMIT = { scope: "register-ip", limit: 5, windowSec: 60 * 60 };

export async function POST(req) {
  try {
    const { allowed, retryAfterSec } = await hitRateLimit({
      ...REGISTER_LIMIT,
      key: getClientIp(req.headers),
    });
    if (!allowed) return tooManyRequests(retryAfterSec);

    if (!config.allowRegistration) {
      return Response.json(
        {
          success: false,
          message: "El registro de nuevos usuarios está deshabilitado",
          error: "El registro de nuevos usuarios está deshabilitado",
        },
        { status: 403 },
      );
    }

    const body = await req.json();

    const parsedBody = RegisterFormSchema.strict().safeParse(body);

    if (!parsedBody.success) {
      return Response.json(
        {
          success: false,
          message: "El formato de los datos es inválido",
          details: parsedBody.error.errors,
        },
        { status: 400 },
      );
    }

    const { email, first_name, last_name, password } = parsedBody.data;
    const normalizedEmail = email.toLowerCase();

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection("users");

    const userExists = await usersCollection.findOne({ email: normalizedEmail });
    if (userExists) {
      return Response.json(
        {
          success: false,
          message: "El email ya está registrado",
          error: "El email ya está registrado",
        },
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const newUser = prepareUserForDB(
      { email: normalizedEmail, first_name, last_name, role: "user" },
      hashedPassword,
    );

    const result = await usersCollection.insertOne(newUser);

    return Response.json(
      {
        success: true,
        data: { id: result.insertedId, first_name },
        message: "Usuario registrado con éxito",
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "Error registering user");
  }
}
