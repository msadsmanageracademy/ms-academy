import Image from "next/image";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";

const LINKEDIN_URL = "https://www.linkedin.com/in/maximilianosetzes/";

export default function About({ asPage = false }) {
  const Title = asPage ? "h1" : "h2";
  return (
    <section className={styles.about}>
      <div className={styles.aboutInner}>
        <div className={styles.imageWrapper}>
          <div className={styles.imageRing}>
            <Image
              alt="Maximiliano Setzes"
              className={styles.image}
              height={380}
              priority={asPage}
              src="/images/maximiliano.jpg"
              width={380}
            />
          </div>
        </div>
        <div className={styles.content}>
          <span className={styles.eyebrow}>Instructor</span>
          <Title className={styles.title}>
            {asPage ? "Sobre mí: " : "Sobre "}
            <span className={styles.accent}>Maximiliano</span>
          </Title>
          <p className={styles.bio}>
            Especialista en publicidad digital con años de experiencia en
            campañas de Google Ads, Meta Ads y estrategias de marketing
            performance. Acompaño a emprendedores y profesionales a potenciar
            su presencia online con resultados medibles.
          </p>
          <p className={styles.bio}>
            Mi metodología es práctica y orientada a proyectos reales. Trabajás
            con tus propias cuentas desde la primera clase.
          </p>
          <div className={styles.cta}>
            {asPage ? (
              <>
                <PrimaryLink href="/content" text="Ver próximas actividades" />
                <PrimaryLink dark href="/contact" text="Escribime" />
                <PrimaryLink
                  dark
                  href={LINKEDIN_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                  text="LinkedIn"
                />
              </>
            ) : (
              <PrimaryLink href="/about" text="Conocé más" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
