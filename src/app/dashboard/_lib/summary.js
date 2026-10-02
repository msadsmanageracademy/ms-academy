import { isAdminActor } from "@/server/errors";
import { listClasses } from "@/server/classes/service";
import { listCourses } from "@/server/courses/service";

/** The earliest item that starts after `now` (and passes `filter`), or null. */
function nextUpcoming(items, now, filter = () => true) {
  return (
    items
      .filter((item) => item.start_date && new Date(item.start_date) > now && filter(item))
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0] ?? null
  );
}

const countBy = (items, status) => items.filter((item) => item.status === status).length;

/**
 * Data of the dashboard home.
 * - admin: classes/courses by status and the next published class and course
 * - student: their classes, pre-enrollments, paid courses and what comes next
 */
export async function getDashboardSummary(actor) {
  const now = new Date();

  if (isAdminActor(actor)) {
    const [classes, courses] = await Promise.all([
      listClasses(actor, { showAll: true }),
      listCourses(actor, { showAll: true }),
    ]);
    const isPublished = (item) => item.status === "published";
    return {
      stats: {
        draftClasses: countBy(classes, "draft"),
        enrolledClasses: countBy(classes, "enrolled"),
        publishedClasses: countBy(classes, "published"),
        draftCourses: countBy(courses, "draft"),
        publishedCourses: countBy(courses, "published"),
      },
      nextClass: nextUpcoming(classes, now, isPublished),
      nextCourse: nextUpcoming(courses, now, isPublished),
    };
  }

  const [classes, courses] = await Promise.all([
    listClasses(actor, { myClasses: true }),
    listCourses(actor),
  ]);
  const myCourses = courses.filter((c) => c.userPaymentStatus === "paid" || c.userPaymentStatus === "pending");
  return {
    stats: {
      classes: classes.length,
      preEnrolledCourses: myCourses.filter((c) => c.userPaymentStatus === "pending").length,
      enrolledCourses: myCourses.filter((c) => c.userPaymentStatus === "paid").length,
    },
    nextClass: nextUpcoming(classes, now),
    nextCourse: nextUpcoming(myCourses, now),
  };
}
