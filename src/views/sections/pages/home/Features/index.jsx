import {
  NavbarClasses,
  Courses,
  GoogleMeet,
  NavbarDashboard,
} from "@/views/components/icons";
import styles from "./styles.module.css";

const features = [
  {
    icon: NavbarClasses,
    title: "Clases individuales",
    description:
      "Sesiones uno a uno adaptadas a tu ritmo y nivel. Trabajamos sobre tus proyectos reales.",
  },
  {
    icon: Courses,
    title: "Cursos estructurados",
    description:
      "Programas completos con contenido progresivo, de principiante a avanzado.",
  },
  {
    icon: GoogleMeet,
    title: "Google Meet integrado",
    description:
      "Las clases online se realizan vía Google Meet con links generados automáticamente.",
  },
  {
    icon: NavbarDashboard,
    title: "Dashboard",
    description:
      "Desde tu dashboard accedés a tus clases, cursos, notificaciones y más.",
  },
];

export default function Features() {
  return (
    <section className={styles.features}>
      <div className={styles.featuresInner}>
        <h2 className={styles.title}>¿Qué podés hacer con la plataforma?</h2>
        <div className={styles.grid}>
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className={styles.card}>
              <div className={styles.iconWrapper}>
                <Icon fill={"var(--color-4)"} size={32} />
              </div>
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardDescription}>{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
