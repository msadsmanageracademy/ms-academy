import CourseSignUpButton from "./_components/CourseSignUpButton";
import { HttpError } from "@/server/errors";
import PageWrapper from "@/views/components/layout/PageWrapper";
import PaymentInstructions from "@/views/components/ui/PaymentInstructions";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import { cache } from "react";
import { formatDateTime } from "@/utils/dates";
import { getActor } from "@/lib/api/guards";
import { getCourseDetail } from "@/server/courses/service";
import { getCourseTimeStatus } from "@/utils/classStatus";
import { listCourseReviews } from "@/server/reviews/service";
import { notFound } from "next/navigation";
import styles from "./styles.module.css";
import ReviewList, { ReviewSummary } from "@/views/components/ui/ReviewList";

const STATUS_LABELS = { completed: "Finalizado", "in-progress": "En progreso", upcoming: "Por comenzar" };

const loadCourse = cache(async (id) => {
  const actor = await getActor();
  try {
    return { actor, course: await getCourseDetail(actor, id) };
  } catch (error) {
    if (error instanceof HttpError && (error.status === 400 || error.status === 404)) {
      return { actor, course: null };
    }
    throw error;
  }
});

export async function generateMetadata({ params }) {
  const { id } = await params;
  const { course } = await loadCourse(id);
  // The page itself calls notFound(): calling it here would render the 404 outside the layout
  if (!course) return { title: "Curso no encontrado | MS Academy" };
  return { title: `${course.title} | MS Academy`, description: course.short_description };
}

const durationLabel = (minutes) =>
  minutes < 60 ? `${minutes} minutos` : `${parseFloat((minutes / 60).toFixed(1))} horas`;

function EnrollAction({ course, timeStatus, isFull, viewerRole }) {
  if (viewerRole === "admin") return <PrimaryLink href="/dashboard/courses" text="Ir a Cursos" />;
  if (course.userPaymentStatus === "paid") return <PrimaryLink disabled text="Ya estás inscripto" />;
  if (course.userPaymentStatus === "pending") {
    return <PrimaryLink disabled text="Inscripción pendiente de pago" />;
  }
  if (timeStatus === "in-progress") return <PrimaryLink disabled text="Curso en progreso" />;
  if (isFull) return <PrimaryLink disabled text="Cupo completo" />;
  return <CourseSignUpButton courseId={course._id.toString()} viewerRole={viewerRole} />;
}

const InfoItem = ({ label, children }) => (
  <div className={styles.infoItem}>
    <div className={styles.infoLabel}>{label}</div>
    <div className={styles.infoValue}>{children}</div>
  </div>
);

// Server Component: the course and its reviews are in the HTML (indexable)
export default async function CourseDetailPage({ params }) {
  const { id } = await params;
  const { actor, course } = await loadCourse(id);
  if (!course) notFound();

  // Reviews of every iteration of the course
  const reviews = await listCourseReviews(id, { series: true });
  const enrollmentCount = course.enrollmentCount ?? 0;
  const isFull = course.max_participants != null && enrollmentCount >= course.max_participants;
  const timeStatus = getCourseTimeStatus(course.start_date, course.end_date, course.status);

  return (
    <PageWrapper>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>{course.title}</h1>
        </div>

        <div className={styles.section}>
          <div className={styles.subtitle}>Resumen</div>
          <div className={styles.description}>{course.short_description}</div>
        </div>

        <div className={styles.section}>
          <div className={styles.subtitle}>Descripción completa</div>
          <div className={styles.description}>{course.full_description}</div>
        </div>

        <div className={styles.infoGrid}>
          <InfoItem label="Fecha de inicio">
            {course.start_date ? formatDateTime(course.start_date) : "No disponible"}
          </InfoItem>
          <InfoItem label="Fecha de finalización">
            {course.end_date ? formatDateTime(course.end_date) : "No disponible"}
          </InfoItem>
          <InfoItem label="Cantidad de clases">{course.amount_of_classes}</InfoItem>
          <InfoItem label="Duración total">{durationLabel(course.total_duration)}</InfoItem>
          <InfoItem label="Cupo">
            {course.max_participants
              ? `${enrollmentCount} / ${course.max_participants} inscriptos${isFull ? " — Lleno" : ""}`
              : "Sin límite"}
          </InfoItem>
          {STATUS_LABELS[timeStatus] && <InfoItem label="Estado">{STATUS_LABELS[timeStatus]}</InfoItem>}
          <InfoItem label="Precio">${course.price}</InfoItem>
        </div>

        <div className={styles.actionsContainer}>
          <EnrollAction
            course={course}
            timeStatus={timeStatus}
            isFull={isFull}
            viewerRole={actor?.role ?? null}
          />
        </div>

        {course.userPaymentStatus === "pending" && (
          <PaymentInstructions
            courses={[{ _id: course._id.toString(), title: course.title, price: course.price }]}
          />
        )}

        <div className={styles.section}>
          <div className={styles.subtitle}>
            Reseñas
            <ReviewSummary
              className={styles.reviewSummary}
              avgRating={course.avgRating}
              reviewCount={course.reviewCount}
            />
          </div>
          <ReviewList
            reviews={reviews}
            emptyText="Todavía no hay reseñas para este curso."
          />
        </div>
      </div>
    </PageWrapper>
  );
}
