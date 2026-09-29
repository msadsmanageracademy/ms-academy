import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HttpError,
  handleApiError,
  isAdmin,
  requireAdmin,
  requireSession,
  resolveTargetUserId,
} from "@/lib/api/guards";

const session = (role, id = "u1") => ({ user: { id, role } });

afterEach(() => {
  globalThis.__testSession = null;
});

describe("requireSession / requireAdmin", () => {
  it("no session → 401", async () => {
    await expect(requireSession()).rejects.toMatchObject({ status: 401 });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
  });

  it("user → requireSession ok, requireAdmin 403", async () => {
    globalThis.__testSession = session("user");
    await expect(requireSession()).resolves.toMatchObject({ user: { id: "u1" } });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });

  it("admin → ok", async () => {
    globalThis.__testSession = session("admin");
    await expect(requireAdmin()).resolves.toMatchObject({ user: { role: "admin" } });
  });

  it("a session without an id is not authenticated", async () => {
    globalThis.__testSession = { user: { role: "admin" } };
    await expect(requireSession()).rejects.toMatchObject({ status: 401 });
  });
});

describe("resolveTargetUserId", () => {
  it("no userId or own userId → session user", () => {
    expect(resolveTargetUserId(session("user"), undefined)).toBe("u1");
    expect(resolveTargetUserId(session("user"), "u1")).toBe("u1");
  });

  it("a user cannot act on someone else", () => {
    expect(() => resolveTargetUserId(session("user"), "u2")).toThrow(HttpError);
  });

  it("an admin can", () => {
    expect(resolveTargetUserId(session("admin"), "u2")).toBe("u2");
  });
});

describe("isAdmin", () => {
  it.each([
    [session("admin"), true],
    [session("user"), false],
    [null, false],
  ])("%j → %s", (s, expected) => expect(isAdmin(s)).toBe(expected));
});

describe("handleApiError", () => {
  it("HttpError exposes its status and message", async () => {
    const res = handleApiError(new HttpError(404, "No encontrado"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, message: "No encontrado" });
  });

  it("any other error → generic 500 without leaking the message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = handleApiError(new Error("mongo: secret connection string"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret connection");
    spy.mockRestore();
  });
});
