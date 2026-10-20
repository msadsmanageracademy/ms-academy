import IconLink from "@/views/components/ui/IconLink";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import StarRating from "@/views/components/ui/StarRating";
import { formatDate } from "@/utils/dates";
import { formatRating } from "@/views/components/ui/ReviewList";
import styles from "../styles.module.css";

const COURSE_STATUS = {
  active: { label: "Activo", className: styles.chipActive },
  archived: { label: "Archivado", className: styles.chipArchived },
};

const TIME_STATUS = {
  upcoming: { label: "Próxima edición", className: styles.chipUpcoming },
  "in-progress": { label: "Edición en curso", className: styles.chipOngoing },
};

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// The edition in progress (or the next one); otherwise the latest edition, if any
const CurrentEdition = ({ current, latest }) => {
  if (current) {
    return (
      <p className={styles.cardEdition}>
        <span className={styles.cardEditionLabel}>{current.label}</span>
        {current.start_date ? (
          <span>
            {current.timeStatus === "in-progress" ? "Comenzó el" : "Comienza el"}{" "}
            <time dateTime={current.start_date}>{formatDate(current.start_date)}</time>
          </span>
        ) : null}
      </p>
    );
  }
  return (
    <p className={styles.cardEdition}>
      <span className={styles.cardEditionLabel}>Sin edición en curso ni próxima</span>
      {latest ? <span>Última: {latest.label}</span> : null}
    </p>
  );
};

/**
 * Admin card of a course (the product), in the style of the /content cards. Every
 * figure combines all the editions of the course; `onNewEdition` creates the next one.
 */
const AdminCourseCard = ({ course, onNewEdition }) => {
  const {
    _id,
    avgRating,
    classesPerEdition = 0,
    current,
    editionCount = 0,
    latest,
    paidCount = 0,
    reviewCount = 0,
    short_description,
    status,
    timesTaught = 0,
    title,
  } = course;
  const courseStatus = COURSE_STATUS[status] ?? COURSE_STATUS.active;
  const timeStatus = TIME_STATUS[current?.timeStatus];
  const titleId = `admin-course-${_id}`;

  return (
    <article aria-labelledby={titleId} className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.typeLabel}>Curso</span>
        <span className={`${styles.chip} ${courseStatus.className}`}>{courseStatus.label}</span>
        {timeStatus ? <span className={`${styles.chip} ${timeStatus.className}`}>{timeStatus.label}</span> : null}
      </div>
      <h3 className={styles.cardTitle} id={titleId}>
        {title}
      </h3>
      {short_description ? <p className={styles.cardDescription}>{short_description}</p> : null}
      <CurrentEdition current={current} latest={latest} />
      <dl className={styles.cardStats}>
        <div>
          <dt>Ediciones</dt>
          <dd>{editionCount}</dd>
        </div>
        <div>
          <dt>Veces dictado</dt>
          <dd>{timesTaught}</dd>
        </div>
        <div>
          <dt>Alumnos pagos</dt>
          <dd>{paidCount}</dd>
        </div>
        <div>
          <dt>Clases por edición</dt>
          <dd>{classesPerEdition}</dd>
        </div>
      </dl>
      {reviewCount > 0 && avgRating ? (
        <p className={styles.cardRating}>
          <StarRating readOnly size="sm" value={avgRating} />
          {formatRating(avgRating)} ({plural(reviewCount, "reseña", "reseñas")})
        </p>
      ) : (
        <p className={styles.cardRating}>Sin reseñas</p>
      )}
      <div className={styles.cardFooter}>
        <PrimaryLink aria-label={`Ver curso ${title}`} dark href={`/dashboard/courses/${_id}`} text="Ver curso" />
        <IconLink
          aria-label={`Nueva edición de ${title}`}
          asButton
          className={styles.newEdition}
          icon="Plus"
          onClick={() => onNewEdition(course)}
          success
          text="Nueva edición"
          title={`Crear una nueva edición de ${title}`}
        />
      </div>
    </article>
  );
};

export default AdminCourseCard;
