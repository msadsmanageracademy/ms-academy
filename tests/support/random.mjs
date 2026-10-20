// Seeded pseudo-random generators for property-based tests (no extra dependencies).
// A generator is a function `(rng) => value`; `forAll` runs a check over many values
// and, on failure, reports the seed, the run and the failing case so it can be replayed:
//   PROPERTY_SEED=1234 npx vitest run tests/unit/course-editions.test.mjs
import { ObjectId } from "mongodb";

export const DEFAULT_SEED = Number(process.env.PROPERTY_SEED) || 20260210;
const DAY = 86400000;

/** mulberry32: small, fast, seedable PRNG returning floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Primitive generators ----------

export const gen = {
  constant: (value) => () => value,
  /** Integer in [min, max]. */
  int: (min, max) => (rng) => min + Math.floor(rng() * (max - min + 1)),
  /** Float in [min, max). */
  float: (min, max) => (rng) => min + rng() * (max - min),
  bool: (probability = 0.5) => (rng) => rng() < probability,
  pick: (values) => (rng) => values[Math.floor(rng() * values.length)],
  /** One of the given generators. */
  oneOf: (...generators) => (rng) => generators[Math.floor(rng() * generators.length)](rng),
  /** Array of `item` values with a length in [min, max]. */
  array:
    (item, { min = 0, max = 8 } = {}) =>
    (rng) =>
      Array.from({ length: gen.int(min, max)(rng) }, () => item(rng)),
  /** Object whose values come from the given generators. */
  record: (shape) => (rng) =>
    Object.fromEntries(Object.entries(shape).map(([key, generator]) => [key, generator(rng)])),
  map: (generator, fn) => (rng) => fn(generator(rng), rng),
  /** Deterministic ObjectId built from the PRNG. */
  objectId: () => (rng) =>
    new ObjectId(Array.from({ length: 24 }, () => Math.floor(rng() * 16).toString(16)).join("")),
  string: ({ min = 0, max = 12, alphabet = "abcdefghijklmnopqrstuvwxyz " } = {}) => (rng) =>
    Array.from({ length: gen.int(min, max)(rng) }, () => alphabet[Math.floor(rng() * alphabet.length)]).join(""),
};

// ---------- Dates ----------

/** Date within ±`days` days of `now` (minute precision). */
export const dateAround = (now, days = 120) => (rng) =>
  new Date(Math.round((now.getTime() + (rng() * 2 - 1) * days * DAY) / 60000) * 60000);

/** Valid dates, ISO strings, and missing or invalid values (for label/format helpers). */
export const anyDate = (now) =>
  gen.oneOf(
    dateAround(now, 800),
    gen.map(dateAround(now, 800), (d) => d.toISOString()),
    gen.constant(null),
    gen.constant(undefined),
    gen.constant("not a date"),
    gen.constant(new Date(Number.NaN)),
  );

// ---------- Domain generators ----------

export const TIME_STATUSES = ["upcoming", "in-progress", "completed"];

/**
 * Edition as returned by the edition queries: stored fields plus the derived
 * start/end dates (null when it has no dated classes) and enrollment counts.
 * `timeStatus` is not set: apply `withTimeStatus` (it depends on the clock).
 */
export const editionGen = ({ now = new Date() } = {}) =>
  gen.map(
    gen.record({
      _id: gen.objectId(),
      courseId: gen.objectId(),
      price: gen.pick([0, 1000, 2500, 15000, 49990]),
      max_participants: gen.oneOf(gen.constant(null), gen.int(1, 40)),
      status: gen.pick(["draft", "published"]),
      start_date: gen.oneOf(dateAround(now), dateAround(now), gen.constant(null)),
      lengthDays: gen.int(0, 60),
      enrollmentCount: gen.int(0, 40),
      paidRatio: gen.float(0, 1),
      createdAt: dateAround(now, 400),
    }),
    ({ lengthDays, paidRatio, ...edition }) => ({
      ...edition,
      end_date: edition.start_date ? new Date(edition.start_date.getTime() + lengthDays * DAY + 3600000) : null,
      paidCount: Math.floor(edition.enrollmentCount * paidRatio),
    }),
  );

const RESTRICTED_VALUES = {
  googleEventId: gen.string({ min: 5, max: 10 }),
  googleEventUrl: gen.constant("https://calendar.google.com/event?eid=abc"),
  googleMeetLink: gen.constant("https://meet.google.com/abc-defg-hij"),
  calendarEventLink: gen.constant("https://calendar.google.com/x"),
  recording_url: gen.constant("https://example.test/recording"),
  resources: gen.constant([{ title: "Slides", url: "https://example.test/slides" }]),
};

/** Class document: random dates (or none) and optional participants / restricted fields. */
export const classGen = ({ now = new Date() } = {}) =>
  gen.map(
    gen.record({
      _id: gen.objectId(),
      title: gen.string({ min: 3, max: 20 }),
      short_description: gen.string({ min: 10, max: 40 }),
      duration: gen.pick([30, 45, 60, 90, 120]),
      price: gen.pick([0, 500]),
      max_participants: gen.oneOf(gen.constant(null), gen.int(1, 30)),
      status: gen.pick(["draft", "published", "enrolled"]),
      start_date: gen.oneOf(dateAround(now), dateAround(now), gen.constant(null)),
      participants: gen.array(gen.objectId(), { max: 3 }),
      editionId: gen.objectId(),
      createdBy: gen.objectId(),
      createdAt: dateAround(now, 400),
      updatedAt: dateAround(now, 400),
      restricted: gen.array(gen.pick(Object.keys(RESTRICTED_VALUES)), { max: 6 }),
    }),
    ({ restricted, ...cls }, rng) => ({
      ...cls,
      ...Object.fromEntries(restricted.map((field) => [field, RESTRICTED_VALUES[field](rng)])),
    }),
  );

/** Stored review: author names include empty, blank and email-looking ones. */
export const reviewGen = ({ now = new Date() } = {}) =>
  gen.record({
    _id: gen.objectId(),
    userId: gen.objectId(),
    rating: gen.int(1, 5),
    comment: gen.oneOf(gen.constant(undefined), gen.string({ min: 1, max: 60 })),
    firstName: gen.pick([undefined, "", "   ", "Ana", " Juan ", "ana@example.test", "María José"]),
    createdAt: dateAround(now, 400),
  });

// ---------- Runner ----------

/**
 * Runs `check(value, { rng, run })` for `runs` generated values (sync or async check).
 * Throws on the first failure with the seed, run number and the failing case.
 */
export async function forAll(generator, check, { runs = 100, seed = DEFAULT_SEED } = {}) {
  const rng = mulberry32(seed);
  for (let run = 0; run < runs; run++) {
    const value = generator(rng);
    try {
      await check(value, { rng, run });
    } catch (error) {
      const failure = new Error(
        `Property failed on run ${run + 1}/${runs} (seed ${seed}): ${error.message}\nCase: ${formatCase(value)}`,
      );
      failure.cause = error;
      throw failure;
    }
  }
}

function formatCase(value) {
  try {
    return JSON.stringify(value, (_key, v) => (v === undefined ? "<undefined>" : v), 2);
  } catch {
    return String(value);
  }
}
