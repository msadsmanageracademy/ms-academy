// Course edition helpers (src/utils/courseEditions.js): time status, current/open edition,
// metrics, card order and pagination. Labels and the admin number live in
// edition-labels.test.mjs. Properties use the seeded PRNG.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  courseMetrics,
  pageInfo,
  pickCurrentEdition,
  pickOpenEdition,
  sortCourseCards,
  withTimeStatus,
} from "@/utils/courseEditions";
import { TIME_STATUSES, dateAround, editionGen, forAll, gen } from "../support/random.mjs";

const NOW = new Date("2026-06-15T15:00:00Z");

beforeEach(() => vi.useFakeTimers({ now: NOW }));
afterEach(() => vi.useRealTimers());

const time = (date) => new Date(date).getTime();

describe("withTimeStatus", () => {
  it("adds the time status without mutating (and no label)", () => {
    const edition = {
      status: "published",
      start_date: "2026-07-01T22:00:00Z",
      end_date: "2026-07-20T23:00:00Z",
      createdAt: "2026-01-05T12:00:00Z",
    };
    const result = withTimeStatus(edition);
    expect(result).toMatchObject({ timeStatus: "upcoming" });
    expect(result).not.toHaveProperty("label");
    expect(withTimeStatus({ ...edition, status: "draft", start_date: null })).toMatchObject({ timeStatus: null });
    expect(edition).not.toHaveProperty("timeStatus");
  });
});

const editionsGen = gen.map(gen.array(editionGen({ now: NOW }), { max: 8 }), (editions) =>
  editions.map(withTimeStatus),
);

// Reference model: published editions with that time status, earliest start
const earliestStart = (editions, timeStatus) => {
  const candidates = editions.filter((e) => e.status === "published" && e.timeStatus === timeStatus);
  return candidates.length ? Math.min(...candidates.map((e) => time(e.start_date))) : null;
};

function expectPicked(result, editions, preference) {
  for (const timeStatus of preference) {
    const start = earliestStart(editions, timeStatus);
    if (start !== null) {
      expect(editions).toContain(result);
      expect(result).toMatchObject({ status: "published", timeStatus });
      expect(time(result.start_date)).toBe(start);
      return;
    }
  }
  expect(result).toBeNull();
}

describe("pickCurrentEdition / pickOpenEdition", () => {
  it("current prefers in progress; open prefers the next upcoming one; drafts never count", () => {
    const editions = [
      { _id: "past", status: "published", start_date: "2025-03-01", end_date: "2025-04-01" },
      { _id: "later", status: "published", start_date: "2026-12-01", end_date: "2026-12-20" },
      { _id: "soon", status: "published", start_date: "2026-07-01", end_date: "2026-07-20" },
      { _id: "now", status: "published", start_date: "2026-06-01", end_date: "2026-06-30" },
      { _id: "draft", status: "draft", start_date: "2026-06-20", end_date: "2026-06-30" },
    ].map(withTimeStatus);
    expect(pickCurrentEdition(editions)._id).toBe("now");
    expect(pickOpenEdition(editions)._id).toBe("soon");
    expect(pickOpenEdition(editions.filter((e) => e._id !== "soon" && e._id !== "later"))._id).toBe("now");
    expect(pickCurrentEdition([editions[0], editions[4]])).toBeNull();
    expect(pickOpenEdition([])).toBeNull();
  });

  it("Feature: course-editions, Property 3: Selección de edición actual y abierta", async () => {
    await forAll(editionsGen, (editions) => {
      const current = pickCurrentEdition(editions);
      const open = pickOpenEdition(editions);
      expectPicked(current, editions, ["in-progress", "upcoming"]);
      expectPicked(open, editions, ["upcoming", "in-progress"]);
      for (const picked of [current, open].filter(Boolean)) {
        expect(picked.status).not.toBe("draft");
        expect(picked.timeStatus).not.toBe("completed");
      }
    });
  });
});

describe("courseMetrics", () => {
  it("counts revenue per edition, never course price × total", () => {
    const metrics = courseMetrics([
      { price: 1000, status: "published", timeStatus: "completed", enrollmentCount: 3, paidCount: 2 },
      { price: 2000, status: "published", timeStatus: "upcoming", enrollmentCount: 2, paidCount: 1 },
      { price: 5000, status: "draft", timeStatus: null, enrollmentCount: 0, paidCount: 0 },
    ]);
    expect(metrics).toEqual({
      editionCount: 3,
      timesTaught: 1,
      enrolledCount: 5,
      paidCount: 3,
      estimatedRevenue: 4000,
    });
  });

  it("Feature: course-editions, Property 5: Métricas de curso", async () => {
    const metricEditionGen = gen.map(
      gen.record({
        price: gen.int(0, 50000),
        status: gen.pick(["draft", "published"]),
        timeStatus: gen.pick([...TIME_STATUSES, null]),
        enrollmentCount: gen.int(0, 40),
        paidRatio: gen.float(0, 1),
      }),
      ({ paidRatio, ...e }) => ({ ...e, paidCount: Math.floor(e.enrollmentCount * paidRatio) }),
    );
    await forAll(gen.array(metricEditionGen, { max: 10 }), (editions) => {
      const metrics = courseMetrics(editions);
      const sum = (fn) => editions.reduce((total, e) => total + fn(e), 0);
      expect(metrics.editionCount).toBe(editions.length);
      expect(metrics.estimatedRevenue).toBe(sum((e) => e.price * e.paidCount));
      expect(metrics.timesTaught).toBe(
        editions.filter(
          (e) => e.status === "published" && (e.timeStatus === "in-progress" || e.timeStatus === "completed"),
        ).length,
      );
      expect(metrics.enrolledCount).toBe(sum((e) => e.enrollmentCount));
      expect(metrics.paidCount).toBe(sum((e) => e.paidCount));
    });
  });
});

