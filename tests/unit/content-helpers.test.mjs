import { describe, expect, it } from "vitest";
import { LOW_SEATS_THRESHOLD, getSeatsInfo } from "@/utils/seats";
import { formatAmount, formatPrice } from "@/utils/price";
import { getDateParts } from "@/utils/dates";

describe("getSeatsInfo", () => {
  it.each([
    [0, null],
    [5, undefined],
    [5, 0],
  ])("taken %s / max %s → unlimited", (taken, max) => {
    expect(getSeatsInfo(taken, max)).toEqual({
      unlimited: true,
      full: false,
      low: false,
      remaining: null,
      percentage: null,
      label: "Cupo ilimitado",
    });
  });

  it("full, including over capacity", () => {
    for (const taken of [2, 3]) {
      const info = getSeatsInfo(taken, 2);
      expect(info).toMatchObject({ unlimited: false, full: true, remaining: 0, percentage: 100 });
      expect(info.label).toBe("Cupo completo");
    }
  });

  it("a single seat left uses the singular", () => {
    expect(getSeatsInfo(4, 5)).toMatchObject({
      full: false,
      low: true,
      remaining: 1,
      percentage: 80,
      label: "Último lugar",
    });
  });

  it("low seats up to the threshold", () => {
    expect(LOW_SEATS_THRESHOLD).toBe(3);
    expect(getSeatsInfo(3, 5)).toMatchObject({ low: true, remaining: 2, label: "Últimos 2 lugares" });
    expect(getSeatsInfo(7, 10)).toMatchObject({ low: true, remaining: 3, label: "Últimos 3 lugares" });
  });

  it("plenty of seats", () => {
    expect(getSeatsInfo(6, 10)).toEqual({
      unlimited: false,
      full: false,
      low: false,
      remaining: 4,
      percentage: 60,
      label: "Quedan 4 lugares",
    });
  });

  it.each([undefined, null, -2, Number.NaN])("taken %s counts as 0", (taken) => {
    expect(getSeatsInfo(taken, 10)).toMatchObject({
      remaining: 10,
      percentage: 0,
      low: false,
      label: "Quedan 10 lugares",
    });
  });
});

describe("formatPrice", () => {
  it("formatAmount shows any amount in ARS, including 0 (revenue is a figure, not 'Gratis')", () => {
    expect(formatAmount(1625000)).toBe("ARS 1.625.000");
    expect(formatAmount(0)).toBe("ARS 0");
    expect(formatAmount(undefined)).toBe("ARS 0");
  });

  it("formats positive amounts with es-AR thousands separators", () => {
    expect(formatPrice(25000)).toBe("ARS 25.000");
    expect(formatPrice(1500)).toBe("ARS 1.500");
    expect(formatPrice(999)).toBe("ARS 999");
  });

  it.each([0, null, undefined])("%s → Gratis", (value) => {
    expect(formatPrice(value)).toBe("Gratis");
  });
});

describe("getDateParts", () => {
  it("uses the Argentina calendar day (UTC-3)", () => {
    expect(getDateParts("2026-09-30T02:00:00Z")).toEqual({ weekday: "mar", day: "29", month: "sep" });
  });

  it("does not zero-pad the day", () => {
    expect(getDateParts("2026-01-05T15:00:00Z")).toEqual({ weekday: "lun", day: "5", month: "ene" });
  });

  it.each([null, "x"])("%s → null", (value) => {
    expect(getDateParts(value)).toBeNull();
  });
});
