"use client";

import CourseClassesSection from "../../../_components/CourseClassesSection";
import CourseReviewsSection from "../../../_components/CourseReviewsSection";
import EditionBreadcrumb from "./EditionBreadcrumb";
import EditionInfoSection from "./EditionInfoSection";
import EnrollmentsSection from "../../../_components/EnrollmentsSection";
import IconLink from "@/views/components/ui/IconLink";
import { editionName } from "@/utils/courseEditions";
import { runApiAction } from "@/utils/api";
import styles from "../../../styles.module.css";
import { useState } from "react";
import { confirmDeleteEdition, confirmEditionStatus } from "@/utils/alerts";
import { createEditionAction, deleteEditionAction, setEditionStatusAction } from "@/server/actions/courses";
import { usePathname, useRouter } from "next/navigation";

/**
 * Admin detail of one edition: its data and lifecycle, classes, enrollees with their
 * payment status and its own reviews (server-side pages, ?page=). Opened with ?edit=1
 * the price and capacity form starts open; closing it drops `edit` from the URL.
 * Data comes from the server; every action re-renders it.
 */
const EditionDetailView = ({ edition, classes, enrollments, reviews, initialEditMode = false }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [editing, setEditing] = useState(initialEditMode);
  const { course } = edition;
  const title = editionName(course.title, edition.label);
  const courseHref = `/dashboard/courses/${course._id}`;

  // Opened with ?edit=1 (from the editions table): drop it so a reload doesn't reopen the form
  const closeEdit = () => {
    setEditing(false);
    if (new URLSearchParams(window.location.search).has("edit")) {
      router.replace(pathname, { scroll: false });
    }
  };

  const handleToggleStatus = async () => {
    const status = edition.status === "published" ? "draft" : "published";
    if (!(await confirmEditionStatus(status, title)).isConfirmed) return;
    await runApiAction({
      loading: ["Procesando tu solicitud", "Cambiando estado..."],
      request: () => setEditionStatusAction(edition._id, status),
      success: ["Operación exitosa", status === "published" ? "Edición publicada" : "Edición despublicada"],
      failure: "No se pudo cambiar el estado de la edición",
    });
  };

  const handleDelete = async () => {
    if (!(await confirmDeleteEdition(title, edition.enrollmentCount ?? 0)).isConfirmed) return;
    const res = await runApiAction({
      loading: ["Procesando tu solicitud", "Eliminando edición..."],
      request: () => deleteEditionAction(edition._id),
      success: ["Operación exitosa", "Edición eliminada"],
      failure: "No se pudo eliminar la edición",
    });
    if (res) router.push(courseHref);
  };

  const handleNewEdition = async () => {
    const res = await runApiAction({
      loading: ["Procesando tu solicitud", "Creando nueva edición..."],
      request: () => createEditionAction(course._id),
      success: ["Edición creada", "Se creó una nueva edición en borrador"],
      failure: "No se pudo crear la edición",
    });
    if (res) router.push(`${courseHref}/editions/${res.data._id}`);
  };

  return (
    <div className={styles.container}>
      <EditionBreadcrumb
        adminNumber={edition.adminNumber}
        course={course}
        editionCount={edition.editionCount}
        label={edition.label}
      />
      <div className={styles.header}>
        <h1>{title}</h1>
        <IconLink fill="var(--color-4)" href={courseHref} icon="Back" title="Volver al curso" />
      </div>

      <EditionInfoSection
        classes={classes}
        courseStatus={course.status}
        edition={edition}
        editing={editing}
        onCloseEdit={closeEdit}
        onDelete={handleDelete}
        onEdit={() => setEditing(true)}
        onNewEdition={handleNewEdition}
        onSaved={() => {
          closeEdit();
          router.refresh();
        }}
        onToggleStatus={handleToggleStatus}
      />
      <CourseClassesSection classes={classes} />
      <EnrollmentsSection edition={edition} enrollments={enrollments} title={title} />
      <CourseReviewsSection
        avgRating={edition.avgRating}
        emptyText={
          edition.timeStatus === "completed"
            ? "Todavía no hay reseñas de esta edición."
            : "Los alumnos con pago confirmado van a poder reseñarla cuando finalice."
        }
        reviewCount={edition.reviewCount}
        reviews={reviews}
      />
    </div>
  );
};

export default EditionDetailView;
