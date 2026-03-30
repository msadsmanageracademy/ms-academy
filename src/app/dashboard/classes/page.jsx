"use client";

import ClassForm from "@/views/sections/pages/dashboard/classes/ClassForm";
import IconLink from "@/views/components/ui/IconLink";
import PageLoader from "@/views/components/layout/PageLoader";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import StatusBadge from "@/views/components/ui/StatusBadge";
import { es } from "date-fns/locale";
import styles from "./styles.module.css";
import { useSession } from "next-auth/react";
import { useNotifications } from "@/providers/NotificationProvider";
import {
  closeLoading,
  confirmAddToCalendar,
  confirmDeleteItem,
  confirmReauth,
  confirmToggleStatus,
  confirmUnlink,
  confirmUnenroll,
  toastError,
  toastLoading,
  toastSuccess,
} from "@/utils/alerts";
import { format } from "date-fns";
import { useEffect, useState } from "react";

const ClassesPage = () => {
  const { data: session } = useSession();
  const { incrementCount } = useNotifications();
  const [addingToCalendar, setAddingToCalendar] = useState(null);
  const [allCourses, setAllCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [courseFilter, setCourseFilter] = useState("all");
  const [hasCalendarAccess, setHasCalendarAccess] = useState(false);
  const [linkModalClassId, setLinkModalClassId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (session) {
      fetchClasses();
      setHasCalendarAccess(session.user.hasAuthorizedCalendar || false);
      if (session.user.role === "admin") fetchAllCourses();
    }
  }, [session]);

  useEffect(() => {
    // Check URL params for calendar connection status
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendar_connected") === "true") {
      toastSuccess(3000, "Operación exitosa", "Google Calendar conectado");
      // Clean URL
      window.history.replaceState({}, "", "/dashboard/classes");
      setHasCalendarAccess(true);
    }
    if (params.get("error")) {
      const errorType = params.get("error");
      const errorDetails = params.get("details");

      let errorMessage = "No se pudo conectar con Google Calendar";

      if (errorType === "access_denied") {
        errorMessage =
          "Permiso denegado. Debes autorizar el acceso a tu calendario.";
      } else if (errorDetails) {
        errorMessage = `Error: ${errorDetails}`;
      }

      toastError(4000, "Error de autorización", errorMessage);
      window.history.replaceState({}, "", "/dashboard/classes");
    }
  }, []);

  const handleUnenroll = async (classId) => {
    const result = await confirmUnenroll(
      "¿Cancelar inscripción?",
      "Se eliminará tu inscripción a esta clase",
    );

    if (!result.isConfirmed) return;

    toastLoading("Procesando tu solicitud", "Cancelando inscripción...");

    try {
      const res = await fetch(
        `/api/classes/sign-up/${classId}?userId=${session.user.id}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json();

      closeLoading();

      if (!res.ok) {
        return toastError(3000, "Ha habido un error", data.message);
      }

      setClasses(classes.filter((c) => c._id !== classId));

      incrementCount();

      toastSuccess(
        3000,
        "Operación exitosa",
        "Tu inscripción ha sido cancelada",
      );
    } catch (err) {
      console.error("Error unenrolling from class:", err);
      closeLoading();
      toastError(
        3000,
        "Ha habido un error",
        "No se pudo cancelar la inscripción",
      );
    }
  };

  const handleConnectCalendar = async () => {
    try {
      const res = await fetch("/api/google-calendar");
      const data = await res.json();

      if (!res.ok || !data.authUrl) {
        return toastError(
          3000,
          "Ha habido un error",
          "No se pudo iniciar la autorización",
        );
      }

      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      console.error("Error connecting calendar:", err);
      toastError(
        3000,
        "Ha habido un error",
        "No se pudo conectar con Google Calendar",
      );
    }
  };

  const fetchAllCourses = async () => {
    try {
      const res = await fetch("/api/courses?showAll=true");
      if (!res.ok) return;
      const data = await res.json();
      setAllCourses(data.data || []);
    } catch (err) {
      console.error("Error fetching courses:", err);
    }
  };

  const handleOpenLinkModal = (classId) => {
    setSelectedCourseId("");
    setLinkModalClassId(classId);
  };

  const handleLinkCourse = async () => {
    if (!selectedCourseId) return;
    const classItem = classes.find((c) => c._id === linkModalClassId);
    setLinkModalClassId(null);
    toastLoading("Procesando tu solicitud", "Vinculando clase al curso...");
    try {
      const res = await fetch(`/api/classes/${linkModalClassId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: selectedCourseId }),
      });
      const data = await res.json();
      closeLoading();
      if (!res.ok) return toastError(3000, "Ha habido un error", data.message);
      const course = allCourses.find((c) => c._id === selectedCourseId);
      setClasses(
        classes.map((c) =>
          c._id === linkModalClassId
            ? {
                ...c,
                ...data.data,
                courseTitle: course?.title,
              }
            : c,
        ),
      );
      toastSuccess(
        3000,
        "Operación exitosa",
        `Clase vinculada al curso "${course?.title}"`,
      );
    } catch (err) {
      console.error("Error linking course:", err);
      closeLoading();
      toastError(3000, "Ha habido un error", "No se pudo vincular la clase");
    }
  };

  const handleUnlinkCourse = async (classId, classTitle, courseTitle) => {
    const result = await confirmUnlink(classTitle, courseTitle);
    if (!result.isConfirmed) return;
    toastLoading("Procesando tu solicitud", "Desvinculando clase del curso...");
    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: null }),
      });
      const data = await res.json();
      closeLoading();
      if (!res.ok) return toastError(3000, "Ha habido un error", data.message);
      setClasses(
        classes.map((c) =>
          c._id === classId
            ? {
                ...c,
                ...data.data,
                courseTitle: undefined,
              }
            : c,
        ),
      );
      toastSuccess(3000, "Operación exitosa", "Clase desvinculada del curso");
    } catch (err) {
      console.error("Error unlinking course:", err);
      closeLoading();
      toastError(3000, "Ha habido un error", "No se pudo desvincular la clase");
    }
  };

  const handleDeleteClass = async (classId, title) => {
    const result = await confirmDeleteItem("clase", title);
    if (!result.isConfirmed) return;

    toastLoading("Procesando tu solicitud", "Eliminando clase...");

    try {
      const res = await fetch(`/api/classes/${classId}`, { method: "DELETE" });
      const data = await res.json();
      closeLoading();
      if (!res.ok) {
        return toastError(3000, "Ha habido un error", data.message);
      }
      setClasses(classes.filter((c) => c._id !== classId));
      toastSuccess(3000, "Operación exitosa", "Clase eliminada");
    } catch (err) {
      console.error("Error deleting class:", err);
      closeLoading();
      toastError(3000, "Ha habido un error", "No se pudo eliminar la clase");
    }
  };

  const handleAddToCalendar = async (classId, title) => {
    const confirmed = await confirmAddToCalendar(title);
    if (!confirmed.isConfirmed) return;

    setAddingToCalendar(classId);

    toastLoading("Procesando tu solicitud", "Agregando a Google Calendar");

    try {
      const res = await fetch(`/api/classes/${classId}/add-to-calendar`, {
        method: "POST",
      });

      const data = await res.json();

      closeLoading();

      if (!res.ok) {
        setAddingToCalendar(null);

        // If token was revoked, offer to re-authorize
        if (data.requiresReauth) {
          const result = await confirmReauth(data.message);

          if (result.isConfirmed) {
            setHasCalendarAccess(false);
            const authRes = await fetch(
              `/api/google-calendar?userId=${session.user.id}`,
            );
            const authData = await authRes.json();
            if (authData.authUrl) {
              window.location.href = authData.authUrl;
            }
          }
          return;
        }

        return toastError(3000, "Ha habido un error", data.message);
      }

      // Update class in state with calendar data
      setClasses(
        classes.map((c) =>
          c._id === classId
            ? {
                ...c,
                googleEventId: data.googleEventId,
                googleMeetLink: data.googleMeetLink,
                calendarEventLink: data.calendarEventLink,
              }
            : c,
        ),
      );

      toastSuccess(
        4000,
        "Operación exitosa",
        data.googleMeetLink ? "Clase creada con Google Meet" : "Clase creada",
      );

      // Notification created for admin
      incrementCount();

      setAddingToCalendar(null);
    } catch (err) {
      closeLoading();
      console.error("Error adding to calendar:", err);
      toastError(
        3000,
        "Ha habido un error",
        "No se pudo agregar a Google Calendar",
      );
      setAddingToCalendar(null);
    }
  };

  const handleFormSuccess = () => {
    setShowCreateForm(false);
    if (session) {
      fetchClasses();
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "published" ? "draft" : "published";
    const result = await confirmToggleStatus(newStatus, "clase");
    if (!result.isConfirmed) return;
    toastLoading("Procesando tu solicitud", "Cambiando estado...");
    try {
      const res = await fetch(`/api/classes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      closeLoading();
      if (!res.ok) {
        return toastError(3000, "Ha habido un error", data.message);
      }
      setClasses(
        classes.map((c) => (c._id === id ? { ...c, ...data.data } : c)),
      );
      toastSuccess(
        3000,
        "Operación exitosa",
        newStatus === "published" ? "Clase publicada" : "Clase ocultada",
      );
    } catch (err) {
      console.error("Error toggling class status:", err);
      closeLoading();
      toastError(3000, "Ha habido un error", "No se pudo cambiar el estado");
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/classes?showAll=true");
      if (!res.ok) throw new Error("Error fetching classes");

      const data = await res.json();

      // Filter classes based on user role
      if (session?.user?.role === "user") {
        const userClasses = data.data.filter((classItem) =>
          classItem.participants?.includes(session.user.id),
        );
        setClasses(userClasses);
      } else {
        setClasses(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching classes:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader />;

  // Build unique course options from class list
  const courseOptions = [
    ...new Map(
      classes
        .filter((c) => c.courseId)
        .map((c) => [
          c.courseId,
          { id: c.courseId, title: c.courseTitle || c.courseId },
        ]),
    ).values(),
  ];

  const filteredClasses =
    courseFilter === "all"
      ? classes
      : courseFilter === "none"
        ? classes.filter((c) => !c.courseId)
        : classes.filter((c) => c.courseId === courseFilter);

  return (
    <>
      <div className={styles.container}>
        <h1>
          {session?.user?.role === "admin" ? "Gestión de Clases" : "Mis Clases"}
        </h1>

        {session?.user?.role === "admin" ? (
          <>
            <div className={styles.listSection}>
              <div className={styles.headerActions}>
                <h2>Clases</h2>
                <select
                  className={styles.filterSelect}
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                >
                  <option value="all">Todas</option>
                  {courseOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                  {classes.some((c) => !c.courseId) && (
                    <option value="none">Sin curso</option>
                  )}
                </select>
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
                        <th>Estado</th>
                        <th>Google</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClasses.map((classItem) => (
                        <tr key={classItem._id}>
                          <td>{classItem.title}</td>
                          <td>{classItem.courseTitle || "—"}</td>
                          <td>
                            {format(
                              new Date(classItem.start_date),
                              "dd/MM/yyyy",
                            )}
                          </td>
                          <td>
                            {format(new Date(classItem.start_date), "h:mm a")}
                          </td>
                          <td>{classItem.duration} min</td>
                          <td>
                            {classItem.price === 0
                              ? "Gratis"
                              : `$${classItem.price}`}
                          </td>
                          <td>
                            {classItem.participants?.length || 0} /{" "}
                            {classItem.max_participants || "∞"}
                          </td>
                          <td>
                            <StatusBadge status={classItem.status}>
                              {classItem.status === "published"
                                ? "Publicada"
                                : classItem.status === "enrolled"
                                  ? "Asociada"
                                  : "Borrador"}
                            </StatusBadge>
                          </td>
                          <td>
                            {!hasCalendarAccess ? (
                              <div className={styles.calendarButton}>
                                <IconLink
                                  asButton
                                  icon={"GoogleCalendar"}
                                  onClick={handleConnectCalendar}
                                  text={"Conectar"}
                                />
                              </div>
                            ) : classItem.googleEventId ? (
                              <div className={styles.calendarStatus}>
                                <IconLink
                                  href={classItem.calendarEventLink}
                                  icon={"GoogleCalendar"}
                                  rel="noopener noreferrer"
                                  target="_blank"
                                />
                                {classItem.googleMeetLink && (
                                  <IconLink
                                    href={classItem.googleMeetLink}
                                    icon={"GoogleMeet"}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                  />
                                )}
                              </div>
                            ) : (
                              <div className={styles.calendarButton}>
                                <IconLink
                                  asButton
                                  disabled={addingToCalendar === classItem._id}
                                  icon={"GoogleCalendar"}
                                  onClick={() =>
                                    handleAddToCalendar(
                                      classItem._id,
                                      classItem.title,
                                    )
                                  }
                                  text={
                                    addingToCalendar === classItem._id
                                      ? "Aguarde..."
                                      : "Agregar"
                                  }
                                />
                              </div>
                            )}
                          </td>
                          <td>
                            <div className={styles.actionButtons}>
                              <IconLink
                                fill={"var(--color-4)"}
                                href={`/dashboard/classes/${classItem._id}`}
                                icon={"Eye"}
                                title={"Ver detalles"}
                              />
                              {classItem.courseId ? (
                                <IconLink
                                  asButton
                                  icon={"MinusSign"}
                                  onClick={() =>
                                    handleUnlinkCourse(
                                      classItem._id,
                                      classItem.title,
                                      classItem.courseTitle,
                                    )
                                  }
                                  title={`Desvincular de "${classItem.courseTitle}"`}
                                  warning
                                />
                              ) : (
                                <IconLink
                                  asButton
                                  disabled={classItem.status === "published"}
                                  icon={"Courses"}
                                  onClick={() =>
                                    handleOpenLinkModal(classItem._id)
                                  }
                                  title={
                                    classItem.status === "published"
                                      ? "No se puede vincular una clase publicada"
                                      : "Vincular a curso"
                                  }
                                  warning
                                />
                              )}
                              <IconLink
                                asButton
                                disabled={classItem.status === "enrolled"}
                                icon={
                                  classItem.status === "published" ||
                                  classItem.status === "enrolled"
                                    ? "Pin"
                                    : "Confetti"
                                }
                                onClick={() =>
                                  handleToggleStatus(
                                    classItem._id,
                                    classItem.status,
                                  )
                                }
                                success={classItem.status === "draft"}
                                title={
                                  classItem.status === "published"
                                    ? "Ocultar"
                                    : "Publicar"
                                }
                                warning={classItem.status === "published"}
                              />
                              <IconLink
                                asButton
                                danger
                                disabled={classItem.status !== "draft"}
                                icon={"Delete"}
                                onClick={() =>
                                  handleDeleteClass(
                                    classItem._id,
                                    classItem.title,
                                  )
                                }
                                title={
                                  classItem.status !== "draft"
                                    ? "Solo se pueden eliminar clases en borrador"
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
                text={showCreateForm ? "Cancelar" : "+ Nueva Clase"}
                onClick={() => {
                  setShowCreateForm(!showCreateForm);
                }}
              />
            </div>
            {showCreateForm && (
              <div className={styles.formSection}>
                <h2>Crear Nueva Clase</h2>
                <ClassForm
                  onSuccess={handleFormSuccess}
                  hasCalendarAccess={hasCalendarAccess}
                />
              </div>
            )}
          </>
        ) : (
          <div className={styles.listSection}>
            <div className={styles.headerActions}>
              <h2>Clases Inscritas</h2>
              {classes.length > 0 && (
                <select
                  className={styles.filterSelect}
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                >
                  <option value="all">Todas</option>
                  {courseOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                  {classes.some((c) => !c.courseId) && (
                    <option value="none">Sin curso</option>
                  )}
                </select>
              )}
            </div>
            {classes.length === 0 ? (
              <div className={styles.noInscriptions}>
                <p>No estás inscrito en ninguna clase</p>
                <PrimaryLink href="/content" text="Ver próximas actividades" />
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
                      <th>Google</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClasses.map((classItem) => (
                      <tr key={classItem._id}>
                        <td>{classItem.title}</td>
                        <td>{classItem.courseTitle || "—"}</td>
                        <td>
                          {format(new Date(classItem.start_date), "dd/MM/yyyy")}
                        </td>
                        <td>
                          {format(new Date(classItem.start_date), "h:mm a")}
                        </td>
                        <td>{classItem.duration} min</td>
                        <td>
                          {classItem.courseTitle
                            ? "Incluido en el curso"
                            : classItem.price === 0
                              ? "Gratis"
                              : `$${classItem.price}`}
                        </td>
                        <td>
                          {classItem.googleEventId ? (
                            <div className={styles.calendarStatus}>
                              <IconLink
                                href={classItem.googleMeetLink}
                                icon={"GoogleMeet"}
                                rel="noopener noreferrer"
                                target="_blank"
                              />
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          <div className={styles.actionButtons}>
                            <IconLink
                              asButton
                              danger
                              disabled={classItem.status === "enrolled"}
                              icon="Delete"
                              onClick={() => handleUnenroll(classItem._id)}
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

      {linkModalClassId && (
        <div
          className={styles.modalOverlay}
          onClick={() => setLinkModalClassId(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Vincular clase a curso</h3>
            <p className={styles.modalSubtitle}>
              {classes.find((c) => c._id === linkModalClassId)?.title}
            </p>
            <select
              className={styles.filterSelect}
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
            >
              <option value="">Seleccionar curso...</option>
              {allCourses.map((course) => (
                <option key={course._id} value={course._id}>
                  {course.title}
                </option>
              ))}
            </select>
            <div className={styles.modalActions}>
              <button
                className={styles.modalCancel}
                onClick={() => setLinkModalClassId(null)}
              >
                Cancelar
              </button>
              <button
                className={styles.modalConfirm}
                disabled={!selectedCourseId}
                onClick={handleLinkCourse}
              >
                Vincular
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ClassesPage;
