"use client";

import ClassForm from "@/views/sections/pages/dashboard/classes/ClassForm";
import IconLink from "@/views/components/ui/IconLink";
import PageLoader from "@/views/components/layout/PageLoader";
import { es } from "date-fns/locale";
import styles from "./styles.module.css";
import { useSession } from "next-auth/react";
import { useNotifications } from "@/providers/NotificationProvider";
import { useRouter } from "next/navigation";
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

const ClassDetailPage = ({ params }) => {
  const { data: session } = useSession();

  const { incrementCount } = useNotifications();

  const router = useRouter();

  const [classData, setClassData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [hasCalendarAccess, setHasCalendarAccess] = useState(false);
  const [listDownloadState, setListDownloadState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [meetLinkState, setMeetLinkState] = useState(false);
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    if (session) {
      fetchClassDetails();
      setHasCalendarAccess(session.user.hasAuthorizedCalendar || false);
    }
  }, [session, params.id]);

  const fetchClassDetails = async () => {
    try {
      const res = await fetch(`/api/classes/${params.id}`);
      if (!res.ok) throw new Error("Error fetching class");

      const data = await res.json();
      setClassData(data.data);

      // Fetch participant details
      if (data.data.participants && data.data.participants.length > 0) {
        const participantsData = await Promise.all(
          data.data.participants.map(async (participantId) => {
            try {
              const userRes = await fetch(`/api/users/${participantId}`);
              if (userRes.ok) {
                const userData = await userRes.json();
                return userData.data;
              }
              return null;
            } catch (err) {
              console.error("Error fetching participant:", err);
              return null;
            }
          })
        );
        setParticipants(participantsData.filter((p) => p !== null));
      }
    } catch (err) {
      console.error("Error fetching class details:", err);
      toastError(
        3000,
        "Ha habido un error",
        "No se pudo cargar la información de la clase"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
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
      const res = await fetch(`/api/classes/${params.id}`, {
        method: "DELETE",
      });

      closeLoading();

      if (!res.ok) throw new Error("Error deleting class");

      toastSuccess(
        3000,
        "Operación exitosa",
        "La clase se eliminó correctamente"
      );
      router.push("/dashboard/classes");
    } catch (err) {
      console.error("Error deleting class:", err);
      closeLoading();
      toastError(3000, "Ha habido un error", "No se pudo eliminar la clase");
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    const result = await confirmUnenroll(
      "¿Remover participante?",
      "El usuario será dado de baja de esta clase"
    );

    if (!result.isConfirmed) return;

    toastLoading("Procesando solicitud", "Removiendo participante...");

    try {
      const res = await fetch(
        `/api/classes/${params.id}/remove-participant?userId=${participantId}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();

      closeLoading();

      if (!res.ok) {
        return toastError(3000, "Ha habido un error", data.message);
      }

      setParticipants(participants.filter((p) => p._id !== participantId));
      setClassData({
        ...classData,
        participants: classData.participants.filter(
          (id) => id !== participantId
        ),
      });

      incrementCount();

      toastSuccess(
        3000,
        "Operación exitosa",
        "Participante removido correctamente"
      );
    } catch (err) {
      console.error("Error removing participant:", err);
      closeLoading();
      toastError(
        3000,
        "Ha habido un error",
        "No se pudo remover el participante"
      );
    }
  };

  const handleCopyMeetLink = () => {
    if (classData?.googleMeetLink) {
      navigator.clipboard.writeText(classData.googleMeetLink);
      setMeetLinkState(true);
      setTimeout(() => setMeetLinkState(false), 1500);
    }
  };

  const handleExportParticipants = () => {
    if (participants.length === 0) {
      return toastError(
        2000,
        "Sin participantes",
        "No hay participantes para exportar"
      );
    }

    const csvContent = [
      ["Nombre", "Apellido", "Email", "Fecha de inscripción"].join(","),
      ...participants.map((p) =>
        [
          p.first_name || "",
          p.last_name || "",
          p.email || "",
          classData.participants.includes(p._id.toString())
            ? new Date().toLocaleDateString()
            : "",
        ].join(",")
      ),
    ].join("\n");

    // Add UTF-8 BOM for proper encoding
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${classData.title.replace(/\s/g, "_")}_participantes.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setListDownloadState(true);
    setTimeout(() => setListDownloadState(false), 3000);
  };

  const handleFormSuccess = () => {
    setEditMode(false);
    fetchClassDetails();
  };

  if (loading) return <PageLoader />;

  if (!classData) {
    return (
      <div className={styles.container}>
        <h1>Clase no encontrada</h1>
        <IconLink
          fill={"var(--color-4)"}
          href="/dashboard/classes"
          icon="Back"
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Detalles de la Clase</h1>
        <IconLink
          asButton={editMode}
          fill={"var(--color-4)"}
          href={editMode ? undefined : "/dashboard/classes"}
          icon="Back"
          onClick={editMode ? () => setEditMode(false) : undefined}
        />
      </div>

      {!editMode ? (
        <>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Información de la Clase</h2>
              <div className={styles.actionButtons}>
                <IconLink
                  asButton
                  warning
                  icon="Pencil"
                  onClick={() => setEditMode(true)}
                />
                <IconLink
                  asButton
                  danger
                  icon="Delete"
                  onClick={handleDelete}
                />
              </div>
            </div>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.label}>Título:</span>
                <span className={styles.value}>{classData.title}</span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.label}>Descripción:</span>
                <span className={styles.value}>
                  {classData.short_description || "Sin descripción"}
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.label}>Fecha:</span>
                <span className={styles.value}>
                  {format(
                    new Date(classData.start_date),
                    "dd/MM/yyyy 'a las' h:mm a"
                  )}
                  <span className={styles.relative}>
                    (
                    {formatDistanceToNow(new Date(classData.start_date), {
                      locale: es,
                    })}
                    )
                  </span>
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.label}>Duración:</span>
                <span className={styles.value}>
                  {classData.duration} minutos
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.label}>Precio:</span>
                <span className={styles.value}>
                  {classData.price === 0 ? "Sin costo" : `$${classData.price}`}
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.label}>Capacidad:</span>
                <span className={styles.value}>
                  {!classData.max_participants
                    ? "Sin límite"
                    : `${classData.participants?.length ?? 0} / ${
                        classData.max_participants
                      }`}
                </span>
              </div>

              {classData.googleEventId && (
                <>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Google Calendar:</span>
                    <span className={styles.value}>
                      <IconLink
                        href={classData.calendarEventLink}
                        icon="GoogleCalendar"
                        text="Ver evento"
                        rel="noopener noreferrer"
                        target="_blank"
                      />
                    </span>
                  </div>

                  {classData.googleMeetLink && (
                    <div className={styles.infoItem}>
                      <span className={styles.label}>Google Meet:</span>
                      <span className={styles.value}>
                        <IconLink
                          href={classData.googleMeetLink}
                          icon="GoogleMeet"
                          text="Abrir Meet"
                          rel="noopener noreferrer"
                          target="_blank"
                        />
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>
                Participantes ({participants.length}
                {classData.max_participants > 0 &&
                  ` / ${classData.max_participants}`}
                )
              </h2>
            </div>
            {classData.max_participants > 0 && (
              <div className={styles.capacityBar}>
                <div
                  className={styles.capacityFill}
                  style={{
                    width: `${Math.min(
                      (participants.length / classData.max_participants) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            )}
            {participants.length === 0 ? (
              <p className={styles.noParticipants}>
                No hay participantes inscritos
              </p>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Apellido</th>
                      <th>Email</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((participant) => (
                      <tr key={participant._id}>
                        <td>{participant.first_name}</td>
                        <td>{participant.last_name || "-"}</td>
                        <td>{participant.email}</td>
                        <td>
                          <div className={styles.actionButtons}>
                            <IconLink
                              asButton
                              disabled
                              fill={"var(--color-4)"}
                              icon="Mailbox"
                            />
                            <IconLink
                              asButton
                              danger
                              icon="UserMinus"
                              onClick={() =>
                                handleRemoveParticipant(participant._id)
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
          </section>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Acciones Rápidas</h2>
            </div>

            <div className={styles.quickActions}>
              <IconLink
                asButton
                disabled={meetLinkState || !classData.googleMeetLink}
                fill={meetLinkState && "var(--success)"}
                icon={!meetLinkState ? "GoogleMeet" : "CheckCircle"}
                text={!meetLinkState ? "Copiar" : "Copiado"}
                onClick={handleCopyMeetLink}
              />
              <IconLink
                asButton
                disabled={listDownloadState || participants.length === 0}
                fill={!listDownloadState ? "var(--color-4)" : "var(--success)"}
                icon={!listDownloadState ? "ListCheck" : "CheckCircle"}
                text={!listDownloadState ? "Exportar (CSV)" : "Descargado"}
                onClick={handleExportParticipants}
              />
              <IconLink
                asButton
                disabled
                fill={"var(--color-4)"}
                icon="Mailbox"
                text="Notificar participantes"
              />
            </div>
          </section>
        </>
      ) : (
        <section className={styles.section}>
          <h2 className={styles.formTitle}>Editar Clase</h2>
          <ClassForm
            classData={classData}
            onSuccess={handleFormSuccess}
            onCancel={() => setEditMode(false)}
            hasCalendarAccess={hasCalendarAccess}
          />
        </section>
      )}
    </div>
  );
};

export default ClassDetailPage;
