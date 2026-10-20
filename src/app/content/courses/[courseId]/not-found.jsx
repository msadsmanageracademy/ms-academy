import PageWrapper from "@/views/components/layout/PageWrapper";
import PrimaryLink from "@/views/components/ui/PrimaryLink";

export default function CourseNotFound() {
  return (
    <PageWrapper>
      <h1>Curso no encontrado</h1>
      <p>El curso no existe o todavía no está publicado.</p>
      <PrimaryLink dark href="/content" text="Ver próximas actividades" />
    </PageWrapper>
  );
}
