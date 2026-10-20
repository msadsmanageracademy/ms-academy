// Edition labels and the admin-only edition number (src/utils/courseEditions.js,
// formatMonthYearLong in src/utils/dates.js). Properties use the seeded PRNG.
import { describe, expect, it } from "vitest";
import { formatMonthYearLong } from "@/utils/dates";
import {
  NO_DATE_LABEL,
  adminEditionNumber,
  editionName,
  labelEditions,
  withEditionLabels,
} from "@/utils/courseEditions";
import { dateAround, forAll, gen } from "../support/random.mjs";

const NOW = new Date("2026-06-15T15:00:00Z");
const time = (date) => (date ? new Date(date).getTime() : Number.NaN);
const labelsOf = (editions) => {
  const labels = labelEditions(editions);
  return editions.map((e) => labels.get(String(e._id)));
};

describe("formatMonthYearLong", () => {
  it("is the capitalized Spanish month and year", () => {
    expect(formatMonthYearLong("2026-09-10T22:00:00Z")).toBe("Septiembre 2026");
    expect(formatMonthYearLong(new Date("2027-01-20T15:00:00Z"))).toBe("Enero 2027");
  });

  it("reads the month in Argentina time", () => {
    // 02:30 UTC on Oct 1st is 23:30 on Sep 30th in Argentina
    expect(formatMonthYearLong("2026-10-01T02:30:00Z")).toBe("Septiembre 2026");
    expect(formatMonthYearLong("2026-10-01T03:00:00Z")).toBe("Octubre 2026");
  });

  it("is null without a valid date", () => {
    for (const value of [null, undefined, "not a date", new Date(Number.NaN)]) {
      expect(formatMonthYearLong(value)).toBeNull();
    }
  });
});

describe("labelEditions", () => {
  it("labels by the month of the first class, earliest without suffix", () => {
    const editions = [
      { _id: "c", start_date: "2026-09-20T22:00:00Z", createdAt: "2026-01-01T00:00:00Z" },
      { _id: "a", start_date: "2026-09-02T22:00:00Z", createdAt: "2026-03-01T00:00:00Z" },
      // Same start as "a", created earlier: goes before it
      { _id: "b", start_date: "2026-09-02T22:00:00Z", createdAt: "2026-02-01T00:00:00Z" },
    ];
    expect(labelsOf(editions)).toEqual([
      { label: "Septiembre 2026 (3)", adminNumber: 3 },
      { label: "Septiembre 2026 (2)", adminNumber: 2 },
      { label: "Septiembre 2026", adminNumber: 1 },
    ]);
  });

  it("breaks full ties by id", () => {
    const same = { start_date: "2026-09-02T22:00:00Z", createdAt: "2026-02-01T00:00:00Z" };
    expect(labelsOf([{ _id: "y", ...same }, { _id: "x", ...same }])).toEqual([
      { label: "Septiembre 2026 (2)", adminNumber: 2 },
      { label: "Septiembre 2026", adminNumber: 1 },
    ]);
  });

  it("labels undated editions 'Sin fecha' and numbers them last, by creation", () => {
    const editions = [
      { _id: "late-draft", start_date: null, createdAt: "2026-05-01T00:00:00Z" },
      { _id: "oct", start_date: "2026-10-05T22:00:00Z", createdAt: "2026-04-01T00:00:00Z" },
      { _id: "early-draft", createdAt: "2026-01-01T00:00:00Z" },
      { _id: "jul", start_date: new Date("2026-07-05T22:00:00Z"), createdAt: "2026-06-01T00:00:00Z" },
    ];
    expect(labelsOf(editions)).toEqual([
      { label: `${NO_DATE_LABEL} (2)`, adminNumber: 4 },
      { label: "Octubre 2026", adminNumber: 2 },
      { label: "Sin fecha", adminNumber: 3 },
      { label: "Julio 2026", adminNumber: 1 },
    ]);
  });

  it("treats ISO strings (after toPlain) like dates", () => {
    const asDate = [
      { _id: "1", start_date: new Date("2026-08-01T22:00:00Z"), createdAt: new Date("2026-01-01T00:00:00Z") },
      { _id: "2", start_date: new Date("2026-07-01T22:00:00Z"), createdAt: new Date("2026-02-01T00:00:00Z") },
    ];
    const asString = asDate.map((e) => ({
      ...e,
      start_date: e.start_date.toISOString(),
      createdAt: e.createdAt.toISOString(),
    }));
    expect(labelsOf(asString)).toEqual(labelsOf(asDate));
    expect(labelsOf(asDate).map((l) => l.adminNumber)).toEqual([2, 1]);
  });

  it("puts the edition whose first class is 23:30 on the last day of a month in that month", () => {
    const editions = [
      { _id: "edge", start_date: "2026-10-01T02:30:00Z", createdAt: "2026-01-01T00:00:00Z" },
      { _id: "sep", start_date: "2026-09-10T22:00:00Z", createdAt: "2026-01-02T00:00:00Z" },
    ];
    expect(labelsOf(editions)).toEqual([
      { label: "Septiembre 2026 (2)", adminNumber: 2 },
      { label: "Septiembre 2026", adminNumber: 1 },
    ]);
  });
});