describe("sortCourseCards", () => {
  it("puts courses with a current edition first, then the newest ones", () => {
    const cards = [
      { title: "B viejo", current: null, lastDate: "2024-02-01" },
      { title: "A reciente", current: null, lastDate: "2025-02-01" },
      { title: "Próximo", current: { start_date: "2026-09-01" }, lastDate: "2026-09-01" },
      { title: "En curso", current: { start_date: "2026-06-01" }, lastDate: "2026-06-01" },
      { title: "Borrador", current: null, lastDate: null },
    ];
    expect(sortCourseCards(cards).map((c) => c.title)).toEqual([
      "En curso",
      "Próximo",
      "A reciente",
      "B viejo",
      "Borrador",
    ]);
    expect(cards[0].title).toBe("B viejo");
  });

  it("breaks ties (same start or same latest date) by title", () => {
    const cards = [
      { title: "Ventas", current: null, lastDate: "2025-02-01" },
      { title: "Meta", current: { start_date: "2026-07-01" }, lastDate: "2026-07-01" },
      { title: "Ads", current: null, lastDate: "2025-02-01" },
      { title: "Google", current: { start_date: "2026-07-01" }, lastDate: "2026-07-01" },
      { title: "Zeta", current: null, lastDate: null },
      { title: "Analytics", current: null, lastDate: null },
    ];
    expect(sortCourseCards(cards).map((c) => c.title)).toEqual([
      "Google",
      "Meta",
      "Ads",
      "Ventas",
      "Analytics",
      "Zeta",
    ]);
  });

  it("Feature: course-editions, Property 6: Orden de tarjetas", async () => {
    const cardGen = gen.record({
      title: gen.pick(["Ads", "Meta", "Google", "Ventas", "Analytics"]),
      current: gen.oneOf(gen.constant(null), gen.record({ start_date: dateAround(NOW) })),
      lastDate: gen.oneOf(gen.constant(null), dateAround(NOW, 600)),
    });
    await forAll(gen.array(cardGen, { max: 10 }), (cards) => {
      const sorted = sortCourseCards(cards);
      // A permutation of the input
      expect(sorted).toHaveLength(cards.length);
      expect(cards.every((card) => sorted.includes(card))).toBe(true);

      const withCurrent = sorted.filter((c) => c.current);
      expect(sorted.slice(0, withCurrent.length)).toEqual(withCurrent);
      for (let i = 1; i < withCurrent.length; i++) {
        expect(time(withCurrent[i - 1].current.start_date)).toBeLessThanOrEqual(
          time(withCurrent[i].current.start_date),
        );
      }
      const rest = sorted.slice(withCurrent.length);
      const last = (c) => (c.lastDate ? time(c.lastDate) : 0);
      for (let i = 1; i < rest.length; i++) {
        expect(last(rest[i - 1])).toBeGreaterThanOrEqual(last(rest[i]));
      }
    });
  });
});

describe("pageInfo", () => {
  it("clamps the page and computes the skip", () => {
    expect(pageInfo(0, 1, 10)).toEqual({ page: 1, totalPages: 1, skip: 0 });
    expect(pageInfo(25, 3, 10)).toEqual({ page: 3, totalPages: 3, skip: 20 });
    expect(pageInfo(25, 9, 10)).toEqual({ page: 3, totalPages: 3, skip: 20 });
    expect(pageInfo(25, "abc", 10)).toEqual({ page: 1, totalPages: 3, skip: 0 });
  });

  it("Feature: course-editions, Property 7: Paginación acotada", async () => {
    const pageGen = gen.oneOf(
      gen.int(-50, 0),
      gen.int(1, 120),
      gen.float(-5, 120),
      gen.constant(Number.NaN),
      gen.constant(Number.POSITIVE_INFINITY),
      gen.constant(undefined),
      gen.constant("x"),
      gen.constant(10 ** 9),
    );
    await forAll(
      gen.record({ total: gen.int(0, 1000), pageSize: gen.int(1, 50), page: pageGen }),
      ({ total, pageSize, page }) => {
        const info = pageInfo(total, page, pageSize);
        expect(info.totalPages).toBe(Math.max(1, Math.ceil(total / pageSize)));
        expect(Number.isInteger(info.page)).toBe(true);
        expect(info.page).toBeGreaterThanOrEqual(1);
        expect(info.page).toBeLessThanOrEqual(info.totalPages);
        expect(info.skip).toBe((info.page - 1) * pageSize);
      },
    );
  });
});
