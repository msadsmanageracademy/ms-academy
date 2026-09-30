// User accounts: registration and own profile.
import bcrypt from "bcryptjs";
import { config } from "@/config";
import { getDb } from "@/lib/db";
import { userObjectId } from "@/server/ids";
import { EditAccountFormSchema, RegisterFormSchema } from "@/utils/validation";
import { HttpError, assertUser, isAdminActor, parseOrThrow } from "@/server/errors";
import { addTimestampToUpdate, prepareUserForDB } from "@/models/schemas";

const BCRYPT_ROUNDS = 12;

// Whitelist of fields that can leave the server. Never password or Google tokens.
const PUBLIC_USER_PROJECTION = {
  first_name: 1,
  last_name: 1,
  email: 1,
  age: 1,
  image: 1,
  role: 1,
  createdAt: 1,
};

/** Creates a user account with the "user" role (if registration is enabled). */
export async function registerUser(input) {
  if (!config.allowRegistration) {
    throw new HttpError(403, "El registro de nuevos usuarios está deshabilitado");
  }
  // strict(): any key besides the form fields (e.g. `role`) is rejected
  const { email, first_name, last_name, password } = parseOrThrow(RegisterFormSchema.strict(), input);
  const normalizedEmail = email.toLowerCase();

  const users = (await getDb()).collection("users");
  const newUser = prepareUserForDB(
    { email: normalizedEmail, first_name, last_name, role: "user" },
    await bcrypt.hash(password, BCRYPT_ROUNDS),
  );
  try {
    const { insertedId } = await users.insertOne(newUser);
    return { id: insertedId, first_name };
  } catch (error) {
    // Unique email index (also covers two registrations at the same time)
    if (error?.code === 11000) throw new HttpError(400, "El email ya está registrado");
    throw error;
  }
}

/** A user's public fields: only the user themselves or an admin. */
export async function getUser(actor, id) {
  assertUser(actor);
  const userId = userObjectId(id);
  if (id !== actor.id && !isAdminActor(actor)) throw new HttpError(403, "Acceso denegado");

  const user = await (await getDb())
    .collection("users")
    .findOne({ _id: userId }, { projection: PUBLIC_USER_PROJECTION });
  if (!user) throw new HttpError(404, "Usuario no encontrado");
  return user;
}

/** Edits the own profile (self-service only). Returns the saved fields. */
export async function updateOwnProfile(actor, id, input) {
  assertUser(actor);
  const userId = userObjectId(id);
  if (id !== actor.id) throw new HttpError(403, "Acceso denegado");

  // strict(): only the editable profile fields are accepted
  const changes = parseOrThrow(EditAccountFormSchema.strict(), input);
  await (await getDb())
    .collection("users")
    .updateOne({ _id: userId }, { $set: addTimestampToUpdate(changes) });
  return changes;
}
