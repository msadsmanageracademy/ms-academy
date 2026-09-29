import { auth } from "@/lib/auth";

/**
 * Error with an HTTP status. Handlers throw it and `handleApiError` turns it into
 * a JSON response with that status. The message is user-facing (Spanish).
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

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

/**
 * Turns any error into a safe JSON response.
 * HttpErrors expose their message; anything else is logged and returns a generic 500
 * (`error.message` is never leaked to the client).
 */
export function handleApiError(error, context = "API error") {
  if (error instanceof HttpError) {
    return Response.json(
      { success: false, message: error.message },
      { status: error.status },
    );
  }
  console.error(`${context}:`, error);
  return Response.json(
    { success: false, message: "Error en el servidor" },
    { status: 500 },
  );
}
