"use client";

import AdminCourseCard from "./AdminCourseCard";
import CourseForm from "@/views/sections/pages/dashboard/courses/CourseForm";
import Pagination from "@/views/components/ui/Pagination";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import TableSearch from "@/views/components/ui/TableSearch";
import { createEditionAction } from "@/server/actions/courses";
import { runApiAction } from "@/utils/api";
import styles from "../styles.module.css";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTableControls } from "@/hooks/useTableControls";

// A course matches by its title or its short description
const searchFields = (c) => [c.title, c.short_description];

/**
 * Admin view: one card per course (the product), with figures that combine all its
 * editions. "Nueva edición" creates the next edition and opens it; "Crear curso"
 * creates a course together with its Edition 1. Data comes from the server.
 */
const AdminCoursesView = ({ courses }) => {
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const table = useTableControls(courses, { fields: searchFields, pageSize: 12 });

  const handleNewEdition = async (course) => {
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
      <h1>Gestión de Cursos</h1>
      <div className={styles.listSection}>
        <div className={styles.headerActions}>
          <h2>Todos los Cursos</h2>
          {courses.length > 0 && (
            <TableSearch
              filteredCount={table.filteredCount}
              label="Buscar cursos"
              totalCount={table.totalCount}
              value={table.query}
              onChange={table.setQuery}
            />
          )}
          <PrimaryLink
            asButton
            dark
            aria-expanded={showCreateForm}
            text={showCreateForm ? "Cancelar" : "Crear curso"}
            onClick={() => setShowCreateForm((open) => !open)}
          />
        </div>

        {showCreateForm && (
          <section aria-labelledby="create-course-title" className={styles.formSection}>
            <h2 id="create-course-title">Crear curso</h2>
            <p className={styles.formHint}>
              Se crea el curso junto con su Edición 1 en borrador. Después vas a poder sumarle clases y publicarla.
            </p>
            <CourseForm
              onSuccess={() => {
                setShowCreateForm(false);
                router.refresh();
              }}
            />
          </section>
        )}

        {courses.length === 0 ? (
          <p className={styles.noClasses}>Todavía no hay cursos. Creá el primero con &quot;Crear curso&quot;.</p>
        ) : table.pageItems.length === 0 ? (
          <p className={styles.noClasses}>Ningún curso coincide con la búsqueda</p>
        ) : (
          <>
            <ul className={styles.cardGrid}>
              {table.pageItems.map((course) => (
                <li key={course._id}>
                  <AdminCourseCard course={course} onNewEdition={handleNewEdition} />
                </li>
              ))}
            </ul>
            <Pagination currentPage={table.page} totalPages={table.totalPages} onPageChange={table.setPage} />
          </>
        )}
      </div>
    </div>
  );
};

export default AdminCoursesView;
