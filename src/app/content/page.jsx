import ContentView from "./_components/ContentView";
import { getActor } from "@/lib/api/guards";
import { listClasses } from "@/server/classes/service";
import { listCourses } from "@/server/courses/service";
import { toPlain } from "@/server/serialize";

export const metadata = {
  title: "Próximas actividades | MS Academy",
  description: "Clases gratuitas y cursos de MS Academy con inscripción abierta.",
};

// Courses without a start date (never the case for a published edition) go last
const startTime = (course) => new Date(course.openEdition.start_date ?? 8.64e15).getTime();

export default async function ContentPage() {
  const actor = await getActor();
  // listCourses only returns active courses with an edition open to enrollment
  const [classes, courses] = await Promise.all([listClasses(actor), listCourses(actor)]);
  // By the start of their open edition: in-progress ones first, then the upcoming ones
  const openCourses = [...courses].sort((a, b) => startTime(a) - startTime(b));

  return (
    <ContentView
      classes={toPlain(classes)}
      courses={toPlain(openCourses)}
      viewerRole={actor?.role ?? null}
    />
  );
}
