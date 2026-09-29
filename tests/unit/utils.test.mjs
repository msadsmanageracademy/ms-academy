import { afterEach, describe, expect, it, vi } from "vitest";
import { getClassStatus, getCourseProgress, getCourseTimeStatus } from "@/utils/classStatus";
import { escapeCsvValue, safeFilename, toCsv } from "@/utils/csv";
import {
  formatDate,
  formatDateAtTime,
  formatLongDateAtTime,
  formatTime,
  formatWeekdayDateTime,
} from "@/utils/dates";
import { decryptJSON, encryptJSON } from "@/lib/crypto";

describe("classStatus", () => {
  const NOW = new Date("2026-06-15T15:00:00Z");
  afterEach(() => vi.useRealTimers());
  const at = (iso) => new Date(iso);

  it("getClassStatus: draft or no date → null", () => {
    expect(getClassStatus(NOW, 60, "draft")).toBeNull();
    expect(getClassStatus(null, 60, "published")).toBeNull();
  });

  it("getClassStatus: upcoming, ongoing and completed", () => {
    vi.useFakeTimers({ now: NOW });
    expect(getClassStatus(at("2026-06-15T16:00:00Z"), 60)).toBe("upcoming");
    expect(getClassStatus(at("2026-06-15T14:30:00Z"), 60)).toBe("ongoing");
    expect(getClassStatus(at("2026-06-15T13:00:00Z"), 60)).toBe("completed");
  });

  it("getCourseProgress computes status and percentage", () => {
    vi.useFakeTimers({ now: NOW });
    expect(getCourseProgress([])).toMatchObject({ status: "upcoming", percentage: 0 });
    const classes = [
      { start_date: at("2026-06-01T10:00:00Z"), duration: 60 },
      { start_date: at("2026-06-30T10:00:00Z"), duration: 60 },
    ];
    expect(getCourseProgress(classes)).toEqual({
      status: "in-progress",
      completedCount: 1,
      totalCount: 2,
      percentage: 50,
    });
  });

  it("getCourseTimeStatus", () => {
    vi.useFakeTimers({ now: NOW });
    expect(getCourseTimeStatus(at("2026-07-01"), at("2026-07-30"), "published")).toBe("upcoming");
    expect(getCourseTimeStatus(at("2026-06-01"), at("2026-06-30"), "published")).toBe("in-progress");
    expect(getCourseTimeStatus(at("2026-05-01"), at("2026-05-30"), "published")).toBe("completed");
    expect(getCourseTimeStatus(at("2026-05-01"), null, "draft")).toBeNull();
  });
});

describe("csv", () => {
  it("escapes quotes and wraps every value", () => {
    expect(escapeCsvValue('Juan "el grande", Pérez')).toBe('"Juan ""el grande"", Pérez"');
    expect(escapeCsvValue(null)).toBe('""');
  });

  it.each(["=HYPERLINK(\"x\")", "+1", "-1+2", "@SUM(A1)"])(
    "neutralizes formulas: %s",
    (value) => expect(escapeCsvValue(value).startsWith(`"'`)).toBe(true),
  );

  it("toCsv joins rows with CRLF", () => {
    expect(toCsv(["a", "b"], [["1", "2"]])).toBe('"a","b"\r\n"1","2"');
  });

  it("safeFilename strips accents and odd characters", () => {
    expect(safeFilename("Clase de Publicidad: ¿Qué? #1")).toBe("Clase_de_Publicidad_Que_1");
  });
});

describe("dates (always in Argentina time, UTC-3)", () => {
  const d = "2026-09-30T21:30:00.000Z";
  it("formats in America/Argentina/Buenos_Aires regardless of the process time zone", () => {
    expect(formatDate(d)).toBe("30/09/2026");
    expect(formatTime(d)).toBe("18:30");
    expect(formatDateAtTime(d)).toBe("30/09/2026 a las 18:30");
    expect(formatWeekdayDateTime(d)).toBe("miércoles, 30/09/2026, 18:30");
    expect(formatLongDateAtTime(d)).toBe("miércoles 30 de septiembre de 2026 a las 18:30");
  });

  it("day boundary: 01:00 UTC is the previous day in Argentina", () => {
    expect(formatDate("2026-10-01T01:00:00Z")).toBe("30/09/2026");
  });

  it("invalid values → —", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatTime("not-a-date")).toBe("—");
  });
});

describe("crypto", () => {
  it("encrypts and decrypts (round trip)", () => {
    const value = { access_token: "abc", refresh_token: "def", expiry_date: 123 };
    const enc = encryptJSON(value);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(enc).not.toContain("abc");
    expect(decryptJSON(enc)).toEqual(value);
  });

  it("each encryption uses a different IV", () => {
    expect(encryptJSON({ a: 1 })).not.toBe(encryptJSON({ a: 1 }));
  });

  it("detects tampered data", () => {
    const [v, iv, tag, ct] = encryptJSON({ a: 1 }).split(":");
    const tampered = [v, iv, tag, Buffer.from("something else").toString("base64")].join(":");
    expect(() => decryptJSON(tampered)).toThrow();
    expect(() => decryptJSON("garbage")).toThrow();
    expect(ct).toBeTruthy();
  });
});
