import ClassDetailView from "./_components/ClassDetailView";
import { getActor } from "@/lib/api/guards";
import { getClassDetail } from "@/server/classes/service";
import { getCourseDetail } from "@/server/courses/service";
import { listClassParticipants } from "@/server/classes/participants";
import { listClassReviews } from "@/server/reviews/service";
import { toPlain } from "@/server/serialize";
import { HttpError, isAdminActor } from "@/server/errors";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Detalle de clase | MS Academy" };

// Server Component, admin only (also enforced by the middleware and the services)
export default async function ClassDetailPage({ params }) {
  const { id } = await params;
  const actor = await getActor();
  if (!isAdminActor(actor)) redirect("/dashboard/classes");

  let classData;
  try {
    classData = await getClassDetail(actor, id);
  } catch (error) {
    if (error instanceof HttpError && (error.status === 400 || error.status === 404)) notFound();
    throw error;
  }

  const isCourseClass = !!classData.courseId;
  const [course, participants, reviews] = await Promise.all([
    // A course that can't be read only hides its title (the class still shows)
    isCourseClass ? getCourseDetail(actor, classData.courseId.toString()).catch(() => null) : null,
    // Course classes manage their people from the course
    !isCourseClass && classData.participants?.length > 0 ? listClassParticipants(actor, id) : [],
    listClassReviews(id),
  ]);

  return (
    <ClassDetailView
      classData={toPlain(classData)}
      course={
        course &&
        toPlain({
          title: course.title,
          status: course.status,
          start_date: course.start_date,
          end_date: course.end_date,
        })
      }
      participants={toPlain(participants)}
      reviews={toPlain(reviews)}
      hasCalendarAccess={actor.hasAuthorizedCalendar || false}
    />
  );
}
