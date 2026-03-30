import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";

export default function CTA() {
  return (
    <section className={styles.cta}>
      <div className={styles.inner}>
        <h2 className={styles.title}>
          ¿Listo para llevar tu negocio al{" "}
          <span className={styles.accent}>siguiente nivel</span>?
        </h2>
        <p className={styles.subtitle}>
          Explorá las clases y cursos disponibles o creá tu cuenta y empezá hoy.
        </p>
        <div className={styles.buttons}>
          <PrimaryLink href="/content" text="Ver actividades" />
          <PrimaryLink href="/register" text="Crear cuenta gratis" />
        </div>
      </div>
    </section>
  );
}
