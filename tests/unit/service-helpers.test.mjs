// Helpers shared by the service layer and the thin REST routes.
import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";
import { HttpError, assertAdmin, assertUser, parseOrThrow, toObjectId } from "@/server/errors";

const jsonRequest = (body) => new Request("http://localhost/", { method: "POST", body });

describe("toObjectId", () => {
  it("parses valid ids and passes ObjectIds through", () => {
    const id = new ObjectId();
    expect(toObjectId(id.toString()).equals(id)).toBe(true);
    expect(toObjectId(id)).toBe(id);
  });

  it.each([["nope"], [""], [null], [undefined], [123]])("rejects %s with 400", (value) => {
    expect(() => toObjectId(value, "ID de clase inválido")).toThrow(
      expect.objectContaining({ status: 400, message: "ID de clase inválido" }),
    );
  });
});

describe("parseOrThrow", () => {
  const schema = z.object({ status: z.enum(["draft", "published"], { message: "Estado inválido" }) });

  it("returns the parsed data", () => {
    expect(parseOrThrow(schema, { status: "draft", extra: 1 })).toEqual({ status: "draft" });
  });

  it("throws 400 with details; optionally with the first issue's message", () => {
    try {
      parseOrThrow(schema, { status: "x" });
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect(error.message).toBe("El formato de los datos es inválido");
      expect(error.details).toHaveLength(1);
    }
    expect(() => parseOrThrow(schema, {}, { useIssueMessage: true })).toThrow("Estado inválido");
  });
});

describe("actor checks", () => {
  it("assertUser / assertAdmin", () => {
    expect(() => assertUser(null)).toThrow(expect.objectContaining({ status: 401 }));
    expect(() => assertAdmin({ id: "u1", role: "user" })).toThrow(expect.objectContaining({ status: 403 }));
    expect(assertAdmin({ id: "a1", role: "admin" })).toMatchObject({ id: "a1" });
  });

  it("getActor returns session.user or null", async () => {
    globalThis.__testSession = null;
    expect(await getActor()).toBeNull();
    globalThis.__testSession = { user: { id: "u1", role: "user" } };
    expect(await getActor()).toEqual({ id: "u1", role: "user" });
    globalThis.__testSession = null;
  });
});

describe("readJson / ok / handleApiError", () => {
  it("reads empty bodies as {} and rejects malformed JSON", async () => {
    expect(await readJson(jsonRequest(""))).toEqual({});
    expect(await readJson(jsonRequest('{"a":1}'))).toEqual({ a: 1 });
    await expect(readJson(jsonRequest("{oops"))).rejects.toMatchObject({ status: 400 });
  });

  it("ok wraps the payload with success: true", async () => {
    const res = ok({ message: "Hecho", data: { a: 1 } }, 201);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, message: "Hecho", data: { a: 1 } });
  });

  it("handleApiError includes validation details only when present", async () => {
    const withDetails = await handleApiError(new HttpError(400, "Inválido", [{ path: ["x"] }])).json();
    expect(withDetails).toEqual({ success: false, message: "Inválido", details: [{ path: ["x"] }] });
    const plain = await handleApiError(new HttpError(404, "No encontrado")).json();
    expect(plain).toEqual({ success: false, message: "No encontrado" });
  });
});
