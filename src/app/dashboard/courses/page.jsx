import AdminCoursesView from "./_components/AdminCoursesView";
import StudentCoursesView from "./_components/StudentCoursesView";
import { getActor } from "@/lib/api/guards";
import { isAdminActor } from "@/server/errors";
import { listAdminCourses } from "@/server/courses/service";
import { listMyEditions } from "@/server/courses/enrollments";
import { listMyReviews } from "@/server/reviews/service";
import { redirect } from "next/navigation";
import { toPlain } from "@/server/serialize";

export const metadata = { title: "Cursos | MS Academy" };

// Server Component: loads the data of the viewer's role; the views only handle interaction
export default async function CoursesPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");

  if (isAdminActor(actor)) {
    // One card per course (the product); its figures combine every edition
    return <AdminCoursesView courses={toPlain(await listAdminCourses(actor))} />;
  }

  const [editions, reviews] = await Promise.all([listMyEditions(actor), listMyReviews(actor)]);
  // editionId → own review, to show "review" vs "edit review"
  const reviewByEdition = Object.fromEntries(
    reviews
      .filter((r) => r.editionId)
      .map((r) => [r.editionId.toString(), { rating: r.rating, comment: r.comment }]),
  );
  return <StudentCoursesView editions={toPlain(editions)} reviews={reviewByEdition} />;
}
