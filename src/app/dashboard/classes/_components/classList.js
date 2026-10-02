import { getClassStatus } from "@/utils/classStatus";

export const isCompleted = (cls) =>
  getClassStatus(cls.start_date, cls.duration, cls.status) === "completed";

/** Upcoming/ongoing first (by date), completed at the bottom. Returns a new array. */
export function sortClasses(classes) {
  return [...classes].sort((a, b) => {
    const aCompleted = isCompleted(a);
    const bCompleted = isCompleted(b);
    if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
    return new Date(a.start_date) - new Date(b.start_date);
  });
}

/** Distinct courses present in the list, for the course filter. */
export function getCourseOptions(classes) {
  return [
    ...new Map(
      classes
        .filter((c) => c.courseId)
        .map((c) => [c.courseId, { id: c.courseId, title: c.courseTitle || c.courseId }]),
    ).values(),
  ];
}

/** "all", "none" (standalone classes) or a course id. */
export function filterByCourse(classes, filter) {
  if (filter === "all") return classes;
  if (filter === "none") return classes.filter((c) => !c.courseId);
  return classes.filter((c) => c.courseId === filter);
}

/** Replaces the class with `id` by `{ ...class, ...changes }`. */
export const patchClass = (classes, id, changes) =>
  classes.map((c) => (c._id === id ? { ...c, ...changes } : c));

export const priceLabel = (price) => (price === 0 ? "Gratis" : `$${price}`);
