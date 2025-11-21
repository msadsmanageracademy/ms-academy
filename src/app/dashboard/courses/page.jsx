"use client";

import CourseForm from "@/views/sections/pages/dashboard/courses/CourseForm";
import PageLoader from "@/views/components/layout/PageLoader";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";
import { useSession } from "next-auth/react";
import { Delete, Pencil } from "@/views/components/icons";
import {
  confirmDelete,
  confirmUnenroll,
  toastError,
  toastSuccess,
} from "@/utils/alerts";
import { useEffect, useState } from "react";

const CoursesPage = () => {
  const { data: session } = useSession();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);

  useEffect(() => {
    if (session) {
      fetchCourses();
    }
  }, [session]);

  const handleDelete = async (id) => {
    const result = await confirmDelete(
      "¿Eliminar curso?",
      "Esta acción no se puede deshacer"
    );

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/courses/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Error deleting course");

      setCourses(courses.filter((c) => c._id !== id));
      toastSuccess(
        3000,
        "Curso eliminado",
        "El curso se eliminó correctamente"
      );
    } catch (err) {
      console.error("Error deleting course:", err);
      toastError(3000, "Error", "No se pudo eliminar el curso");
    }
  };

  const handleEdit = (course) => {
    setEditingCourse(course);
    setShowCreateForm(false);
  };

  const handleUnenroll = async (courseId) => {
    const result = await confirmUnenroll(
      "¿Cancelar inscripción?",
      "Se eliminará tu inscripción a este curso"
    );

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(
        `/api/courses/sign-up/${courseId}?userId=${session.user.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        return toastError(3000, "Error", data.message);
      }

      setCourses(courses.filter((c) => c._id !== courseId));
      toastSuccess(
        3000,
        "Inscripción cancelada",
        "Tu inscripción se canceló correctamente"
      );
    } catch (err) {
      console.error("Error unenrolling from course:", err);
      toastError(3000, "Error", "No se pudo cancelar la inscripción");
    }
  };

  const handleCancelEdit = () => {
    setEditingCourse(null);
  };

  const handleFormSuccess = () => {
    setShowCreateForm(false);
    setEditingCourse(null);
    // Refresh the list
    if (session) {
      fetchCourses();
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/courses");
      if (!res.ok) throw new Error("Error fetching courses");

      const data = await res.json();

      // Filter courses based on user role
      if (session?.user?.role === "user") {
        const userCourses = data.data.filter((course) =>
          course.participants?.includes(session.user.id)
        );
        setCourses(userCourses);
      } else {
        setCourses(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching courses:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className={styles.container}>
      <h1>
        {session?.user?.role === "admin" ? "Gestión de Cursos" : "Mis Cursos"}
      </h1>

      {session?.user?.role === "admin" ? (
        <>
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
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((course) => (
                      <tr key={course._id}>
                        <td>{course.title}</td>
                        <td>
                          {new Date(course.start_date).toLocaleDateString(
                            "es-AR"
                          )}
                        </td>
                        <td>
                          {course.end_date
                            ? new Date(course.end_date).toLocaleDateString(
                                "es-AR"
                              )
                            : "N/A"}
                        </td>
                        <td>{course.amount_of_classes}</td>
                        <td>${course.price}</td>
                        <td>
                          {course.participants?.length || 0} /{" "}
                          {course.max_participants || "∞"}
                        </td>
                        <td>
                          <div className={styles.actionButtons}>
                            <button
                              onClick={() => handleEdit(course)}
                              className={styles.iconButton}
                              title="Editar"
                            >
                              <Pencil size={20} />
                            </button>
                            <button
                              onClick={() => handleDelete(course._id)}
                              className={styles.iconButtonDanger}
                              title="Eliminar"
                            >
                              <Delete size={20} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <PrimaryLink
              asButton
              text={showCreateForm ? "Cancelar" : "+ Nuevo Curso"}
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setEditingCourse(null);
              }}
            />
          </div>

          {showCreateForm && (
            <div className={styles.formSection}>
              <h2>Crear Nuevo Curso</h2>
              <CourseForm onSuccess={handleFormSuccess} />
            </div>
          )}

          {editingCourse && (
            <div className={styles.formSection}>
              <h2>Editar Curso</h2>
              <CourseForm
                courseData={editingCourse}
                onSuccess={handleFormSuccess}
                onCancel={handleCancelEdit}
              />
            </div>
          )}
        </>
      ) : (
        <div className={styles.listSection}>
          <h2>Cursos Inscritos</h2>
          {courses.length === 0 ? (
            <div className={styles.noInscriptions}>
              <p>No estás inscrito en ningún curso</p>
              <PrimaryLink href="/content" text="Ver próximas actividades" />
            </div>
          ) : (
            <div className={styles.courseGrid}>
              {courses.map((course) => (
                <div key={course._id} className={styles.courseCard}>
                  <h3>{course.title}</h3>
                  <p>{course.short_description}</p>
                  <p>
                    <strong>Inicio:</strong>{" "}
                    {new Date(course.start_date).toLocaleDateString("es-AR")}
                  </p>
                  <p>
                    <strong>Fin:</strong>{" "}
                    {course.end_date
                      ? new Date(course.end_date).toLocaleDateString("es-AR")
                      : "N/A"}
                  </p>
                  <p>
                    <strong>Clases:</strong> {course.amount_of_classes}
                  </p>
                  <p>
                    <strong>Duración:</strong> {course.duration} minutos
                  </p>
                  <p>
                    <strong>Precio:</strong> ${course.price}
                  </p>
                  <div className={styles.actions}>
                    <PrimaryLink
                      asButton
                      danger
                      text={"Cancelar inscripción"}
                      onClick={() => handleUnenroll(course._id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CoursesPage;
