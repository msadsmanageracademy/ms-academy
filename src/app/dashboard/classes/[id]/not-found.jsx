import IconLink from "@/views/components/ui/IconLink";
import styles from "./styles.module.css";

export default function ClassNotFound() {
  return (
    <div className={styles.container}>
      <h1>Clase no encontrada</h1>
      <IconLink fill="var(--color-4)" href="/dashboard/classes" icon="Back" title="Volver" />
    </div>
  );
}
