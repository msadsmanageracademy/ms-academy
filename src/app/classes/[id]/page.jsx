"use client";

import OvalSpinner from "@/components/spinners/OvalSpinner";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toastError } from "@/utils/alerts";
import styles from "./styles.module.css";

const CourseDetail = () => {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const response = await fetch(`/api/events/${id}`);

        const result = await response.json();

        console.log(response);

        console.log(result);

        if (!response.ok)
          return toastError(
            3000,
            "Error al recuperar el curso",
            result.message
          );

        setCourse(result.data);
      } catch (err) {
        toastError(3000, "Error al cargar el curso", err);
        router.push("/classes"); // Redirige si hay error
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchCourse();
  }, [id]);

  if (loading) {
    return (
      <div className={styles.container}>
        <OvalSpinner />
      </div>
    );
  }

  if (!course) return <p>No se encontró el curso</p>;

  console.log(course);

  return (
    <div className={styles.container}>
      <div className={styles.text}>
        <div>
          <div className={styles.subtitle}>Título</div>
          <div>{course.title}</div>
        </div>
        <div>
          <div className={styles.subtitle}>Resumen</div>
          <div className={styles.description}>{course.short_description}</div>
        </div>
        <div>
          <div className={styles.subtitle}>Descripción completa</div>
          <div className={styles.description}>{course.full_description}</div>
        </div>
        <div>
          <span>Inicia: </span>
          {course.start_date
            ? new Date(course.start_date).toLocaleString("es-AR", {
                year: "numeric",
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "No se puede mostrar la fecha"}
        </div>
        <div>
          <span>Finaliza: </span>
          {course.end_date
            ? new Date(course.end_date).toLocaleString("es-AR", {
                year: "numeric",
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "No se puede mostrar la fecha"}
        </div>
        <div>
          <span>Cantidad de clases: </span>
          {course.amount_of_classes}
        </div>
        <div>
          <span>Duración total: </span>
          {course.duration / 60} horas
        </div>
        <div>
          <span>Cupo: </span>
          {course.max_participants} personas
        </div>
        <button className={`button-primary ${styles.button}`}>
          Inscribirse
        </button>
      </div>
    </div>
  );
};

export default CourseDetail;
