"use client";

import ClassStatusBadge from "@/views/components/ui/ClassStatusBadge";
import CourseForm from "@/views/sections/pages/dashboard/courses/CourseForm";
import IconLink from "@/views/components/ui/IconLink";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import StatusBadge from "@/views/components/ui/StatusBadge";
import styles from "../styles.module.css";
import { formatDate } from "@/utils/dates";
import { getCourseTimeStatus } from "@/utils/classStatus";
import { runApiAction } from "@/utils/api";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmDeleteItem, confirmToggleStatus } from "@/utils/alerts";
import { deleteCourseAction, setCourseStatusAction } from "@/server/actions/courses";

/**
 * Admin view: every course with enrollment/payment counts and publish/delete actions.
 * The data comes from the server; each Server Action re-renders the page with fresh data.
 */
const AdminCoursesView = ({ courses }) => {
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleToggleStatus = async (course) => {
    const status = course.status === "published" ? "draft" : "published";
    if (!(await confirmToggleStatus(status, "curso")).isConfirmed) return;
    await runApiAction({
      loading: ["Procesando tu solicitud", "Cambiando estado..."],
      request: () => setCourseStatusAction(course._id, status),
      success: ["Operación exitosa", status === "published" ? "Curso publicado" : "Curso ocultado"],
      failure: "No se pudo cambiar el estado",
    });
  };

  const handleDelete = async (course) => {
    if (!(await confirmDeleteItem("curso", course.title)).isConfirmed) return;
    await runApiAction({
      loading: ["Procesando tu solicitud", "Eliminando curso..."],
      request: () => deleteCourseAction(course._id),
      success: ["Operación exitosa", "Curso eliminado"],
      failure: "No se pudo eliminar el curso",
    });
  };

  return (
    <div className={styles.container}>
      <h1>Gestión de Cursos</h1>
      <div className={styles.listSection}>
        <h2>Todos los Cursos</h2>
        {courses.length === 0 ? (
          <p className={styles.noClasses}>No hay cursos disponibles</p>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Clases</th>
                  <th>Precio</th>
                  <th>Participantes</th>
                  <th>Pagos</th>
                  <th>Progreso</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => {
                  const published = course.status === "published";
                  return (
                    <tr key={course._id}>
                      <td>{course.title}</td>
                      <td>{course.start_date ? formatDate(course.start_date) : "—"}</td>
                      <td>{course.end_date ? formatDate(course.end_date) : "—"}</td>
                      <td>{course.amount_of_classes ?? 0}</td>
                      <td>${course.price}</td>
                      <td>
                        {course.enrolledCount ?? 0} / {course.max_participants || "∞"}
                      </td>
                      <td>
                        {course.paidCount ?? 0} / {course.enrolledCount ?? 0}
                      </td>
                      <td>
                        {course.start_date ? (
                          <ClassStatusBadge
                            gender="m"
                            status={getCourseTimeStatus(course.start_date, course.end_date, course.status)}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <StatusBadge status={course.status}>
                          {published ? "Publicado" : "Borrador"}
                        </StatusBadge>
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          <IconLink
                            fill="var(--color-4)"
                            href={`/dashboard/courses/${course._id}`}
                            icon="Eye"
                            title="Ver detalles"
                          />
                          <IconLink
                            asButton
                            danger={published}
                            icon={published ? "Pin" : "Confetti"}
                            success={!published}
                            onClick={() => handleToggleStatus(course)}
                            title={published ? "Ocultar" : "Publicar"}
                          />
                          <IconLink
                            asButton
                            danger
                            disabled={course.status !== "draft"}
                            icon="Delete"
                            onClick={() => handleDelete(course)}
                            title={
                              course.status !== "draft"
                                ? "Solo se pueden eliminar cursos archivados"
                                : "Eliminar"
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <PrimaryLink
          asButton
          dark
          text={showCreateForm ? "Cancelar" : "+ Nuevo Curso"}
          onClick={() => setShowCreateForm((open) => !open)}
        />
      </div>

      {showCreateForm && (
        <div className={styles.formSection}>
          <CourseForm
            onCancel={() => setShowCreateForm(false)}
            onSuccess={() => {
              setShowCreateForm(false);
              router.refresh();
            }}
          />
        </div>
      )}
    </div>
  );
};

export default AdminCoursesView;
