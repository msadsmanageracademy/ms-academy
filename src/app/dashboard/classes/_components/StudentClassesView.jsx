"use client";

import CourseFilter from "./CourseFilter";
import Pagination from "@/views/components/ui/Pagination";
import TableSearch from "@/views/components/ui/TableSearch";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import ReviewModal from "@/views/components/ui/ReviewModal";
import StudentClassRow from "./StudentClassRow";
import styles from "../styles.module.css";
import { confirmUnenroll } from "@/utils/alerts";
import { filterByCourse } from "./classList";
import { leaveClassAction } from "@/server/actions/classes";
import { runApiAction } from "@/utils/api";
import { useNotifications } from "@/providers/NotificationProvider";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTableControls } from "@/hooks/useTableControls";

const searchFields = (c) => [c.title, c.courseTitle];

/**
 * Student view: the classes the user takes part in (standalone and of their courses).
 * `reviews` maps classId → the user's own review.
 */
const StudentClassesView = ({ classes, reviews }) => {
  const router = useRouter();
  const { incrementCount } = useNotifications();
  const [courseFilter, setCourseFilter] = useState("all");
  const [reviewing, setReviewing] = useState(null); // class being reviewed
  const table = useTableControls(filterByCourse(classes, courseFilter), { fields: searchFields });

  const handleUnenroll = async (classItem) => {
    const confirmed = await confirmUnenroll(
      "¿Cancelar inscripción?",
      "Se eliminará tu inscripción a esta clase",
    );
    if (!confirmed.isConfirmed) return;
    const res = await runApiAction({
      loading: ["Procesando tu solicitud", "Cancelando inscripción..."],
      request: () => leaveClassAction(classItem._id),
      success: ["Operación exitosa", "Tu inscripción ha sido cancelada"],
      failure: "No se pudo cancelar la inscripción",
    });
    if (res) incrementCount(); // the server notifies the user
  };

  return (
    <>
      <div className={styles.container}>
        <h1>Mis Clases</h1>
        <div className={styles.listSection}>
          <div className={styles.headerActions}>
            <h2>Clases Inscritas</h2>
            {classes.length > 0 && (
              <div className={styles.tableTools}>
                <TableSearch
                  filteredCount={table.filteredCount}
                  label="Buscar clases"
                  totalCount={table.totalCount}
                  value={table.query}
                  onChange={table.setQuery}
                />
                <CourseFilter
                  classes={classes}
                  value={courseFilter}
                  onChange={(value) => {
                    setCourseFilter(value);
                    table.setPage(1);
                  }}
                />
              </div>
            )}
          </div>
          {classes.length === 0 ? (
            <div className={styles.noInscriptions}>
              <p>No estás inscrito en ninguna clase</p>
              <PrimaryLink dark href="/content" text="Ver próximas actividades" />
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Curso</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Duración</th>
                    <th>Precio</th>
                    <th>Progreso</th>
                    <th>Google</th>
                    <th>Grabación</th>
                    <th>Materiales</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {table.pageItems.length === 0 && (
                    <tr>
                      <td colSpan={11}>Ninguna clase coincide con la búsqueda</td>
                    </tr>
                  )}
                  {table.pageItems.map((classItem) => (
                    <StudentClassRow
                      key={classItem._id}
                      classItem={classItem}
                      review={reviews[classItem._id]}
                      onReview={setReviewing}
                      onUnenroll={handleUnenroll}
                    />
                  ))}
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
          entityType="class"
          existingReview={reviews[reviewing._id] ?? null}
          onClose={() => setReviewing(null)}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  );
};

export default StudentClassesView;
