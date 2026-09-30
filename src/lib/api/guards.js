import { HttpError } from "@/server/errors";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";

export { HttpError };

/** Returns the session or throws 401. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "No autenticado");
  return session;
}

/** Returns the session if the user is an admin; otherwise throws 401/403. */
export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "admin") {
    throw new HttpError(403, "Acceso denegado");
  }
  return session;
}

export const isAdmin = (session) => session?.user?.role === "admin";

/** The logged-in user (`session.user`) or null. Services do the authorization. */
export async function getActor() {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}

/**
 * Resolves which user the request acts on.
 * - No requested userId (or the session's own) → the current user.
 * - Another userId → only allowed for admins.
 */
export function resolveTargetUserId(session, requestedUserId) {
  if (!requestedUserId || requestedUserId === session.user.id) {
    return session.user.id;
  }
  if (isAdmin(session)) return requestedUserId;
  throw new HttpError(403, "Acceso denegado");
}

/** Reads the JSON body. An empty body is `{}`; malformed JSON throws 400. */
export async function readJson(req) {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "El cuerpo de la solicitud no es JSON válido");
  }
}

/** Success response: `{ success: true, ...payload }`. */
export function ok(payload = {}, status = 200) {
  return Response.json({ success: true, ...payload }, { status });
}

/**
 * Turns any error into a safe JSON response.
 * HttpErrors expose their message (and validation details); anything else is logged
 * and returns a generic 500 (`error.message` is never leaked to the client).
 */
export function handleApiError(error, context = "API error") {
  if (error instanceof HttpError) {
    return Response.json(
      {
        success: false,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
      { status: error.status },
    );
  }
  logger.error(context, error);
  return Response.json(
    { success: false, message: "Error en el servidor" },
    { status: 500 },
  );
}
