import AdminClassesView from "./_components/AdminClassesView";
import StudentClassesView from "./_components/StudentClassesView";
import { getActor } from "@/lib/api/guards";
import { isAdminActor } from "@/server/errors";
import { listAdminEditions } from "@/server/courses/editions";
import { listClasses } from "@/server/classes/service";
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
    const [classes, editions] = await Promise.all([
      listClasses(actor, { showAll: true }),
      listAdminEditions(actor),
    ]);
    return (
      <AdminClassesView
        classes={toPlain(sortClasses(classes))}
        // "Vincular clase": course first, then one of its editions
        editions={toPlain(
          editions.map(({ _id, courseId, courseTitle, adminNumber, label, title, status }) => ({
            _id,
            courseId,
            courseTitle,
            adminNumber,
            label,
            title,
            status,
          })),
        )}
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
