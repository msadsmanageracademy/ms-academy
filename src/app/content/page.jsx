import ContentBoards from "./_components/ContentBoards";
import PageWrapper from "@/views/components/layout/PageWrapper";
import { getActor } from "@/lib/api/guards";
import { getCourseTimeStatus } from "@/utils/classStatus";
import { listClasses } from "@/server/classes/service";
import { listCourses } from "@/server/courses/service";
import { toPlain } from "@/server/serialize";

export const metadata = {
  title: "Próximas actividades | MS Academy",
  description: "Clases gratuitas y cursos de MS Academy con inscripción abierta.",
};

export default async function ContentPage() {
  const actor = await getActor();
  const [classes, courses] = await Promise.all([listClasses(actor), listCourses(actor)]);
  const openCourses = courses.filter((c) => {
    const status = getCourseTimeStatus(c.start_date, c.end_date, c.status);
    return status === "upcoming" || status === "in-progress";
  });

  return (
    <PageWrapper>
      <h1 className="visually-hidden">Próximas actividades</h1>
      <ContentBoards
        classes={toPlain(classes)}
        courses={toPlain(openCourses)}
        viewerRole={actor?.role ?? null}
      />
    </PageWrapper>
  );
}
