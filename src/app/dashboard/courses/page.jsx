import AdminCoursesView from "./_components/AdminCoursesView";
import StudentCoursesView from "./_components/StudentCoursesView";
import { getActor } from "@/lib/api/guards";
import { isAdminActor } from "@/server/errors";
import { listCourses } from "@/server/courses/service";
import { listMyReviews } from "@/server/reviews/service";
import { redirect } from "next/navigation";
import { toPlain } from "@/server/serialize";

export const metadata = { title: "Cursos | MS Academy" };

// Server Component: loads the data of the viewer's role; the views only handle interaction
export default async function CoursesPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");

  if (isAdminActor(actor)) {
    return <AdminCoursesView courses={toPlain(await listCourses(actor, { showAll: true }))} />;
  }

  const [courses, reviews] = await Promise.all([listCourses(actor), listMyReviews(actor)]);
  // courseId → own review, to show "review" vs "edit review"
  const reviewByCourse = Object.fromEntries(
    reviews
      .filter((r) => r.courseId)
      .map((r) => [r.courseId.toString(), { rating: r.rating, comment: r.comment }]),
  );
  return (
    <StudentCoursesView
      // The listing includes the user's own payment status: keep only their courses
      courses={toPlain(courses.filter((c) => c.userPaymentStatus != null))}
      reviews={reviewByCourse}
    />
  );
}
