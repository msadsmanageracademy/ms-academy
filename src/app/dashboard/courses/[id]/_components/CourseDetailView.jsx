"use client";

import CourseClassesSection from "./CourseClassesSection";
import CourseForm from "@/views/sections/pages/dashboard/courses/CourseForm";
import CourseInfoSection from "./CourseInfoSection";
import EnrollmentsSection from "./EnrollmentsSection";
import IconLink from "@/views/components/ui/IconLink";
import { cloneCourseAction } from "@/server/actions/courses";
import { runApiAction } from "@/utils/api";
import styles from "../styles.module.css";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ReviewList, { ReviewSummary, averageRating } from "@/views/components/ui/ReviewList";

/** Admin course detail. Data comes from the server; actions re-render it. */
const CourseDetailView = ({ course, classes, enrollments, reviews }) => {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);

  const handleClone = async () => {
    const res = await runApiAction({
      loading: ["Procesando", "Creando nueva iteración del curso..."],
      request: () => cloneCourseAction(course._id),
      success: ["Curso duplicado", "Se creó un borrador listo para editar"],
      failure: "No se pudo duplicar el curso",
    });
    if (res) router.push(`/dashboard/courses/${res.data._id}`);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Detalles del Curso</h1>
        <IconLink
          asButton={editMode}
          fill="var(--color-4)"
          href={editMode ? undefined : "/dashboard/courses"}
          icon="Back"
          onClick={editMode ? () => setEditMode(false) : undefined}
          title="Volver"
        />
      </div>

      {editMode ? (
        <section className={styles.section}>
          <h2 className={styles.formTitle}>Editar Curso</h2>
          <CourseForm
            courseData={course}
            onCancel={() => setEditMode(false)}
            onSuccess={() => {
              setEditMode(false);
              router.refresh();
            }}
          />
        </section>
      ) : (
        <>
          <CourseInfoSection course={course} onEdit={() => setEditMode(true)} onClone={handleClone} />
          <CourseClassesSection classes={classes} />
          <EnrollmentsSection course={course} enrollments={enrollments} />
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>
                Reseñas
                <ReviewSummary avgRating={averageRating(reviews)} reviewCount={reviews.length} />
              </h2>
            </div>
            <ReviewList reviews={reviews} emptyText="Todavía no hay reseñas para este curso." />
          </section>
        </>
      )}
    </div>
  );
};

export default CourseDetailView;
