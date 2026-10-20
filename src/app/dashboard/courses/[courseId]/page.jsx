import CoursePageView from "./_components/CoursePageView";
import { ReviewPageQuerySchema } from "@/utils/validation";
import { getActor } from "@/lib/api/guards";
import { getAdminCourse } from "@/server/courses/service";
import { listCourseReviews } from "@/server/reviews/service";
import { toPlain } from "@/server/serialize";
import { HttpError, isAdminActor } from "@/server/errors";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Curso | MS Academy" };

// Server Component, admin only (also enforced by the middleware and the services).
// The course (the product) with its editions, course-wide metrics and one page of reviews.
export default async function AdminCoursePage({ params, searchParams }) {
  const { courseId } = await params;
  const actor = await getActor();
  if (!isAdminActor(actor)) redirect("/dashboard/courses");

  let course;
  try {
    course = await getAdminCourse(actor, courseId);
  } catch (error) {
    // Malformed id (400) or missing course (404)
    if (error instanceof HttpError && (error.status === 400 || error.status === 404)) notFound();
    throw error;
  }

  // ?page=&edition= (server-side pagination). Garbage falls back to page 1 / no filter,
  // and so does an edition that does not belong to this course.
  const query = ReviewPageQuerySchema.parse(await searchParams);
  const editionId = course.editions.some((e) => e._id.toString() === query.edition) ? query.edition : undefined;
  const reviews = await listCourseReviews(courseId, { editionId, page: query.page });

  return (
    <CoursePageView
      course={toPlain(course)}
      reviewEditionId={editionId ?? null}
      reviews={toPlain(reviews)}
    />
  );
}
