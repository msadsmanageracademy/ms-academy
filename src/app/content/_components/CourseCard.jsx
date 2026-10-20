import Link from "next/link";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import SeatsInfo from "./SeatsInfo";
import StarRating from "@/views/components/ui/StarRating";
import styles from "../styles.module.css";
import { Clock, NavbarClasses } from "@/views/components/icons";
import { formatDate } from "@/utils/dates";
import { formatPrice } from "@/utils/price";

const TIME_STATUS = {
  upcoming: { label: "Por comenzar", className: styles.chipUpcoming },
  "in-progress": { label: "En curso", className: styles.chipOngoing },
};

const PAYMENT_STATUS = {
  paid: { label: "Ya estás inscripto", className: styles.chipPaid },
  pending: { label: "Pago pendiente", className: styles.chipPending },
};

const ratingFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 1,
});

/**
 * Course card of the public catalog. Price, dates and seats come from the edition open
 * to enrollment (`course.openEdition`); the rating covers every edition of the course.
 * Enrollment happens on the course page.
 */
const CourseCard = ({ course, viewerRole }) => {
  const { _id, avgRating, openEdition, reviewCount = 0, short_description, title } = course;
  const {
    amount_of_classes = 0,
    end_date,
    enrollmentCount,
    label,
    max_participants,
    price,
    start_date,
    timeStatus: timeStatusKey,
    userPaymentStatus,
  } = openEdition;
  const timeStatus = TIME_STATUS[timeStatusKey];
  const payment = PAYMENT_STATUS[userPaymentStatus];
  const titleId = `course-${_id}`;

  return (
    <article aria-labelledby={titleId} className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.typeLabel}>Curso · {label}</span>
        {timeStatus ? (
          <span className={`${styles.chip} ${timeStatus.className}`}>{timeStatus.label}</span>
        ) : null}
        {payment ? (
          <span className={`${styles.chip} ${payment.className}`}>{payment.label}</span>
        ) : null}
      </div>
      <h3 className={styles.cardTitle} id={titleId}>
        {title}
      </h3>
      {short_description ? <p className={styles.description}>{short_description}</p> : null}
      <ul className={styles.meta}>
        <li className={styles.metaItem}>
          <Clock fill="currentColor" size={16} />
          <span>
            {timeStatusKey === "in-progress" ? "Comenzó el" : "Comienza el"}{" "}
            <time dateTime={start_date}>{formatDate(start_date)}</time>
            {end_date ? (
              <>
                {" "}
                · termina el <time dateTime={end_date}>{formatDate(end_date)}</time>
              </>
            ) : null}
          </span>
        </li>
        <li className={styles.metaItem}>
          <NavbarClasses fill="currentColor" size={16} />
          {amount_of_classes === 1 ? "1 clase" : `${amount_of_classes} clases`}
        </li>
      </ul>
      {reviewCount > 0 && avgRating ? (
        <p className={styles.rating}>
          <StarRating readOnly size="sm" value={avgRating} />
          {ratingFormatter.format(avgRating)} ({reviewCount}{" "}
          {reviewCount === 1 ? "reseña" : "reseñas"})
        </p>
      ) : null}
      <SeatsInfo max={max_participants} showBar taken={enrollmentCount} />
      <div className={styles.cardFooter}>
        <p className={styles.price}>{formatPrice(price)}</p>
        <div className={styles.actions}>
          <PrimaryLink
            aria-label={`Ver curso ${title}`}
            dark
            href={`/content/courses/${_id}`}
            text="Ver curso"
          />
          {viewerRole === "admin" ? (
            <Link
              aria-label={`Gestionar ${title}`}
              className={styles.secondaryLink}
              href={`/dashboard/courses/${_id}`}
            >
              Gestionar
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
};

export default CourseCard;
