"use client";

import PageLoader from "@/views/components/layout/PageLoader";
import PageWrapper from "@/views/components/layout/PageWrapper";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";
import { useSession } from "next-auth/react";
import { confirmSignUp, toastError, toastSuccess } from "@/utils/alerts";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const CourseDetail = () => {
  const { data: session } = useSession();

  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const response = await fetch(`/api/courses/${id}`);
        const result = await response.json();
        if (!response.ok)
          return toastError(
            3000,
            "Error al recuperar el curso",
            result.message
          );
        setCourse(result.data);
      } catch (err) {
        toastError(3000, "Error al cargar el curso", err);
        router.push("/content");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchCourse();
  }, [id]);

  const courseSignUp = async (id) => {
    try {
      if (!session) {
        return toastError(
          3000,
          "Error al inscribirse",
          "Para inscribirse, primero debe iniciar sesión"
        );
      }

      const result = await confirmSignUp(
        "¿Inscribirse a este curso?",
        "Confirma que deseas inscribirte a este curso"
      );

      if (!result.isConfirmed) return;

      const response = await fetch(`/api/courses/sign-up/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });

      const responseData = await response.json();

      if (!response.ok)
        return toastError(3000, "Error al inscribirse", responseData.message);

      toastSuccess(3000, "Inscripción exitosa", responseData.message);
      router.push("/dashboard/courses");
    } catch (error) {
      return toastError(
        3000,
        "Error al inscribirse",
        "Hubo un problema inesperado al procesar tu inscripción"
      );
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  if (!course) return <p>No se encontró el curso</p>;

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
                ? new Date(course.start_date).toLocaleString("es-AR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "No disponible"}
            </div>
          </div>

          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Fecha de finalización</div>
            <div className={styles.infoValue}>
              {course.end_date
                ? new Date(course.end_date).toLocaleString("es-AR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "No disponible"}
            </div>
          </div>

          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Cantidad de clases</div>
            <div className={styles.infoValue}>{course.amount_of_classes}</div>
          </div>

          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Duración total</div>
            <div className={styles.infoValue}>{course.duration / 60} horas</div>
          </div>

          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Cupo máximo</div>
            <div className={styles.infoValue}>
              {course.max_participants} personas
            </div>
          </div>

          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Precio</div>
            <div className={styles.infoValue}>${course.price}</div>
          </div>
        </div>

        <div className={styles.actionsContainer}>
          {session?.user?.role === "admin" ? (
            <PrimaryLink href={`/dashboard/courses`} text={"Ir a Cursos"} />
          ) : (
            <PrimaryLink
              asButton
              text={"Inscribirse"}
              onClick={() => courseSignUp(course._id)}
            />
          )}
        </div>
      </div>
    </PageWrapper>
  );
};

export default CourseDetail;
