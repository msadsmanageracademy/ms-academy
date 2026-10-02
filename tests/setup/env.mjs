// Runs before each test file: test env vars + Auth.js mock.
import { randomBytes } from "crypto";
import { inject, vi } from "vitest";

process.env.MONGODB_URI = inject("mongoUri");
// Isolated database per test file
process.env.MONGODB_DB_NAME = `test_${randomBytes(6).toString("hex")}`;
process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.AUTH_URL = "http://localhost:3000";
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";

// Server Actions revalidate pages; outside a Next.js request that would throw
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Auth.js is replaced by a controllable session (see tests/helpers.mjs → setSession)
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => globalThis.__testSession ?? null),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
