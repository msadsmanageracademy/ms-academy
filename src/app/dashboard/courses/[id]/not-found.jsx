import IconLink from "@/views/components/ui/IconLink";
import styles from "./styles.module.css";

export default function CourseNotFound() {
  return (
    <div className={styles.container}>
      <h1>Curso no encontrado</h1>
      <IconLink fill="var(--color-4)" href="/dashboard/courses" icon="Back" title="Volver" />
    </div>
  );
}
