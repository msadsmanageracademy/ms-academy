import AdminClassesView from "./_components/AdminClassesView";
import StudentClassesView from "./_components/StudentClassesView";
import { getActor } from "@/lib/api/guards";
import { isAdminActor } from "@/server/errors";
import { listClasses } from "@/server/classes/service";
import { listCourses } from "@/server/courses/service";
import { listMyReviews } from "@/server/reviews/service";
import { redirect } from "next/navigation";
import { sortClasses } from "./_components/classList";
import { toPlain } from "@/server/serialize";

export const metadata = { title: "Clases | MS Academy" };

// Server Component: loads the data of the viewer's role; the views only handle interaction
export default async function ClassesPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");

  if (isAdminActor(actor)) {
    const [classes, courses] = await Promise.all([
      listClasses(actor, { showAll: true }),
      listCourses(actor, { showAll: true }),
    ]);
    return (
      <AdminClassesView
        classes={toPlain(sortClasses(classes))}
        courses={toPlain(courses.map(({ _id, title }) => ({ _id, title })))}
      />
    );
  }

  const [classes, reviews] = await Promise.all([
    listClasses(actor, { myClasses: true }),
    listMyReviews(actor),
  ]);
  // classId → own review, to show "review" vs "edit review"
  const reviewByClass = Object.fromEntries(
    reviews
      .filter((r) => r.classId)
      .map((r) => [r.classId.toString(), { rating: r.rating, comment: r.comment }]),
  );
  return <StudentClassesView classes={toPlain(sortClasses(classes))} reviews={reviewByClass} />;
}
