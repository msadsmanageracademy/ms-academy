import ClassDetailView from "./_components/ClassDetailView";
import { getActor } from "@/lib/api/guards";
import { getClassDetail } from "@/server/classes/service";
import { getEditionDetail } from "@/server/courses/editions";
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

  const isEditionClass = !!classData.editionId;
  const [edition, participants, reviews] = await Promise.all([
    // An edition that can't be read only hides its link (the class still shows)
    isEditionClass ? getEditionDetail(actor, classData.editionId.toString()).catch(() => null) : null,
    // Edition classes manage their people from the edition
    !isEditionClass && classData.participants?.length > 0 ? listClassParticipants(actor, id) : [],
    listClassReviews(id),
  ]);

  return (
    <ClassDetailView
      classData={toPlain(classData)}
      edition={
        edition &&
        toPlain({
          courseId: edition.courseId,
          courseTitle: edition.course?.title ?? classData.courseTitle ?? "",
          _id: edition._id,
          label: edition.label,
          status: edition.status,
          timeStatus: edition.timeStatus,
        })
      }
      participants={toPlain(participants)}
      reviews={toPlain(reviews)}
      hasCalendarAccess={actor.hasAuthorizedCalendar || false}
    />
  );
}
