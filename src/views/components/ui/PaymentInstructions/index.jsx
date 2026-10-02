import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";
import { config } from "@/config";

/**
 * How to pay a pending course enrollment. The text and payment data come from
 * config.payment (src/config/custom.js), so they can change without touching the UI.
 * `courses`: [{ _id, title, price }] pending for the viewer.
 */
const PaymentInstructions = ({ courses, headingLevel = 2 }) => {
  if (!courses?.length) return null;
  const Heading = `h${headingLevel}`;
  const { instructions, details = [] } = config.payment ?? {};

  return (
    <section aria-labelledby="payment-instructions-title" className={styles.box}>
      <Heading className={styles.title} id="payment-instructions-title">
        Pago pendiente
      </Heading>
      <ul className={styles.courses}>
        {courses.map((course) => (
          <li key={course._id}>
            <strong>{course.title}</strong>: ${course.price}
          </li>
        ))}
      </ul>
      {instructions && <p className={styles.text}>{instructions}</p>}
      {details.length > 0 && (
        <dl className={styles.details}>
          {details.map(({ label, value }) => (
            <div key={label} className={styles.detail}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <PrimaryLink dark href="/contact" text="Ir a Contacto" />
    </section>
  );
};

export default PaymentInstructions;
