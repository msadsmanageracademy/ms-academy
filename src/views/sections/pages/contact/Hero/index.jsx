import ContactForm from "@/views/sections/pages/contact/ContactForm";
import { Mailbox, Pin } from "@/views/components/icons";
import styles from "./styles.module.css";

const HeroSection = () => {
  return (
    <section className={styles.hero}>
      <div className={styles.inner}>
        <div className={styles.info}>
          <span className={styles.eyebrow}>Contacto</span>
          <h1 className={styles.title}>Hablemos</h1>
          <p className={styles.description}>
            ¿Tenés dudas sobre una clase o curso? ¿Querés saber si la
            capacitación es la indicada para vos? Escribime y te respondo a la
            brevedad.
          </p>
          <ul className={styles.details}>
            <li className={styles.detailItem}>
              <span className={styles.detailIcon}>
                <Mailbox size={20} />
              </span>
              <span>msadsmanageracademy@gmail.com</span>
            </li>
            <li className={styles.detailItem}>
              <span className={styles.detailIcon}>
                <Pin size={20} />
              </span>
              <span>Buenos Aires, Argentina</span>
            </li>
          </ul>
        </div>
        <div className={styles.formWrapper}>
          <ContactForm />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
