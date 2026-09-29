import { EditAccountFormSchema } from "@/utils/validation";
import { ObjectId } from "mongodb";
import { addTimestampToUpdate } from "@/models/schemas";
import clientPromise from "@/lib/db";
import {
  HttpError,
  handleApiError,
  isAdmin,
  requireSession,
} from "@/lib/api/guards";

// Whitelist of fields that can leave the server. Never expose password or Google tokens.
const PUBLIC_USER_PROJECTION = {
  first_name: 1,
  last_name: 1,
  email: 1,
  age: 1,
  image: 1,
  role: 1,
  createdAt: 1,
};

// Server-side schema: rejects any key other than the editable profile fields
const EditAccountServerSchema = EditAccountFormSchema.strict();

// Only the user themselves or an admin can access a user record
async function requireSelfOrAdmin(params) {
  const session = await requireSession();
  const { id } = await params;
  if (!ObjectId.isValid(id)) throw new HttpError(400, "ID de usuario inválido");
  if (id !== session.user.id && !isAdmin(session)) {
    throw new HttpError(403, "Acceso denegado");
  }
  return { session, id };
}

export async function GET(req, { params }) {
  try {
    const { id } = await requireSelfOrAdmin(params);

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);

    const user = await db
      .collection("users")
      .findOne(
        { _id: new ObjectId(id) },
        { projection: PUBLIC_USER_PROJECTION },
      );

    if (!user) throw new HttpError(404, "Usuario no encontrado");

    return Response.json({ success: true, data: user }, { status: 200 });
  } catch (error) {
    return handleApiError(error, "Error fetching user");
  }
}

export async function PATCH(req, { params }) {
  try {
    const { session, id } = await requireSelfOrAdmin(params);

    // Profile edits are self-service only (admins manage roles elsewhere)
    if (id !== session.user.id) throw new HttpError(403, "Acceso denegado");

    const body = await req.json();
    const parsedBody = EditAccountServerSchema.safeParse(body);

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

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);

    // Persist only validated fields (never the raw body)
    await db
      .collection("users")
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: addTimestampToUpdate(parsedBody.data) },
      );

    return Response.json(
      {
        success: true,
        message: "Información actualizada con éxito",
        name: parsedBody.data.first_name, // Envío al FE para actualizar la sesión de next-auth
      },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "Error updating user");
  }
}
