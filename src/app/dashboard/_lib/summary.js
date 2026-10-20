import { isAdminActor } from "@/server/errors";
import { listAdminCourses } from "@/server/courses/service";
import { listAdminEditions } from "@/server/courses/editions";
import { listClasses } from "@/server/classes/service";
import { listMyEditions } from "@/server/courses/enrollments";

/** The earliest item that starts after `now` (and passes `filter`), or null. */
function nextUpcoming(items, now, filter = () => true) {
  return (
    items
      .filter((item) => item.start_date && new Date(item.start_date) > now && filter(item))
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0] ?? null
  );
}

const countBy = (items, status) => items.filter((item) => item.status === status).length;

const asNextCourse = (edition) => (edition ? { ...edition, title: edition.courseTitle } : null);

export async function getDashboardSummary(actor) {
  const now = new Date();

  if (isAdminActor(actor)) {
    const [classes, courses, editions] = await Promise.all([
      listClasses(actor, { showAll: true }),
      listAdminCourses(actor),
      listAdminEditions(actor),
    ]);
    const isPublished = (item) => item.status === "published";
    return {
      stats: {
        draftClasses: countBy(classes, "draft"),
        enrolledClasses: countBy(classes, "enrolled"),
        publishedClasses: countBy(classes, "published"),
        activeCourses: countBy(courses, "active"),
        archivedCourses: countBy(courses, "archived"),
        draftEditions: countBy(editions, "draft"),
        publishedEditions: countBy(editions, "published"),
      },
      nextClass: nextUpcoming(classes, now, isPublished),
      nextCourse: asNextCourse(nextUpcoming(editions, now, isPublished)),
    };
  }

  const [classes, myEditions] = await Promise.all([
    listClasses(actor, { myClasses: true }),
    listMyEditions(actor),
  ]);
  return {
    stats: {
      classes: classes.length,
      preEnrolledCourses: myEditions.filter((e) => e.paymentStatus === "pending").length,
      enrolledCourses: myEditions.filter((e) => e.paymentStatus === "paid").length,
    },
    nextClass: nextUpcoming(classes, now),
    nextCourse: asNextCourse(nextUpcoming(myEditions, now)),
  };
}
