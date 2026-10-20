import EditionDetailView from "./_components/EditionDetailView";
import { ReviewPageQuerySchema } from "@/utils/validation";
import { getActor } from "@/lib/api/guards";
import { getAdminEdition } from "@/server/courses/editions";
import { listClasses } from "@/server/classes/service";
import { listCourseReviews } from "@/server/reviews/service";
import { listEditionEnrollments } from "@/server/courses/enrollments";
import { toPlain } from "@/server/serialize";
import { HttpError, isAdminActor } from "@/server/errors";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Edición | MS Academy" };

// Server Component, admin only (also enforced by the middleware and the services).
// One edition of a course by its id: data, classes, enrollees and a page of its reviews.
export default async function AdminEditionPage({ params, searchParams }) {
  const { courseId, editionId: editionIdParam } = await params;
  const actor = await getActor();
  if (!isAdminActor(actor)) redirect("/dashboard/courses");

  let edition;
  try {
    edition = await getAdminEdition(actor, courseId, editionIdParam);
  } catch (error) {
    // Malformed ids (400), missing course or edition, or an edition of another course (404)
    if (error instanceof HttpError && (error.status === 400 || error.status === 404)) notFound();
    throw error;
  }

  const query = await searchParams;
  // ?page= (server-side pagination; garbage falls back to page 1). The edition is fixed.
  const { page } = ReviewPageQuerySchema.parse(query);
  const editionId = edition._id.toString();
  const [classes, enrollments, reviews] = await Promise.all([
    listClasses(actor, { editionId }),
    listEditionEnrollments(actor, editionId),
    listCourseReviews(courseId, { editionId, page }),
  ]);

  return (
    <EditionDetailView
      classes={toPlain(classes)}
      edition={toPlain(edition)}
      enrollments={toPlain(enrollments)}
      // ?edit=1 (from the editions table) opens the price and capacity form of a draft
      initialEditMode={query?.edit === "1" && edition.status === "draft"}
      reviews={toPlain(reviews)}
    />
  );
}
