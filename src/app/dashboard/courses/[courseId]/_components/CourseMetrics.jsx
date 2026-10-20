import StarRating from "@/views/components/ui/StarRating";
import { formatAmount } from "@/utils/price";
import { formatRating } from "@/views/components/ui/ReviewList";
import styles from "../styles.module.css";


const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/**
 * Course-wide figures (Requirement 7.1): every value combines all the editions of the
 * course, as computed by getAdminCourse.
 */
const CourseMetrics = ({ metrics }) => {
  const {
    avgRating,
    classesPerEdition = 0,
    editionCount = 0,
    enrolledCount = 0,
    estimatedRevenue = 0,
    paidCount = 0,
    reviewCount = 0,
    timesTaught = 0,
  } = metrics;

  return (
    <section aria-labelledby="course-metrics-title" className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 id="course-metrics-title">Métricas del curso</h2>
        <span className={styles.sectionHint}>Todas las ediciones</span>
      </div>
      <dl className={styles.metricsGrid}>
        <div className={styles.metric}>
          <dt>Ediciones</dt>
          <dd>{editionCount}</dd>
        </div>
        <div className={styles.metric}>
          <dt>Veces dictado</dt>
          <dd>{timesTaught}</dd>
        </div>
        <div className={styles.metric}>
          <dt>Alumnos inscriptos</dt>
          <dd>{enrolledCount}</dd>
        </div>
        <div className={styles.metric}>
          <dt>Alumnos pagos</dt>
          <dd>{paidCount}</dd>
        </div>
        <div className={styles.metric}>
          <dt>Ingreso estimado</dt>
          <dd>{formatAmount(estimatedRevenue)}</dd>
        </div>
        <div className={styles.metric}>
          <dt>Clases por edición</dt>
          <dd>{classesPerEdition}</dd>
        </div>
        <div className={`${styles.metric} ${styles.metricWide}`}>
          <dt>Promedio de reseñas</dt>
          <dd>
            {reviewCount > 0 && avgRating ? (
              <span className={styles.metricRating}>
                <StarRating readOnly size="sm" value={avgRating} />
                {formatRating(avgRating)}
                <span className={styles.metricNote}>({plural(reviewCount, "reseña", "reseñas")})</span>
              </span>
            ) : (
              "Sin reseñas"
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
};

export default CourseMetrics;
