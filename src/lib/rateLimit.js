import { createHash } from "crypto";
import clientPromise from "@/lib/db";

// Fixed-window rate limiter backed by MongoDB.
// Each (scope, key, window) is one document in `rateLimits`; a TTL index removes
// expired windows automatically. Keys are hashed so no emails/IPs are stored in clear.

const COLLECTION = "rateLimits";
let indexReady;

async function getCollection() {
  const client = await clientPromise;
  const collection = client.db(process.env.MONGODB_DB_NAME).collection(COLLECTION);
  indexReady ??= collection
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    .catch((error) => {
      indexReady = undefined; // retry on next call
      console.error("Rate limit: no se pudo crear el índice TTL:", error.message);
    });
  await indexReady;
  return collection;
}

function windowDoc(scope, key, windowSec) {
  const windowMs = windowSec * 1000;
  const windowIndex = Math.floor(Date.now() / windowMs);
  const hashed = createHash("sha256").update(String(key)).digest("hex").slice(0, 32);
  return {
    _id: `${scope}:${hashed}:${windowIndex}`,
    expiresAt: new Date((windowIndex + 1) * windowMs),
  };
}

/** Current count for the window, without incrementing. */
export async function peekRateLimit({ scope, key, windowSec }) {
  try {
    const collection = await getCollection();
    const { _id } = windowDoc(scope, key, windowSec);
    const doc = await collection.findOne({ _id }, { projection: { count: 1 } });
    return doc?.count ?? 0;
  } catch (error) {
    console.error("Rate limit (peek) falló, se permite el request:", error.message);
    return 0; // fail open: the limiter must never lock everyone out
  }
}

/** Increments the counter and returns whether the request is within the limit. */
export async function hitRateLimit({ scope, key, limit, windowSec }) {
  const { _id, expiresAt } = windowDoc(scope, key, windowSec);
  try {
    const collection = await getCollection();
    const update = async () => {
      const result = await collection.findOneAndUpdate(
        { _id },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
        // includeResultMetadata:false → returns the document in driver v5 and v6
        { upsert: true, returnDocument: "after", includeResultMetadata: false },
      );
      // Defensive: older drivers may still wrap the document in { value, ok }
      return result && "ok" in result && "value" in result ? result.value : result;
    };
    let doc;
    try {
      doc = await update();
    } catch (error) {
      if (error?.code !== 11000) throw error;
      doc = await update(); // concurrent upsert race: retry once
    }
    const count = doc?.count ?? 1;
    return {
      allowed: count <= limit,
      retryAfterSec: Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000)),
    };
  } catch (error) {
    console.error("Rate limit (hit) falló, se permite el request:", error.message);
    return { allowed: true, retryAfterSec: 0 };
  }
}

/** Clears a counter (e.g. after a successful login). */
export async function resetRateLimit({ scope, key, windowSec }) {
  try {
    const collection = await getCollection();
    await collection.deleteOne({ _id: windowDoc(scope, key, windowSec)._id });
  } catch (error) {
    console.error("Rate limit (reset) falló:", error.message);
  }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(headers) {
  const get = (name) =>
    typeof headers?.get === "function" ? headers.get(name) : headers?.[name];
  const forwarded = get("x-forwarded-for");
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return get("x-real-ip") || "unknown";
}

/** Standard 429 response. */
export function tooManyRequests(retryAfterSec, message) {
  return Response.json(
    {
      success: false,
      message: message || "Demasiados intentos. Probá de nuevo en unos minutos.",
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}
