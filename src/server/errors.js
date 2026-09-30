import { ObjectId } from "mongodb";

/**
 * Error with an HTTP status. Services and handlers throw it and `handleApiError`
 * turns it into a JSON response. `details` (optional) carries validation issues for the client.
 */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

/** Converts a string id to an ObjectId or throws 400 with the given message. */
export function toObjectId(value, message = "ID inválido") {
  if (value instanceof ObjectId) return value;
  if (typeof value !== "string" || !ObjectId.isValid(value)) {
    throw new HttpError(400, message);
  }
  return new ObjectId(value);
}

/**
 * Validates `data` with a zod schema and returns the parsed value.
 * On failure throws 400 with `message` (or the first issue's message when
 * `useIssueMessage` is set) and the zod issues as `details`.
 */
export function parseOrThrow(schema, data, { message = "El formato de los datos es inválido", useIssueMessage = false } = {}) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.errors;
    throw new HttpError(400, useIssueMessage ? issues[0]?.message || message : message, issues);
  }
  return parsed.data;
}

export const isAdminActor = (actor) => actor?.role === "admin";

/** Throws 401 unless there is a logged-in user. */
export function assertUser(actor) {
  if (!actor?.id) throw new HttpError(401, "No autenticado");
  return actor;
}

/** Throws 401/403 unless the actor is an admin. */
export function assertAdmin(actor) {
  assertUser(actor);
  if (!isAdminActor(actor)) throw new HttpError(403, "Acceso denegado");
  return actor;
}
