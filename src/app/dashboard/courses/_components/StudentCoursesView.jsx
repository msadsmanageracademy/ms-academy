"use client";

import ClassStatusBadge from "@/views/components/ui/ClassStatusBadge";
import IconLink from "@/views/components/ui/IconLink";
import PaymentInstructions from "@/views/components/ui/PaymentInstructions";
import Pagination from "@/views/components/ui/Pagination";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import ReviewModal from "@/views/components/ui/ReviewModal";
import StatusBadge from "@/views/components/ui/StatusBadge";
import TableSearch from "@/views/components/ui/TableSearch";
import { cancelEditionEnrollmentAction } from "@/server/actions/courses";
import { confirmUnenroll } from "@/utils/alerts";
import { formatDate } from "@/utils/dates";
import { formatPrice } from "@/utils/price";
import { runApiAction } from "@/utils/api";
import styles from "../styles.module.css";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTableControls } from "@/hooks/useTableControls";

const searchFields = (e) => [e.title, e.short_description];

/**
 * Student view: the course editions the user enrolled in ("Curso · Septiembre 2026"), with
 * payment status and one review per edition. `editions` comes from listMyEditions;
 * `reviews` maps editionId → the user's own review.
 */
const StudentCoursesView = ({ editions, reviews }) => {
  const router = useRouter();
  const [reviewing, setReviewing] = useState(null); // edition being reviewed
  const table = useTableControls(editions, { fields: searchFields });

  const handleUnenroll = async (edition) => {
    const confirmed = await confirmUnenroll(
      "¿Cancelar inscripción?",
      "Se eliminará tu inscripción a esta edición del curso",
    );
    if (!confirmed.isConfirmed) return;
    await runApiAction({
      loading: ["Procesando tu solicitud", "Cancelando inscripción..."],
      request: () => cancelEditionEnrollmentAction(edition._id),
      success: ["Operación exitosa", "Tu inscripción ha sido cancelada"],
      failure: "No se pudo cancelar la inscripción",
    });
  };

  return (
    <>
      <div className={styles.container}>
        <h1>Mis Cursos</h1>
        <PaymentInstructions courses={editions.filter((e) => e.paymentStatus === "pending")} />
        <div className={styles.listSection}>
          <div className={styles.headerActions}>
            <h2>Cursos Inscritos</h2>
            {editions.length > 0 && (
              <TableSearch
                filteredCount={table.filteredCount}
                label="Buscar cursos"
                totalCount={table.totalCount}
                value={table.query}
                onChange={table.setQuery}
              />
            )}
          </div>
          {editions.length === 0 ? (
            <div className={styles.noInscriptions}>
              <p>No estás inscrito en ningún curso</p>
              <PrimaryLink dark href="/content" text="Ver próximas actividades" />
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Curso</th>
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
                  {table.pageItems.map((edition) => {
                    const { timeStatus } = edition;
                    const paid = edition.paymentStatus === "paid";
                    const review = reviews[edition._id];
                    return (
                      <tr key={edition._id}>
                        <td>{edition.title}</td>
                        <td>{edition.start_date ? formatDate(edition.start_date) : "—"}</td>
                        <td>{edition.end_date ? formatDate(edition.end_date) : "—"}</td>
                        <td>{edition.amount_of_classes ?? 0}</td>
                        <td>{formatPrice(edition.price)}</td>
                        <td>{timeStatus ? <ClassStatusBadge gender="f" status={timeStatus} /> : "—"}</td>
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
                                onClick={() => setReviewing(edition)}
                                title={
                                  timeStatus !== "completed"
                                    ? "Disponible al finalizar la edición"
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
                                onClick={() => handleUnenroll(edition)}
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
          entityType="edition"
          existingReview={reviews[reviewing._id] ?? null}
          onClose={() => setReviewing(null)}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  );
};

export default StudentCoursesView;
