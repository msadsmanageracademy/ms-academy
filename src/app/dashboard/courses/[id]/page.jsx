import CourseDetailView from "./_components/CourseDetailView";
import { getActor } from "@/lib/api/guards";
import { getCourseDetail } from "@/server/courses/service";
import { listClasses } from "@/server/classes/service";
import { listCourseEnrollments } from "@/server/courses/enrollments";
import { listCourseReviews } from "@/server/reviews/service";
import { toPlain } from "@/server/serialize";
import { HttpError, isAdminActor } from "@/server/errors";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Detalle de curso | MS Academy" };

// Server Component, admin only (also enforced by the middleware and the services)
export default async function CourseDetailPage({ params }) {
  const { id } = await params;
  const actor = await getActor();
  if (!isAdminActor(actor)) redirect("/dashboard/courses");

  let course;
  try {
    course = await getCourseDetail(actor, id);
  } catch (error) {
    if (error instanceof HttpError && (error.status === 400 || error.status === 404)) notFound();
    throw error;
  }

  const [classes, enrollments, reviews] = await Promise.all([
    listClasses(actor, { courseId: id }),
    listCourseEnrollments(actor, id),
    listCourseReviews(id),
  ]);

  return (
    <CourseDetailView
      course={toPlain(course)}
      classes={toPlain(classes)}
      enrollments={toPlain(enrollments)}
      reviews={toPlain(reviews)}
    />
  );
}
