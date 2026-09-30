import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("logger", () => {
  it("production: one JSON line with the error's name, message and stack only", () => {
    vi.stubEnv("NODE_ENV", "production");
    const sink = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("boom"), { code: 11000, secret: "do-not-log" });

    logger.error("Error saving", error, { classId: "c1" });

    const entry = JSON.parse(sink.mock.calls[0][0]);
    expect(entry).toMatchObject({ level: "error", msg: "Error saving", context: { classId: "c1" } });
    expect(entry.err).toMatchObject({ name: "Error", message: "boom", code: 11000 });
    expect(entry.err).not.toHaveProperty("secret");
    expect(new Date(entry.time).toString()).not.toBe("Invalid Date");
  });

  it("tests only show warnings and errors; LOG_LEVEL overrides the default", () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("hidden");
    expect(info).not.toHaveBeenCalled();

    vi.stubEnv("LOG_LEVEL", "info");
    logger.info("shown", { a: 1 });
    expect(info).toHaveBeenCalledWith("[info] shown", { a: 1 });
  });
});
