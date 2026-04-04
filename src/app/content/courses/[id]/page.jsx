"use client";

import PageLoader from "@/views/components/layout/PageLoader";
import PageWrapper from "@/views/components/layout/PageWrapper";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import StarRating from "@/views/components/ui/StarRating";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import styles from "./styles.module.css";
import { getCourseTimeStatus } from "@/utils/classStatus";
import { useSession } from "next-auth/react";
import {
  closeLoading,
  confirmSignUp,
  toastError,
  toastLoading,
  toastSuccess,
} from "@/utils/alerts";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const CourseDetail = () => {
  const { data: session } = useSession();

  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const response = await fetch(`/api/courses/${id}`);
        const result = await response.json();
        if (!response.ok)
          return toastError(3000, "Ha habido un error", result.message);
        setCourse(result.data);
      } catch (err) {
        toastError(3000, "Ha habido un error", err);
        router.push("/content");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchCourse();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/courses/${id}/reviews?series=true`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setReviews(data.data);
      })
      .catch(() => {});
  }, [id]);

  const courseSignUp = async (id) => {
    try {
      if (!session) {
        return toastError(
          3000,
          "Ha habido un error",
          "Para inscribirse, primero debe iniciar sesión",
        );
      }

      if (session.user.role === "admin") {
        return toastError(
          3000,
          "Acción no permitida",
          "Admins no pueden inscribirse a cursos",
        );
      }

      const result = await confirmSignUp(
        "¿Inscribirse a este curso?",
        "Confirma que deseas inscribirte a este curso",
      );

      if (!result.isConfirmed) return;

      toastLoading("Procesando tu solicitud", "Inscribiéndote al curso...");

      const response = await fetch(`/api/courses/sign-up/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });

      const responseData = await response.json();

      closeLoading();

      if (!response.ok)
        return toastError(3000, "Ha habido un error", responseData.message);

      toastSuccess(3000, "Inscripción exitosa", responseData.message);
      router.push("/dashboard/courses");
    } catch (error) {
      closeLoading();
      return toastError(
        3000,
        "Ha habido un error",
        "Problema inesperado al procesar tu inscripción",
      );
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  if (!course) return <p>No se encontró el curso</p>;

  const enrollmentCount = Object.keys(course.enrollmentMap || {}).length;
  const isFull =
    course.max_participants !== null &&
    course.max_participants !== undefined &&
    enrollmentCount >= course.max_participants;
  const courseTimeStatus = getCourseTimeStatus(
    course.start_date,
    course.end_date,
    course.status,
  );
  const courseStatusLabel =
    courseTimeStatus === "completed"
      ? "Finalizado"
      : courseTimeStatus === "in-progress"
        ? "En progreso"
        : courseTimeStatus === "upcoming"
          ? "Por comenzar"
          : null;

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
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Fecha de inicio</div>
            <div className={styles.infoValue}>
              {course.start_date
                ? format(new Date(course.start_date), "dd/MM/yyyy, h:mm a")
                : "No disponible"}
            </div>
          </div>

          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Fecha de finalización</div>
            <div className={styles.infoValue}>
              {course.end_date
                ? format(new Date(course.end_date), "dd/MM/yyyy, h:mm a")
                : "No disponible"}
            </div>
          </div>

          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Cantidad de clases</div>
            <div className={styles.infoValue}>{course.amount_of_classes}</div>
          </div>

          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Duración total</div>
            <div className={styles.infoValue}>
              {course.total_duration < 60
                ? `${course.total_duration} minutos`
                : `${parseFloat((course.total_duration / 60).toFixed(1))} horas`}
            </div>
          </div>

          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Cupo</div>
            <div className={styles.infoValue}>
              {course.max_participants
                ? `${enrollmentCount} / ${course.max_participants} inscriptos${isFull ? " — Lleno" : ""}`
                : "Sin límite"}
            </div>
          </div>

          {courseStatusLabel && (
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Estado</div>
              <div className={styles.infoValue}>{courseStatusLabel}</div>
            </div>
          )}

          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Precio</div>
            <div className={styles.infoValue}>${course.price}</div>
          </div>
        </div>

        <div className={styles.actionsContainer}>
          {session?.user?.role === "admin" ? (
            <PrimaryLink href={`/dashboard/courses`} text={"Ir a Cursos"} />
          ) : course.userPaymentStatus === "paid" ? (
            <PrimaryLink disabled text={"Ya estás inscripto"} />
          ) : course.userPaymentStatus === "pending" ? (
            <PrimaryLink disabled text={"Inscripción pendiente de pago"} />
          ) : courseTimeStatus === "in-progress" ? (
            <PrimaryLink disabled text={"Curso en progreso"} />
          ) : isFull ? (
            <PrimaryLink disabled text={"Cupo completo"} />
          ) : (
            <PrimaryLink
              asButton
              dark
              text={"Inscribirse"}
              onClick={() => courseSignUp(course._id)}
            />
          )}
        </div>

        {/* Reviews section */}
        <div className={styles.section}>
          <div className={styles.subtitle}>
            Reseñas
            {course.reviewCount > 0 && (
              <span className={styles.reviewSummary}>
                <StarRating
                  value={Math.round(course.avgRating)}
                  readOnly
                  size="sm"
                />
                {course.avgRating} ({course.reviewCount})
              </span>
            )}
          </div>

          {/* Reviews list */}
          {reviews.length === 0 ? (
            <p className={styles.noReviews}>
              Todavía no hay reseñas para este curso.
            </p>
          ) : (
            <ul className={styles.reviewList}>
              {reviews.map((r) => (
                <li key={r._id?.toString()} className={styles.reviewItem}>
                  <div className={styles.reviewHeader}>
                    <span className={styles.reviewAuthor}>{r.firstName}</span>
                    <StarRating value={r.rating} readOnly size="sm" />
                    <span className={styles.reviewDate}>
                      {format(new Date(r.createdAt), "dd/MM/yyyy", {
                        locale: es,
                      })}
                    </span>
                  </div>
                  {r.comment && (
                    <p className={styles.reviewComment}>{r.comment}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageWrapper>
  );
};

export default CourseDetail;
