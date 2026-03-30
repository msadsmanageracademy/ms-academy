"use client";

import CourseForm from "@/views/sections/pages/dashboard/courses/CourseForm";
import PageLoader from "@/views/components/layout/PageLoader";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import StatusBadge from "@/views/components/ui/StatusBadge";
import { format } from "date-fns";
import styles from "./styles.module.css";
import { useSession } from "next-auth/react";
import IconLink from "@/views/components/ui/IconLink";
import {
  closeLoading,
  confirmDeleteItem,
  confirmPayment,
  confirmToggleStatus,
  confirmUnenroll,
  toastError,
  toastLoading,
  toastSuccess,
} from "@/utils/alerts";
import { useEffect, useState } from "react";

const CoursesPage = () => {
  const { data: session } = useSession();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (session) {
      fetchCourses();
    }
  }, [session]);

  const handleUnenroll = async (courseId) => {
    const result = await confirmUnenroll(
      "¿Cancelar inscripción?",
      "Se eliminará tu inscripción a este curso",
    );

    if (!result.isConfirmed) return;

    toastLoading("Procesando tu solicitud", "Cancelando inscripción...");

    try {
      const res = await fetch(
        `/api/courses/sign-up/${courseId}?userId=${session.user.id}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json();

      closeLoading();

      if (!res.ok) {
        return toastError(3000, "Ha habido un error", data.message);
      }

      setCourses(courses.filter((c) => c._id !== courseId));
      toastSuccess(
        3000,
        "Operación exitosa",
        "Tu inscripción ha sido cancelada",
      );
    } catch (err) {
      console.error("Error unenrolling from course:", err);
      closeLoading();
      toastError(
        3000,
        "Ha habido un error",
        "No se pudo cancelar la inscripción",
      );
    }
  };

  const handleDeleteCourse = async (courseId, title) => {
    const result = await confirmDeleteItem("curso", title);
    if (!result.isConfirmed) return;

    toastLoading("Procesando tu solicitud", "Eliminando curso...");

    try {
      const res = await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
      const data = await res.json();
      closeLoading();
      if (!res.ok) {
        return toastError(3000, "Ha habido un error", data.message);
      }
      setCourses(courses.filter((c) => c._id !== courseId));
      toastSuccess(3000, "Operación exitosa", "Curso eliminado");
    } catch (err) {
      console.error("Error deleting course:", err);
      closeLoading();
      toastError(3000, "Ha habido un error", "No se pudo eliminar el curso");
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "published" ? "draft" : "published";
    const result = await confirmToggleStatus(newStatus, "curso");
    if (!result.isConfirmed) return;
    toastLoading("Procesando tu solicitud", "Cambiando estado...");
    try {
      const res = await fetch(`/api/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      closeLoading();
      if (!res.ok) {
        return toastError(3000, "Ha habido un error", data.message);
      }
      setCourses(
        courses.map((c) =>
          c._id === id
            ? {
                ...c,
                status: newStatus,
                ...(newStatus === "draft" && { participants: [] }),
              }
            : c,
        ),
      );
      toastSuccess(
        3000,
        "Operación exitosa",
        newStatus === "published" ? "Curso publicado" : "Curso ocultado",
      );
    } catch (err) {
      console.error("Error toggling course status:", err);
      closeLoading();
      toastError(3000, "Ha habido un error", "No se pudo cambiar el estado");
    }
  };

  const handleFormSuccess = () => {
    setShowCreateForm(false);
    if (session) {
      fetchCourses();
    }
  };

  const fetchCourses = async () => {
    try {
      const isAdmin = session?.user?.role === "admin";
      const res = await fetch(
        isAdmin ? "/api/courses?showAll=true" : "/api/courses",
      );
      if (!res.ok) throw new Error("Error fetching courses");

      const data = await res.json();

      if (session?.user?.role === "user") {
        // Show only courses where the user has an enrollment (pending or paid)
        const userCourses = data.data.filter(
          (course) => course.userPaymentStatus != null,
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

  const handleConfirmPayment = async (courseId, courseTitle) => {
    const result = await confirmPayment(courseTitle);
    if (!result.isConfirmed) return;

    toastLoading("Procesando tu solicitud", "Confirmando pago...");

    try {
      const res = await fetch(`/api/courses/confirm-payment/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });

      const data = await res.json();
      closeLoading();

      if (!res.ok) {
        return toastError(3000, "Ha habido un error", data.message);
      }

      setCourses(
        courses.map((c) =>
          c._id === courseId ? { ...c, userPaymentStatus: "paid" } : c,
        ),
      );
      toastSuccess(3000, "Pago confirmado", "¡Ya estás inscripto en el curso!");
    } catch (err) {
      console.error("Error confirming payment:", err);
      closeLoading();
      toastError(3000, "Ha habido un error", "No se pudo confirmar el pago");
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
                      <th>Pagos</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((course) => (
                      <tr key={course._id}>
                        <td>{course.title}</td>
                        <td>
                          {course.start_date
                            ? format(new Date(course.start_date), "dd/MM/yyyy")
                            : "—"}
                        </td>
                        <td>
                          {course.end_date
                            ? format(new Date(course.end_date), "dd/MM/yyyy")
                            : "—"}
                        </td>
                        <td>{course.amount_of_classes ?? 0}</td>
                        <td>${course.price}</td>
                        <td>
                          {course.participants?.length || 0} /{" "}
                          {course.max_participants || "∞"}
                        </td>
                        <td>
                          {course.paidCount ?? 0} / {course.enrolledCount ?? 0}
                        </td>
                        <td>
                          <StatusBadge status={course.status}>
                            {course.status === "published"
                              ? "Publicado"
                              : "Borrador"}
                          </StatusBadge>
                        </td>
                        <td>
                          <div className={styles.actionButtons}>
                            <IconLink
                              fill={"var(--color-4)"}
                              href={`/dashboard/courses/${course._id}`}
                              icon={"Eye"}
                            />
                            <IconLink
                              asButton
                              danger={course.status === "published"}
                              icon={
                                course.status === "published"
                                  ? "Pin"
                                  : "Confetti"
                              }
                              success={course.status !== "published"}
                              onClick={() =>
                                handleToggleStatus(course._id, course.status)
                              }
                              title={
                                course.status === "published"
                                  ? "Ocultar"
                                  : "Publicar"
                              }
                            />
                            <IconLink
                              asButton
                              danger
                              disabled={course.status !== "draft"}
                              icon={"Delete"}
                              onClick={() =>
                                handleDeleteCourse(course._id, course.title)
                              }
                              title={
                                course.status !== "draft"
                                  ? "Solo se pueden eliminar cursos archivados"
                                  : "Eliminar"
                              }
                            />
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
              onClick={() => setShowCreateForm(!showCreateForm)}
            />
          </div>

          {showCreateForm && (
            <div className={styles.formSection}>
              <CourseForm
                onSuccess={handleFormSuccess}
                onCancel={() => setShowCreateForm(false)}
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
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Clases</th>
                    <th>Precio</th>
                    <th>Pago</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course._id}>
                      <td>{course.title}</td>
                      <td>
                        {course.start_date
                          ? format(new Date(course.start_date), "dd/MM/yyyy")
                          : "—"}
                      </td>
                      <td>
                        {course.end_date
                          ? format(new Date(course.end_date), "dd/MM/yyyy")
                          : "—"}
                      </td>
                      <td>{course.amount_of_classes ?? 0}</td>
                      <td>${course.price}</td>
                      <td>
                        <StatusBadge
                          status={
                            course.userPaymentStatus === "paid"
                              ? "published"
                              : "pending"
                          }
                        >
                          {course.userPaymentStatus === "paid"
                            ? "Pagado"
                            : "Pendiente"}
                        </StatusBadge>
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          {course.userPaymentStatus === "pending" && (
                            <IconLink
                              asButton
                              icon={"Money"}
                              onClick={() =>
                                handleConfirmPayment(course._id, course.title)
                              }
                              success
                              title={"Confirmar pago"}
                            />
                          )}
                          <IconLink
                            asButton
                            danger
                            icon={"UserMinus"}
                            onClick={() => handleUnenroll(course._id)}
                            title={"Cancelar inscripción"}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CoursesPage;
