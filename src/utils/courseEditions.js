// Courses and their editions (every time a course is taught). Pure helpers for
// labelling, picking and measuring editions; no server imports, usable anywhere.
// Editions have no stored number: they are named by the month of their first class
// ("Septiembre 2026") and admins also see their chronological position ("Edición 2 de 3").
import { getCourseTimeStatus } from "@/utils/classStatus";
import { formatMonthYearLong } from "@/utils/dates";

// Dates may be Date objects or ISO strings (after toPlain); NaN when missing/invalid
const time = (date) => (date ? new Date(date).getTime() : Number.NaN);
const timeOr = (date, fallback) => {
  const t = time(date);
  return Number.isNaN(t) ? fallback : t;
};

/** Label of an edition without a dated class (admins only: drafts are never public). */
export const NO_DATE_LABEL = "Sin fecha";

/** Date an edition is sorted by on the admin cards: first class, else creation. */
export const editionDate = (edition) => edition.start_date ?? edition.createdAt;

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Chronological order: dated before undated, by first class, then creation, then id
function compareChronological(a, b) {
  const startA = timeOr(a.start_date, Infinity);
  const startB = timeOr(b.start_date, Infinity);
  return (
    compare(startA, startB) ||
    compare(timeOr(a.createdAt, Infinity), timeOr(b.createdAt, Infinity)) ||
    compare(String(a._id), String(b._id))
  );
}

/**
 * Labels of the editions of ONE course ({ _id, start_date?, createdAt? }, drafts included).
 * → Map<String(_id), { label, adminNumber }>
 * - adminNumber: 1-based position in chronological order (undated editions last).
 * - label: month of the first class ("Septiembre 2026") or "Sin fecha"; editions sharing
 *   it are told apart in the same order: "Septiembre 2026", "Septiembre 2026 (2)", ...
 */
export function labelEditions(editions) {
  const sorted = [...editions].sort(compareChronological);
  const seen = new Map();
  const result = new Map();
  sorted.forEach((edition, index) => {
    const base = formatMonthYearLong(edition.start_date) ?? NO_DATE_LABEL;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    result.set(String(edition._id), {
      label: count === 1 ? base : `${base} (${count})`,
      adminNumber: index + 1,
    });
  });
  return result;
}

/**
 * Copies of the editions (of any courses, grouped by courseId) with their `label` and
 * `adminNumber`, ordered by course (first appearance) and then chronologically.
 */
export function withEditionLabels(editions) {
  const byCourse = new Map();
  for (const edition of editions) {
    const key = String(edition.courseId);
    if (!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key).push(edition);
  }
  return [...byCourse.values()].flatMap((own) => {
    const labels = labelEditions(own);
    return own
      .map((edition) => ({ ...edition, ...labels.get(String(edition._id)) }))
      .sort((a, b) => a.adminNumber - b.adminNumber);
  });
}

/** "Curso X · Septiembre 2026" (titles, notifications, "Mis clases", "Mis cursos"). */
export function editionName(courseTitle, label) {
  return `${courseTitle} · ${label}`;
}

/** "Edición 2 de 3" (admin panel only). */
export function adminEditionNumber(number, total) {
  return `Edición ${number} de ${total}`;
}

/** Copy of an edition with its time status (null for drafts / no dates). */
export function withTimeStatus(edition) {
  return {
    ...edition,
    timeStatus: getCourseTimeStatus(edition.start_date, edition.end_date, edition.status),
  };
}

// Earliest-starting published edition with the given time status, or null
const earliestWith = (editions, timeStatus) =>
  editions
    .filter((e) => e.status !== "draft" && e.timeStatus === timeStatus)
    .sort((a, b) => timeOr(a.start_date, Infinity) - timeOr(b.start_date, Infinity))[0] ?? null;

/** Admin "current" edition: in progress (earliest start), else the next upcoming one, else null. */
export function pickCurrentEdition(editions) {
  return earliestWith(editions, "in-progress") ?? earliestWith(editions, "upcoming");
}

/** Edition open to enrollment: next upcoming published one, else the one in progress, else null. */
export function pickOpenEdition(editions) {
  return earliestWith(editions, "upcoming") ?? earliestWith(editions, "in-progress");
}

/**
 * Course-wide figures from its editions (each with price, status, timeStatus,
 * enrollmentCount and paidCount). Revenue is per edition: price × paid enrollees.
 */
export function courseMetrics(editions) {
  let timesTaught = 0;
  let enrolledCount = 0;
  let paidCount = 0;
  let estimatedRevenue = 0;
  for (const edition of editions) {
    const paid = edition.paidCount ?? 0;
    if (
      edition.status === "published" &&
      (edition.timeStatus === "in-progress" || edition.timeStatus === "completed")
    ) {
      timesTaught++;
    }
    enrolledCount += edition.enrollmentCount ?? 0;
    paidCount += paid;
    estimatedRevenue += (edition.price ?? 0) * paid;
  }
  return { editionCount: editions.length, timesTaught, enrolledCount, paidCount, estimatedRevenue };
}

const byTitle = (a, b) => String(a.title ?? "").localeCompare(String(b.title ?? ""), "es");

// Cards with a current edition first (by its start), then by latest date (newest first)
function compareCards(a, b) {
  if (a.current && b.current) {
    return timeOr(a.current.start_date, Infinity) - timeOr(b.current.start_date, Infinity) || byTitle(a, b);
  }
  if (a.current) return -1;
  if (b.current) return 1;
  return timeOr(b.lastDate, 0) - timeOr(a.lastDate, 0) || byTitle(a, b);
}

/** Sorted copy of the admin course cards ({ title, current, lastDate }). */
export function sortCourseCards(cards) {
  return [...cards].sort(compareCards);
}

/**
 * Pagination bounds: totalPages = max(1, ceil(total / pageSize)), page clamped to
 * [1, totalPages] (invalid input → 1) and the matching skip.
 */
export function pageInfo(total, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const requested = Math.floor(Number(page));
  const current = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), totalPages) : 1;
  return { page: current, totalPages, skip: (current - 1) * pageSize };
}
