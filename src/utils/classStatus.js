/**
 * Computes the time-based status of a class.
 * @param {string|Date} startDate
 * @param {number} durationMinutes
 * @param {'draft'|'published'|'enrolled'} [editorialStatus]
 * @returns {'upcoming' | 'ongoing' | 'completed' | null}
 */
export function getClassStatus(startDate, durationMinutes, editorialStatus) {
  if (editorialStatus === "draft") return null;
  if (!startDate) return null;
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  if (now < start) return "upcoming";
  if (now < end) return "ongoing";
  return "completed";
}

/**
 * Computes the overall progress of a course based on its classes.
 * @param {Array<{ start_date: string|Date, duration: number }>} classes
 * @returns {{ status: 'upcoming'|'in-progress'|'completed', completedCount: number, totalCount: number, percentage: number }}
 */
export function getCourseProgress(classes) {
  if (!classes || classes.length === 0) {
    return {
      status: "upcoming",
      completedCount: 0,
      totalCount: 0,
      percentage: 0,
    };
  }

  const statuses = classes.map((c) =>
    getClassStatus(c.start_date, c.duration, c.status),
  );
  const completedCount = statuses.filter((s) => s === "completed").length;
  const ongoingCount = statuses.filter((s) => s === "ongoing").length;
  const totalCount = classes.length;
  const percentage = Math.round((completedCount / totalCount) * 100);

  let status;
  if (completedCount === totalCount) {
    status = "completed";
  } else if (completedCount > 0 || ongoingCount > 0) {
    status = "in-progress";
  } else {
    status = "upcoming";
  }

  return { status, completedCount, totalCount, percentage };
}

/**
 * Computes a rough time-based status for a course from its start/end dates only.
 * @param {string|Date} startDate
 * @param {string|Date|null} endDate
 * @param {'draft'|'published'} [editorialStatus]
 * @returns {'upcoming' | 'in-progress' | 'completed' | null}
 */
export function getCourseTimeStatus(startDate, endDate, editorialStatus) {
  if (editorialStatus === "draft") return null;
  if (!startDate) return null;
  const now = new Date();
  const start = new Date(startDate);
  if (now < start) return "upcoming";
  if (!endDate) return "in-progress";
  const end = new Date(endDate);
  return now > end ? "completed" : "in-progress";
}
