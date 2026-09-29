import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/classes/route";
import { callRoute, createClass, resetDb } from "./helpers.mjs";

describe("test setup", () => {
  let db;
  beforeEach(async () => {
    db = await resetDb();
  });

  it("connects to in-memory Mongo and calls a route handler", async () => {
    await createClass(db);
    const res = await callRoute(GET, { path: "/api/classes" });
    expect(res.status).toBe(200);
    expect(res.json.data).toHaveLength(1);
  });
});
