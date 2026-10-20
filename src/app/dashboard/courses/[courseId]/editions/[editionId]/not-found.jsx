import IconLink from "@/views/components/ui/IconLink";
import styles from "../../../styles.module.css";

export default function EditionNotFound() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Edición no encontrada</h1>
        <IconLink fill="var(--color-4)" href="/dashboard/courses" icon="Back" title="Volver a cursos" />
      </div>
      <p>La edición que buscás no existe o fue eliminada.</p>
    </div>
  );
}
