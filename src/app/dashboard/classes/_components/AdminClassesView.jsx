"use client";

import AdminClassRow from "./AdminClassRow";
import Pagination from "@/views/components/ui/Pagination";
import TableSearch from "@/views/components/ui/TableSearch";
import ClassForm from "@/views/sections/pages/dashboard/classes/ClassForm";
import CourseFilter from "./CourseFilter";
import LinkCourseModal from "./LinkCourseModal";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "../styles.module.css";
import { filterByCourse } from "./classList";
import { runApiAction } from "@/utils/api";
import { useCalendarConnection } from "@/hooks/useCalendarConnection";
import { useNotifications } from "@/providers/NotificationProvider";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTableControls } from "@/hooks/useTableControls";
import { confirmAddToCalendar, confirmDeleteItem, confirmToggleStatus, confirmUnlink } from "@/utils/alerts";
import {
  createClassCalendarEventAction,
  deleteClassAction,
  linkClassToCourseAction,
  setClassStatusAction,
  unlinkClassFromCourseAction,
} from "@/server/actions/classes";

// Searchable text of each row (module level: stable across renders)
const searchFields = (c) => [c.title, c.courseTitle, c.short_description];

/**
 * Admin view: every class, with Calendar, course link, publish and delete actions.
 * The data comes from the server; each Server Action re-renders the page with fresh data.
 */
const AdminClassesView = ({ classes, courses }) => {
  const router = useRouter();
  const { incrementCount } = useNotifications();
  const { hasCalendarAccess, connect, handleReauth } = useCalendarConnection("/dashboard/classes");
  const [courseFilter, setCourseFilter] = useState("all");
  const [linkingClass, setLinkingClass] = useState(null);
  const [addingToCalendar, setAddingToCalendar] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleLinkCourse = async (courseId) => {
    const classItem = linkingClass;
    setLinkingClass(null);
    const course = courses.find((c) => c._id === courseId);
    await runApiAction({
      loading: ["Procesando tu solicitud", "Vinculando clase al curso..."],
      request: () => linkClassToCourseAction(classItem._id, courseId),
      success: ["Operación exitosa", `Clase vinculada al curso "${course?.title}"`],
      failure: "No se pudo vincular la clase",
    });
  };

  const handleUnlinkCourse = async (classItem) => {
    if (!(await confirmUnlink(classItem.title, classItem.courseTitle)).isConfirmed) return;
    await runApiAction({
      loading: ["Procesando tu solicitud", "Desvinculando clase del curso..."],
      request: () => unlinkClassFromCourseAction(classItem._id),
      success: ["Operación exitosa", "Clase desvinculada del curso"],
      failure: "No se pudo desvincular la clase",
    });
  };

  const handleToggleStatus = async (classItem) => {
    const status = classItem.status === "published" ? "draft" : "published";
    if (!(await confirmToggleStatus(status, "clase")).isConfirmed) return;
    await runApiAction({
      loading: ["Procesando tu solicitud", "Cambiando estado..."],
      request: () => setClassStatusAction(classItem._id, status),
      success: ["Operación exitosa", status === "published" ? "Clase publicada" : "Clase ocultada"],
      failure: "No se pudo cambiar el estado",
    });
  };

  const handleDeleteClass = async (classItem) => {
    if (!(await confirmDeleteItem("clase", classItem.title)).isConfirmed) return;
    await runApiAction({
      loading: ["Procesando tu solicitud", "Eliminando clase..."],
      request: () => deleteClassAction(classItem._id),
      success: ["Operación exitosa", "Clase eliminada"],
      failure: "No se pudo eliminar la clase",
    });
  };

  const handleAddToCalendar = async (classItem) => {
    if (!(await confirmAddToCalendar(classItem.title)).isConfirmed) return;
    setAddingToCalendar(classItem._id);
    const res = await runApiAction({
      loading: ["Procesando tu solicitud", "Agregando a Google Calendar"],
      request: () => createClassCalendarEventAction(classItem._id),
      success: (r) => [
        "Operación exitosa",
        r.data.googleMeetLink ? "Clase creada con Google Meet" : "Clase creada",
        4000,
      ],
      failure: "No se pudo agregar a Google Calendar",
      // Revoked or expired authorization: offer to connect Calendar again
      onError: (r) => {
        if (!r.requiresReauth) return false;
        handleReauth(r.message);
        return true;
      },
    });
    setAddingToCalendar(null);
    if (res) incrementCount(); // the server notifies the admin
  };

  const table = useTableControls(filterByCourse(classes, courseFilter), { fields: searchFields });

  return (
    <>
      <div className={styles.container}>
        <h1>Gestión de Clases</h1>
        <div className={styles.listSection}>
          <div className={styles.headerActions}>
            <h2>Clases</h2>
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
          </div>
          {classes.length === 0 ? (
            <p className={styles.noClasses}>No hay clases disponibles</p>
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
                    <th>Participantes</th>
                    <th>Progreso</th>
                    <th>Estado</th>
                    <th>Google</th>
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
                    <AdminClassRow
                      key={classItem._id}
                      classItem={classItem}
                      hasCalendarAccess={hasCalendarAccess}
                      isAddingToCalendar={addingToCalendar === classItem._id}
                      onConnectCalendar={connect}
                      onAddToCalendar={handleAddToCalendar}
                      onLink={setLinkingClass}
                      onUnlink={handleUnlinkCourse}
                      onToggleStatus={handleToggleStatus}
                      onDelete={handleDeleteClass}
                    />
                  ))}
                </tbody>
              </table>
              <Pagination currentPage={table.page} totalPages={table.totalPages} onPageChange={table.setPage} />
            </div>
          )}
          <PrimaryLink
            asButton
            dark
            text={showCreateForm ? "Cancelar" : "+ Nueva Clase"}
            onClick={() => setShowCreateForm((open) => !open)}
          />
        </div>
        {showCreateForm && (
          <div className={styles.formSection}>
            <h2>Crear Nueva Clase</h2>
            <ClassForm
              hasCalendarAccess={hasCalendarAccess}
              onSuccess={() => {
                setShowCreateForm(false);
                router.refresh();
              }}
            />
          </div>
        )}
      </div>

      {linkingClass && (
        <LinkCourseModal
          classTitle={linkingClass.title}
          courses={courses}
          onCancel={() => setLinkingClass(null)}
          onConfirm={handleLinkCourse}
        />
      )}
    </>
  );
};

export default AdminClassesView;
