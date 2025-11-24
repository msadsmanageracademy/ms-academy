"use client";

import ClassForm from "@/views/sections/pages/dashboard/classes/ClassForm";
import IconLink from "@/views/components/ui/IconLink";
import PageLoader from "@/views/components/layout/PageLoader";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import { es } from "date-fns/locale";
import styles from "./styles.module.css";
import { useSession } from "next-auth/react";
import { useNotifications } from "@/providers/NotificationProvider";
import {
  closeLoading,
  confirmDelete,
  confirmUnenroll,
  toastError,
  toastLoading,
  toastSuccess,
} from "@/utils/alerts";
import { format, formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";

const ClassesPage = () => {
  const { data: session } = useSession();
  const { incrementCount } = useNotifications();
  const [addingToCalendar, setAddingToCalendar] = useState(null);
  const [classes, setClasses] = useState([]);
  const [editingClass, setEditingClass] = useState(null);
  const [hasCalendarAccess, setHasCalendarAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (session) {
      fetchClasses();
      setHasCalendarAccess(session.user.hasAuthorizedCalendar || false);
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

  const handleDelete = async (id) => {
    const result = await confirmDelete(
      "¿Eliminar clase?",
      "Esta acción no se puede deshacer"
    );

    if (!result.isConfirmed) return;

    toastLoading(
      "Eliminando clase...",
      "Se eliminará la clase y su evento de Google Calendar si existe"
    );

    try {
      const res = await fetch(`/api/classes/${id}`, {
        method: "DELETE",
      });

      closeLoading();

      if (!res.ok) throw new Error("Error deleting class");

      setClasses(classes.filter((c) => c._id !== id));
      toastSuccess(
        3000,
        "Operación exitosa",
        "La clase se eliminó correctamente"
      );
    } catch (err) {
      console.error("Error deleting class:", err);
      closeLoading();
      toastError(3000, "Ha habido un error", "No se pudo eliminar la clase");
    }
  };

  const handleEdit = (classItem) => {
    setEditingClass(classItem);
    setShowCreateForm(false);
  };

  const handleUnenroll = async (classId) => {
    const result = await confirmUnenroll(
      "¿Cancelar inscripción?",
      "Se eliminará tu inscripción a esta clase"
    );

    if (!result.isConfirmed) return;

    toastLoading("Cancelando inscripción...", "Procesando tu solicitud");

    try {
      const res = await fetch(
        `/api/classes/sign-up/${classId}?userId=${session.user.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();

      closeLoading();

      if (!res.ok) {
        return toastError(3000, "Ha habido un error", data.message);
      }

      setClasses(classes.filter((c) => c._id !== classId));
      toastSuccess(
        3000,
        "Operación exitosa",
        "Tu inscripción ha sido cancelada"
      );
    } catch (err) {
      console.error("Error unenrolling from class:", err);
      closeLoading();
      toastError(
        3000,
        "Ha habido un error",
        "No se pudo cancelar la inscripción"
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
          "No se pudo iniciar la autorización"
        );
      }

      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      console.error("Error connecting calendar:", err);
      toastError(
        3000,
        "Ha habido un error",
        "No se pudo conectar con Google Calendar"
      );
    }
  };

  const handleAddToCalendar = async (classId) => {
    setAddingToCalendar(classId);

    toastLoading(
      "Agregando a Google Calendar...",
      "Creando el evento y el link de Meet"
    );

    try {
      const res = await fetch(`/api/classes/${classId}/add-to-calendar`, {
        method: "POST",
      });

      const data = await res.json();

      closeLoading();

      if (!res.ok) {
        setAddingToCalendar(null);
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
            : c
        )
      );

      toastSuccess(
        4000,
        "Operación exitosa",
        data.googleMeetLink ? "Clase creada con Google Meet" : "Clase creada"
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
        "No se pudo agregar a Google Calendar"
      );
      setAddingToCalendar(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingClass(null);
  };

  const handleFormSuccess = () => {
    setShowCreateForm(false);
    setEditingClass(null);
    // Refresh the list
    if (session) {
      fetchClasses();
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/classes");
      if (!res.ok) throw new Error("Error fetching classes");

      const data = await res.json();

      // Filter classes based on user role
      if (session?.user?.role === "user") {
        const userClasses = data.data.filter((classItem) =>
          classItem.participants?.includes(session.user.id)
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

  return (
    <div className={styles.container}>
      <h1>
        {session?.user?.role === "admin" ? "Gestión de Clases" : "Mis Clases"}
      </h1>

      {session?.user?.role === "admin" ? (
        <>
          <div className={styles.listSection}>
            <div className={styles.headerActions}>
              <h2>Todas las Clases</h2>
              {!hasCalendarAccess && (
                <PrimaryLink
                  asButton
                  google
                  text={"Conectar Google Calendar"}
                  onClick={handleConnectCalendar}
                >
                  Conectar Google Calendar
                </PrimaryLink>
              )}
            </div>
            {classes.length === 0 ? (
              <p className={styles.noClasses}>No hay clases disponibles</p>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Título</th>
                      <th>Fecha</th>
                      <th>Hora</th>
                      <th>Duración</th>
                      <th>Precio</th>
                      <th>Participantes</th>
                      {hasCalendarAccess && <th>Google</th>}
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((classItem) => (
                      <tr key={classItem._id}>
                        <td>{classItem.title}</td>
                        <td>
                          {format(new Date(classItem.start_date), "dd/MM/yyyy")}{" "}
                          (
                          {formatDistanceToNow(new Date(classItem.start_date), {
                            locale: es,
                          })}
                          )
                        </td>
                        <td>
                          {format(new Date(classItem.start_date), "h:mm a")}
                        </td>
                        <td>{classItem.duration} min</td>
                        <td>
                          {classItem.price === 0
                            ? "Sin costo"
                            : `$${classItem.price}`}
                        </td>
                        <td>
                          {!classItem.max_participants
                            ? "Sin límite"
                            : `${classItem.participants?.length} / ${classItem.max_participants}`}
                        </td>
                        {hasCalendarAccess && (
                          <td>
                            {classItem.googleEventId ? (
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
                                    handleAddToCalendar(classItem._id)
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
                        )}
                        <td>
                          <div className={styles.actionButtons}>
                            <IconLink
                              asButton
                              warning
                              icon={"Pencil"}
                              onClick={() => handleEdit(classItem)}
                            />
                            <IconLink
                              asButton
                              danger
                              icon={"Delete"}
                              onClick={() => handleDelete(classItem._id)}
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
                setEditingClass(null);
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

          {editingClass && (
            <div className={styles.formSection}>
              <h2>Editar Clase</h2>
              <ClassForm
                classData={editingClass}
                onSuccess={handleFormSuccess}
                onCancel={handleCancelEdit}
                hasCalendarAccess={hasCalendarAccess}
              />
            </div>
          )}
        </>
      ) : (
        <div className={styles.listSection}>
          <h2>Clases Inscritas</h2>
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
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Duración</th>
                    <th>Precio</th>
                    <th>Google</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((classItem) => (
                    <tr key={classItem._id}>
                      <td>{classItem.title}</td>
                      <td>
                        {format(new Date(classItem.start_date), "dd/MM/yyyy")} (
                        {formatDistanceToNow(new Date(classItem.start_date), {
                          locale: es,
                        })}
                        )
                      </td>
                      <td>
                        {format(new Date(classItem.start_date), "h:mm a")}
                      </td>
                      <td>{classItem.duration} min</td>
                      <td>
                        {classItem.price === 0
                          ? "Sin costo"
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
  );
};

export default ClassesPage;
