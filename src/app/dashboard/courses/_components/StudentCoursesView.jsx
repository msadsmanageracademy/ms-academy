"use client";

import ClassStatusBadge from "@/views/components/ui/ClassStatusBadge";
import IconLink from "@/views/components/ui/IconLink";
import PaymentInstructions from "@/views/components/ui/PaymentInstructions";
import Pagination from "@/views/components/ui/Pagination";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import ReviewModal from "@/views/components/ui/ReviewModal";
import StatusBadge from "@/views/components/ui/StatusBadge";
import TableSearch from "@/views/components/ui/TableSearch";
import { cancelCourseEnrollmentAction } from "@/server/actions/courses";
import { confirmUnenroll } from "@/utils/alerts";
import { formatDate } from "@/utils/dates";
import { getCourseTimeStatus } from "@/utils/classStatus";
import { runApiAction } from "@/utils/api";
import styles from "../styles.module.css";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTableControls } from "@/hooks/useTableControls";

const searchFields = (c) => [c.title, c.short_description];

/**
 * Student view: the courses the user enrolled in, with payment status and reviews.
 * `reviews` maps courseId → the user's own review.
 */
const StudentCoursesView = ({ courses, reviews }) => {
  const router = useRouter();
  const [reviewing, setReviewing] = useState(null); // course being reviewed
  const table = useTableControls(courses, { fields: searchFields });

  const handleUnenroll = async (course) => {
    const confirmed = await confirmUnenroll(
      "¿Cancelar inscripción?",
      "Se eliminará tu inscripción a este curso",
    );
    if (!confirmed.isConfirmed) return;
    await runApiAction({
      loading: ["Procesando tu solicitud", "Cancelando inscripción..."],
      request: () => cancelCourseEnrollmentAction(course._id),
      success: ["Operación exitosa", "Tu inscripción ha sido cancelada"],
      failure: "No se pudo cancelar la inscripción",
    });
  };

  return (
    <>
      <div className={styles.container}>
        <h1>Mis Cursos</h1>
        <PaymentInstructions courses={courses.filter((c) => c.userPaymentStatus === "pending")} />
        <div className={styles.listSection}>
          <div className={styles.headerActions}>
            <h2>Cursos Inscritos</h2>
            {courses.length > 0 && (
              <TableSearch
                filteredCount={table.filteredCount}
                label="Buscar cursos"
                totalCount={table.totalCount}
                value={table.query}
                onChange={table.setQuery}
              />
            )}
          </div>
          {courses.length === 0 ? (
            <div className={styles.noInscriptions}>
              <p>No estás inscrito en ningún curso</p>
              <PrimaryLink dark href="/content" text="Ver próximas actividades" />
            </div>
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
                    <th>Progreso</th>
                    <th>Pago</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {table.pageItems.length === 0 && (
                    <tr>
                      <td colSpan={8}>Ningún curso coincide con la búsqueda</td>
                    </tr>
                  )}
                  {table.pageItems.map((course) => {
                    const timeStatus = getCourseTimeStatus(course.start_date, course.end_date, course.status);
                    const paid = course.userPaymentStatus === "paid";
                    const review = reviews[course._id];
                    return (
                      <tr key={course._id}>
                        <td>{course.title}</td>
                        <td>{course.start_date ? formatDate(course.start_date) : "—"}</td>
                        <td>{course.end_date ? formatDate(course.end_date) : "—"}</td>
                        <td>{course.amount_of_classes ?? 0}</td>
                        <td>${course.price}</td>
                        <td>
                          {course.start_date ? <ClassStatusBadge gender="m" status={timeStatus} /> : "—"}
                        </td>
                        <td>
                          <StatusBadge status={paid ? "published" : "pending"}>
                            {paid ? "Pagado" : "Pendiente"}
                          </StatusBadge>
                        </td>
                        <td>
                          <div className={styles.actionButtons}>
                            {paid ? (
                              <IconLink
                                asButton
                                disabled={timeStatus !== "completed"}
                                fill={review ? "var(--warning)" : "var(--color-4)"}
                                icon="Star"
                                onClick={() => setReviewing(course)}
                                title={
                                  timeStatus !== "completed"
                                    ? "Disponible al finalizar el curso"
                                    : review
                                      ? "Editar tu reseña"
                                      : "Dejar una reseña"
                                }
                              />
                            ) : (
                              <IconLink
                                asButton
                                danger
                                icon="UserMinus"
                                onClick={() => handleUnenroll(course)}
                                title="Cancelar inscripción"
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination currentPage={table.page} totalPages={table.totalPages} onPageChange={table.setPage} />
            </div>
          )}
        </div>
      </div>

      {reviewing && (
        <ReviewModal
          isOpen
          entityId={reviewing._id}
          entityTitle={reviewing.title}
          entityType="course"
          existingReview={reviews[reviewing._id] ?? null}
          onClose={() => setReviewing(null)}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  );
};

export default StudentCoursesView;
