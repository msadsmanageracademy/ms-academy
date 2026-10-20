import { HttpError } from "@/server/errors";
import PageWrapper from "@/views/components/layout/PageWrapper";
import PublicCourseView from "./_components/PublicCourseView";
import { ReviewPageQuerySchema } from "@/utils/validation";
import { cache } from "react";
import { getActor } from "@/lib/api/guards";
import { getCourseDetail } from "@/server/courses/service";
import { listCourseReviews } from "@/server/reviews/service";
import { notFound } from "next/navigation";
import { toPlain } from "@/server/serialize";

const loadCourse = cache(async (courseId) => {
  const actor = await getActor();
  try {
    return { actor, course: await getCourseDetail(actor, courseId) };
  } catch (error) {
    if (error instanceof HttpError && (error.status === 400 || error.status === 404)) {
      return { actor, course: null };
    }
    throw error;
  }
});

export async function generateMetadata({ params }) {
  const { courseId } = await params;
  const { course } = await loadCourse(courseId);
  // The page itself calls notFound(): calling it here would render the 404 outside the layout
  if (!course) return { title: "Curso no encontrado | MS Academy" };
  return { title: `${course.title} | MS Academy`, description: course.short_description };
}

// Server Component: the course, its open edition and its reviews are in the HTML (indexable).
// Visible when the course is active with a published edition, to admins and to users
// enrolled in any of its editions (getCourseDetail); otherwise 404.
export default async function CourseDetailPage({ params, searchParams }) {
  const { courseId } = await params;
  const { actor, course } = await loadCourse(courseId);
  if (!course) notFound();

  // Reviews of every edition, paginated on the server (?page=; garbage falls back to page 1)
  const { page } = ReviewPageQuerySchema.parse(await searchParams);
  const reviews = await listCourseReviews(courseId, { page });

  return (
    <PageWrapper>
      <PublicCourseView course={toPlain(course)} reviews={toPlain(reviews)} viewerRole={actor?.role ?? null} />
    </PageWrapper>
  );
}
