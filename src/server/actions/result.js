import { HttpError } from "@/server/errors";
import { logger } from "@/lib/logger";
import { toPlain } from "@/server/serialize";

/**
 * Runs a Server Action body and returns the same envelope as the REST API, plus `ok`:
 * { ok: true, success: true, message?, data? } or { ok: false, success: false, message, status }.
 *
 * Errors are returned, never thrown: Next.js hides thrown errors from the client in
 * production, so the user would lose the message. Unexpected errors are logged and
 * answered with a generic message (no internal details).
 */
export async function actionResult(context, body) {
  try {
    const { message, data } = (await body()) ?? {};
    return {
      ok: true,
      success: true,
      ...(message !== undefined ? { message } : {}),
      ...(data !== undefined ? { data: toPlain(data) } : {}),
    };
  } catch (error) {
    if (error instanceof HttpError) {
      return { ok: false, success: false, status: error.status, message: error.message };
    }
    logger.error(context, error);
    return { ok: false, success: false, status: 500, message: "Error en el servidor" };
  }
}
