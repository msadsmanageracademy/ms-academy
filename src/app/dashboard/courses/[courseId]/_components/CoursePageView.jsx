"use client";

import CourseForm from "@/views/sections/pages/dashboard/courses/CourseForm";
import CourseInfoSection from "./CourseInfoSection";
import CourseMetrics from "./CourseMetrics";
import CourseReviewsSection from "./CourseReviewsSection";
import EditionsTable from "./EditionsTable";
import IconLink from "@/views/components/ui/IconLink";
import Link from "next/link";
import styles from "../styles.module.css";
import { runApiAction } from "@/utils/api";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmCourseStatus, confirmDeleteItem } from "@/utils/alerts";
import { createEditionAction, deleteCourseAction, setCourseStatusAction } from "@/server/actions/courses";

/**
 * Admin page of a course (the product): its content, the figures of all its editions,
 * the editions table and the reviews of every edition. Data comes from the server;
 * every action re-renders it (or leaves the page when the course is deleted).
 */
const CoursePageView = ({ course, reviews, reviewEditionId = null }) => {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const { editions, metrics } = course;
  const filtered = reviewEditionId ? editions.find((e) => e._id === reviewEditionId) : null;

  const handleToggleStatus = async () => {
    const status = course.status === "archived" ? "active" : "archived";
    if (!(await confirmCourseStatus(status, course.title)).isConfirmed) return;
    await runApiAction({
      loading: ["Procesando tu solicitud", "Cambiando estado..."],
      request: () => setCourseStatusAction(course._id, status),
      success: ["Operación exitosa", status === "archived" ? "Curso archivado" : "Curso reactivado"],
      failure: "No se pudo cambiar el estado del curso",
    });
  };

  const handleDelete = async () => {
    if (!(await confirmDeleteItem("curso", course.title)).isConfirmed) return;
    const res = await runApiAction({
      loading: ["Procesando tu solicitud", "Eliminando curso..."],
      request: () => deleteCourseAction(course._id),
      success: ["Operación exitosa", "Curso eliminado"],
      failure: "No se pudo eliminar el curso",
    });
    if (res) router.push("/dashboard/courses");
  };

  const handleNewEdition = async () => {
    const res = await runApiAction({
      loading: ["Procesando tu solicitud", "Creando nueva edición..."],
      request: () => createEditionAction(course._id),
      success: ["Edición creada", "Se creó una nueva edición en borrador"],
      failure: "No se pudo crear la edición",
    });
    if (res) router.push(`/dashboard/courses/${course._id}/editions/${res.data._id}`);
  };

  return (
    <div className={styles.container}>
      <nav aria-label="Ubicación" className={styles.breadcrumb}>
        <ol className={styles.breadcrumbList}>
          <li>
            <Link href="/dashboard/courses">Cursos</Link>
          </li>
          <li aria-current="page">{course.title}</li>
        </ol>
      </nav>
      <div className={styles.header}>
        <h1>{course.title}</h1>
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
        <section aria-labelledby="edit-course-title" className={styles.section}>
          <h2 className={styles.formTitle} id="edit-course-title">
            Editar curso
          </h2>
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
          <CourseInfoSection
            course={course}
            hasEnrollments={metrics.enrolledCount > 0}
            onDelete={handleDelete}
            onEdit={() => setEditMode(true)}
            onToggleStatus={handleToggleStatus}
          />
          <CourseMetrics metrics={metrics} />
          <EditionsTable courseId={course._id} editions={editions} onNewEdition={handleNewEdition} />
          <CourseReviewsSection
            avgRating={filtered ? filtered.avgRating : metrics.avgRating}
            editions={editions}
            emptyText={
              filtered ? "Todavía no hay reseñas de esta edición." : "Todavía no hay reseñas en ninguna edición."
            }
            reviewCount={filtered ? filtered.reviewCount : metrics.reviewCount}
            reviews={reviews}
            selectedEditionId={reviewEditionId}
          />
        </>
      )}
    </div>
  );
};

export default CoursePageView;
