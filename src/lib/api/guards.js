import { auth } from "@/lib/auth";

/**
 * Error con status HTTP. Los handlers lo lanzan y `handleApiError` lo traduce
 * a una respuesta JSON con el status correspondiente.
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Devuelve la sesión o lanza 401. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "No autenticado");
  return session;
}

/** Devuelve la sesión si el usuario es admin; si no, lanza 401/403. */
export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "admin") {
    throw new HttpError(403, "Acceso denegado");
  }
  return session;
}

export const isAdmin = (session) => session?.user?.role === "admin";

/**
 * Resuelve sobre qué usuario actúa el request.
 * - Sin userId solicitado (o igual al de la sesión) → el propio usuario.
 * - Otro userId → solo permitido para admins.
 */
export function resolveTargetUserId(session, requestedUserId) {
  if (!requestedUserId || requestedUserId === session.user.id) {
    return session.user.id;
  }
  if (isAdmin(session)) return requestedUserId;
  throw new HttpError(403, "Acceso denegado");
}

/**
 * Convierte cualquier error en una respuesta JSON segura.
 * Los HttpError exponen su mensaje; el resto se loguea y devuelve un 500 genérico
 * (nunca se filtra `error.message` al cliente).
 */
export function handleApiError(error, context = "Error en la API") {
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