describe("withEditionLabels / editionName / adminEditionNumber", () => {
  it("labels each course independently and orders by course, then chronologically", () => {
    const result = withEditionLabels([
      { _id: "a2", courseId: "A", start_date: "2026-09-20T22:00:00Z" },
      { _id: "b1", courseId: "B", start_date: "2026-09-10T22:00:00Z" },
      { _id: "a1", courseId: "A", start_date: "2026-09-02T22:00:00Z" },
    ]);
    expect(result.map((e) => [e._id, e.label, e.adminNumber])).toEqual([
      ["a1", "Septiembre 2026", 1],
      ["a2", "Septiembre 2026 (2)", 2],
      ["b1", "Septiembre 2026", 1],
    ]);
  });

  it("names and numbers editions", () => {
    expect(editionName("Meta Ads", "Septiembre 2026")).toBe("Meta Ads · Septiembre 2026");
    expect(adminEditionNumber(2, 3)).toBe("Edición 2 de 3");
  });
});

// ---------- Properties ----------

const courseEditionsGen = gen.array(
  gen.record({
    _id: gen.objectId(),
    start_date: gen.oneOf(dateAround(NOW), gen.constant(null)),
    createdAt: dateAround(NOW, 400),
  }),
  { max: 10 },
);

// Reference order: dated first by start, then creation, then id
const referenceOrder = (editions) =>
  [...editions].sort((a, b) => {
    const ta = Number.isNaN(time(a.start_date)) ? Infinity : time(a.start_date);
    const tb = Number.isNaN(time(b.start_date)) ? Infinity : time(b.start_date);
    if (ta !== tb) return ta < tb ? -1 : 1;
    if (time(a.createdAt) !== time(b.createdAt)) return time(a.createdAt) - time(b.createdAt);
    return String(a._id) < String(b._id) ? -1 : 1;
  });

describe("edition label properties", () => {
  it("Feature: course-editions, Property 2: Etiqueta de edición (por fecha)", async () => {
    await forAll(courseEditionsGen, (editions) => {
      const labels = labelEditions(editions);
      const values = editions.map((e) => labels.get(String(e._id)).label);
      expect(new Set(values).size).toBe(editions.length);
      for (const edition of editions) {
        const { label } = labels.get(String(edition._id));
        expect(label).toMatch(/^([A-ZÁÉÍÓÚ][a-záéíóú]+ \d{4}|Sin fecha)( \(\d+\))?$/);
        expect(label).not.toContain("Edición");
        const base = label.replace(/ \(\d+\)$/, "");
        expect(base).toBe(formatMonthYearLong(edition.start_date) ?? NO_DATE_LABEL);
      }
      // Within a month, suffixes follow the chronological order: bare, (2), (3)...
      const counts = new Map();
      for (const edition of referenceOrder(editions)) {
        const base = formatMonthYearLong(edition.start_date) ?? NO_DATE_LABEL;
        const k = (counts.get(base) ?? 0) + 1;
        counts.set(base, k);
        expect(labels.get(String(edition._id)).label).toBe(k === 1 ? base : `${base} (${k})`);
      }
    });
  });

  it("Feature: course-editions, Property 4: Número de edición para admins (calculado)", async () => {
    await forAll(courseEditionsGen, (editions) => {
      const labels = labelEditions(editions);
      const numbers = editions.map((e) => labels.get(String(e._id)).adminNumber);
      expect([...numbers].sort((a, b) => a - b)).toEqual(editions.map((_, i) => i + 1));
      referenceOrder(editions).forEach((edition, index) => {
        expect(labels.get(String(edition._id)).adminNumber).toBe(index + 1);
      });
    });
  });
});
