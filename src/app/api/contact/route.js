import { handleApiError, ok, readJson } from "@/lib/api/guards";
import { sendContactMessage } from "@/server/contact/service";
import { getClientIp, hitRateLimit, tooManyRequests } from "@/lib/rateLimit";

const CONTACT_LIMIT = { scope: "contact-ip", limit: 5, windowSec: 60 * 60 };

// POST /api/contact { name, email, subject, message }
export async function POST(req) {
  try {
    // Anti-spam: limits the emails sent through Resend per IP
    const { allowed, retryAfterSec } = await hitRateLimit({
      ...CONTACT_LIMIT,
      key: getClientIp(req.headers),
    });
    if (!allowed) {
      return tooManyRequests(
        retryAfterSec,
        "Enviaste varios mensajes seguidos. Probá de nuevo más tarde.",
      );
    }

    await sendContactMessage(await readJson(req));
    return ok({ message: "Mensaje enviado" });
  } catch (error) {
    return handleApiError(error, "Error sending contact message");
  }
}
