import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";

const HeroSection = () => {
  return (
    <section className={styles.hero}>
      <div className={styles.heroHeader}>
        <div className={styles.heroImage}>Imagen hero (portada)</div>
        <div className={styles.heroText}>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipisicing elit.
            Exercitationem harum molestias expedita est, accusantium sed dolorem
            unde obcaecati illum. Tempora?
          </p>
          <PrimaryLink
            className={styles.link}
            href="/content"
            text={"Consultar próximas actividades"}
          />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
