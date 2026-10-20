import CourseSignUpButton from "./CourseSignUpButton";
import PaymentInstructions from "@/views/components/ui/PaymentInstructions";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import ReviewsPagination from "./ReviewsPagination";
import styles from "../styles.module.css";
import { editionName } from "@/utils/courseEditions";
import { formatDateTime } from "@/utils/dates";
import { formatPrice } from "@/utils/price";
import ReviewList, { ReviewSummary } from "@/views/components/ui/ReviewList";

const STATUS_LABELS = { "in-progress": "En curso", upcoming: "Por comenzar" };

const durationLabel = (minutes = 0) =>
  minutes < 60 ? `${minutes} minutos` : `${parseFloat((minutes / 60).toFixed(1))} horas`;

function EnrollAction({ course, edition, isFull, viewerRole }) {
  if (viewerRole === "admin") {
    return <PrimaryLink href={`/dashboard/courses/${course._id}`} text="Gestionar curso" />;
  }
  if (edition.userPaymentStatus === "paid") return <PrimaryLink disabled text="Ya estás inscripto" />;
  if (edition.userPaymentStatus === "pending") {
    return <PrimaryLink disabled text="Inscripción pendiente de pago" />;
  }
  if (edition.timeStatus === "in-progress") return <PrimaryLink disabled text="En curso: inscripción cerrada" />;
  if (isFull) return <PrimaryLink disabled text="Cupo completo" />;
  return (
    <CourseSignUpButton
      courseId={course._id}
      editionId={edition._id}
      editionTitle={editionName(course.title, edition.label)}
      viewerRole={viewerRole}
    />
  );
}

const InfoItem = ({ label, children }) => (
  <div className={styles.infoItem}>
    <dt className={styles.infoLabel}>{label}</dt>
    <dd className={styles.infoValue}>{children}</dd>
  </div>
);

function EditionInfo({ edition }) {
  const enrollmentCount = edition.enrollmentCount ?? 0;
  const isFull = edition.max_participants != null && enrollmentCount >= edition.max_participants;
  return (
    <dl className={styles.infoGrid}>
      <InfoItem label="Fecha de inicio">
        {edition.start_date ? formatDateTime(edition.start_date) : "No disponible"}
      </InfoItem>
      <InfoItem label="Fecha de finalización">
        {edition.end_date ? formatDateTime(edition.end_date) : "No disponible"}
      </InfoItem>
      <InfoItem label="Cantidad de clases">{edition.amount_of_classes ?? 0}</InfoItem>
      <InfoItem label="Duración total">{durationLabel(edition.total_duration)}</InfoItem>
      <InfoItem label="Cupo">
        {edition.max_participants
          ? `${enrollmentCount} / ${edition.max_participants} inscriptos${isFull ? " (completo)" : ""}`
          : "Sin límite"}
      </InfoItem>
      {STATUS_LABELS[edition.timeStatus] && (
        <InfoItem label="Estado">{STATUS_LABELS[edition.timeStatus]}</InfoItem>
      )}
      <InfoItem label="Precio">{formatPrice(edition.price)}</InfoItem>
    </dl>
  );
}

/**
 * Public course page: the course (the product), the edition open to enrollment (or a
 * notice when there is none) and one page of the reviews of every edition.
 * `course` comes from getCourseDetail and `reviews` = { items, page, totalPages, total }
 * from listCourseReviews.
 */
const PublicCourseView = ({ course, reviews, viewerRole }) => {
  const edition = course.openEdition;
  const isFull =
    edition?.max_participants != null && (edition.enrollmentCount ?? 0) >= edition.max_participants;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{course.title}</h1>
      </div>

      <section aria-labelledby="course-summary-title" className={styles.section}>
        <h2 className={styles.subtitle} id="course-summary-title">
          Resumen
        </h2>
        <p className={styles.description}>{course.short_description}</p>
      </section>

      <section aria-labelledby="course-description-title" className={styles.section}>
        <h2 className={styles.subtitle} id="course-description-title">
          Descripción completa
        </h2>
        <p className={styles.description}>{course.full_description}</p>
      </section>

      <section aria-labelledby="course-edition-title" className={styles.section}>
        <h2 className={styles.subtitle} id="course-edition-title">
          {edition ? `Próxima edición: ${edition.label}` : "Próxima edición"}
        </h2>
        {edition ? (
          <EditionInfo edition={edition} />
        ) : (
          <p className={styles.description}>
            Por ahora no hay una edición abierta a inscripción. Escribime para enterarte de la próxima.
          </p>
        )}
      </section>

      <div className={styles.actionsContainer}>
        {edition ? (
          <EnrollAction course={course} edition={edition} isFull={isFull} viewerRole={viewerRole} />
        ) : viewerRole === "admin" ? (
          <PrimaryLink href={`/dashboard/courses/${course._id}`} text="Gestionar curso" />
        ) : (
          <PrimaryLink dark href="/contact" text="Ir a Contacto" />
        )}
      </div>

      {edition?.userPaymentStatus === "pending" && (
        <PaymentInstructions
          courses={[{ _id: edition._id, title: editionName(course.title, edition.label), price: edition.price }]}
        />
      )}

      <section aria-labelledby="course-reviews-title" className={styles.section}>
        <h2 className={styles.subtitle} id="course-reviews-title">
          Reseñas
          <ReviewSummary
            avgRating={course.avgRating}
            className={styles.reviewSummary}
            reviewCount={course.reviewCount}
          />
        </h2>
        <ReviewList emptyText="Todavía no hay reseñas para este curso." reviews={reviews.items} />
        <ReviewsPagination page={reviews.page} totalPages={reviews.totalPages} />
      </section>
    </div>
  );
};

export default PublicCourseView;
