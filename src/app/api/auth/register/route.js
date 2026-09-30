import { registerUser } from "@/server/users/service";
import { getClientIp, hitRateLimit, tooManyRequests } from "@/lib/rateLimit";
import { handleApiError, ok, readJson } from "@/lib/api/guards";

const REGISTER_LIMIT = { scope: "register-ip", limit: 5, windowSec: 60 * 60 };

// POST /api/auth/register — creates an account with the "user" role
export async function POST(req) {
  try {
    const { allowed, retryAfterSec } = await hitRateLimit({
      ...REGISTER_LIMIT,
      key: getClientIp(req.headers),
    });
    if (!allowed) return tooManyRequests(retryAfterSec);

    const data = await registerUser(await readJson(req));
    return ok({ message: "Usuario registrado con éxito", data }, 201);
  } catch (error) {
    return handleApiError(error, "Error registering user");
  }
}
