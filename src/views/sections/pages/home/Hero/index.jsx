import Image from "next/image";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import { config } from "@/config";
import styles from "./styles.module.css";

const HeroSection = () => {
  return (
    <section className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>Publicidad digital</span>
          <h1 className={styles.headline}>
            Capacitate con{" "}
            <span className={styles.accent}>Maximiliano Setzes</span> y llevá
            tu negocio al{" "}
            <span className={styles.accent}>siguiente nivel</span>
          </h1>
          <p className={styles.subheadline}>
            Clases y cursos 100% online, en vivo por Google Meet. Aprendé
            publicidad digital con sesiones prácticas y personalizadas.
          </p>
          <div className={styles.ctas}>
            <PrimaryLink
              href="/content"
              text="Ver próximas actividades"
            />
            <PrimaryLink {...(config.allowRegistration ? { href: "/register", text: "Crear cuenta gratis" } : { href: "/login", text: "Ingresar" })} />
          </div>
        </div>

        <div className={styles.heroImageWrapper}>
          <div className={styles.heroImageRing}>
            <Image
              alt="Maximiliano Setzes"
              className={styles.heroImage}
              height={420}
              src="/images/maximiliano.jpg"
              width={420}
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
