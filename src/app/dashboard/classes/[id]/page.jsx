"use client";

import ClassForm from "@/views/sections/pages/dashboard/classes/ClassForm";
import IconLink from "@/views/components/ui/IconLink";
import PageLoader from "@/views/components/layout/PageLoader";
import StarRating from "@/views/components/ui/StarRating";
import StatusBadge from "@/views/components/ui/StatusBadge";
import { getCourseTimeStatus, getClassStatus } from "@/utils/classStatus";
import { es } from "date-fns/locale";
import styles from "./styles.module.css";
import { useSession } from "next-auth/react";
import { useNotifications } from "@/providers/NotificationProvider";
import { useParams } from "next/navigation";
import {
  closeLoading,
  confirmNotify,
  confirmUnenroll,
  toastError,
  toastLoading,
  toastSuccess,
} from "@/utils/alerts";
import { format, formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";

const ClassDetailPage = () => {
  const { id } = useParams();
  const { data: session } = useSession();

  const { incrementCount } = useNotifications();

  const [classData, setClassData] = useState(null);
  const [courseTitle, setCourseTitle] = useState(null);
  const [linkedCourseInfo, setLinkedCourseInfo] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [hasCalendarAccess, setHasCalendarAccess] = useState(false);
  const [listDownloadState, setListDownloadState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [meetLinkState, setMeetLinkState] = useState(false);
  const [notifyAllState, setNotifyAllState] = useState(false);
  const [notifyingParticipant, setNotifyingParticipant] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingUrlSaving, setRecordingUrlSaving] = useState(false);
  const [resources, setResources] = useState([]);
  const [newResourceTitle, setNewResourceTitle] = useState("");
  const [newResourceUrl, setNewResourceUrl] = useState("");
  const [resourcesSaving, setResourcesSaving] = useState(false);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    if (session) {
      fetchClassDetails();
      setHasCalendarAccess(session.user.hasAuthorizedCalendar || false);
    }
  }, [session, id]);

  const fetchClassDetails = async () => {
    try {
      const res = await fetch(`/api/classes/${id}`);
      if (!res.ok) throw new Error("Error fetching class");

      const data = await res.json();
      setClassData(data.data);
      setRecordingUrl(data.data.recording_url || "");
      setResources(data.data.resources || []);
      if (data.data.userReview) {
        setReviewRating(data.data.userReview.rating);
        setReviewComment(data.data.userReview.comment || "");
      }

      // Fetch course title if the class belongs to one
      if (data.data.courseId) {
        try {
          const courseRes = await fetch(`/api/courses/${data.data.courseId}`);
          if (courseRes.ok) {
            const courseData = await courseRes.json();
            setCourseTitle(courseData.data?.title ?? null);
            setLinkedCourseInfo({
              status: courseData.data?.status ?? null,
              start_date: courseData.data?.start_date ?? null,
              end_date: courseData.data?.end_date ?? null,
            });
          }
        } catch {
          // non-blocking — course title stays null
        }
      } else {
        setCourseTitle(null);
      }

      // Fetch reviews (non-blocking)
      fetch(`/api/classes/${id}/reviews`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setReviews(d.data);
        })
        .catch(() => {});

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
          }),
        );
        setParticipants(participantsData.filter((p) => p !== null));
      }
    } catch (err) {
      console.error("Error fetching class details:", err);
      toastError(
        3000,
        "Ha habido un error",
        "No se pudo cargar la información de la clase",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    const result = await confirmUnenroll(
      "¿Remover participante?",
      "El usuario será dado de baja de esta clase",
    );

    if (!result.isConfirmed) return;

    toastLoading("Procesando solicitud", "Removiendo participante...");

    try {
      const res = await fetch(
        `/api/classes/${id}/remove-participant?userId=${participantId}`,
        {
          method: "DELETE",
        },
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
          (id) => id !== participantId,
        ),
      });

      incrementCount();

      toastSuccess(
        3000,
        "Operación exitosa",
        "Participante removido correctamente",
      );
    } catch (err) {
      console.error("Error removing participant:", err);
      closeLoading();
      toastError(
        3000,
        "Ha habido un error",
        "No se pudo remover el participante",
      );
    }
  };

  const handleNotifyParticipant = async (participantId) => {
    const result = await confirmNotify(
      "¿Notificar al participante?",
      `Se enviará un email recordatorio de la clase al participante seleccionado`,
    );

    if (!result.isConfirmed) return;

    setNotifyingParticipant(participantId);
    toastLoading("Enviando recordatorio", "Enviando email...");

    try {
      const res = await fetch(`/api/classes/${id}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantIds: [participantId] }),
      });

      const data = await res.json();
      closeLoading();

      if (!res.ok) {
        return toastError(3000, "Ha habido un error", data.message);
      }

      toastSuccess(3000, "Email enviado", "Se notificó al participante");
    } catch (err) {
      console.error("Error notifying participant:", err);
      closeLoading();
      toastError(3000, "Ha habido un error", "No se pudo enviar el email");
    } finally {
      setTimeout(() => setNotifyingParticipant(null), 2000);
    }
  };

  const handleNotifyAll = async () => {
    if (participants.length === 0) return;

    const result = await confirmNotify(
      "¿Notificar a todos?",
      `Se enviará un email recordatorio de la clase a ${participants.length} participante${participants.length > 1 ? "s" : ""}`,
    );

    if (!result.isConfirmed) return;

    toastLoading("Enviando recordatorios", "Enviando emails...");

    try {
      const res = await fetch(`/api/classes/${id}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      closeLoading();

      if (!res.ok) {
        return toastError(3000, "Ha habido un error", data.message);
      }

      setNotifyAllState(true);
      setTimeout(() => setNotifyAllState(false), 30000);

      toastSuccess(
        3000,
        "Emails enviados",
        `Se notificó a ${data.notifiedCount} participante${data.notifiedCount > 1 ? "s" : ""}`,
      );
    } catch (err) {
      console.error("Error notifying all participants:", err);
      closeLoading();
      toastError(
        3000,
        "Ha habido un error",
        "No se pudieron enviar los emails",
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
        "No hay participantes para exportar",
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
        ].join(","),
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
      `${classData.title.replace(/\s/g, "_")}_participantes.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setListDownloadState(true);
    setTimeout(() => setListDownloadState(false), 3000);
  };

  const handleAddResource = () => {
    if (!newResourceTitle.trim() || !newResourceUrl.trim()) return;
    try {
      new URL(newResourceUrl);
    } catch {
      return toastError(2000, "URL inválida", "Ingresá una URL válida");
    }
    setResources((prev) => [
      ...prev,
      { title: newResourceTitle.trim(), url: newResourceUrl.trim() },
    ]);
    setNewResourceTitle("");
    setNewResourceUrl("");
  };

  const handleRemoveResource = (index) => {
    setResources((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveResources = async () => {
    setResourcesSaving(true);
    toastLoading("Guardando materiales", "Actualizando lista...");
    try {
      const res = await fetch(`/api/classes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resources }),
      });
      const data = await res.json();
      closeLoading();
      if (!res.ok) {
        return toastError(3000, "Ha habido un error", data.message);
      }
      setClassData((prev) => ({ ...prev, resources }));
      toastSuccess(
        3000,
        "Materiales actualizados",
        "La lista fue guardada correctamente",
      );
    } catch (err) {
      console.error("Error saving resources:", err);
      closeLoading();
      toastError(
        3000,
        "Ha habido un error",
        "No se pudieron guardar los materiales",
      );
    } finally {
      setResourcesSaving(false);
    }
  };

  const handleSaveRecording = async () => {
    setRecordingUrlSaving(true);
    toastLoading("Guardando grabación", "Actualizando URL...");
    try {
      const res = await fetch(`/api/classes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recording_url: recordingUrl }),
      });
      const data = await res.json();
      closeLoading();
      if (!res.ok) {
        return toastError(3000, "Ha habido un error", data.message);
      }
      setClassData((prev) => ({ ...prev, recording_url: recordingUrl }));
      toastSuccess(
        3000,
        "Grabación actualizada",
        "La URL fue guardada correctamente",
      );
    } catch (err) {
      console.error("Error saving recording URL:", err);
      closeLoading();
      toastError(
        3000,
        "Ha habido un error",
        "No se pudo guardar la URL de grabación",
      );
    } finally {
      setRecordingUrlSaving(false);
    }
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
                  {classData.start_date ? (
                    <>
                      {format(
                        new Date(classData.start_date),
                        "dd/MM/yyyy 'a las' h:mm a",
                      )}
                      <span className={styles.relative}>
                        (
                        {formatDistanceToNow(new Date(classData.start_date), {
                          locale: es,
                        })}
                        )
                      </span>
                    </>
                  ) : (
                    "Sin fecha asignada"
                  )}
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
                  {classData.price === 0 ? "Gratis" : `$${classData.price}`}
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.label}>Estado:</span>
                <StatusBadge status={classData.status}>
                  {classData.status === "enrolled"
                    ? "Asociada"
                    : classData.status === "published"
                      ? "Publicada"
                      : "Borrador"}
                </StatusBadge>
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

              <div className={styles.infoItem}>
                <span className={styles.label}>Curso:</span>
                <span className={styles.value}>
                  {courseTitle ? (
                    <span className={styles.linkedValue}>
                      {courseTitle}
                      <IconLink
                        href={`/dashboard/courses/${classData.courseId}`}
                        fill={"var(--color-4)"}
                        icon={"Eye"}
                      />
                    </span>
                  ) : (
                    "Clase independiente"
                  )}
                </span>
              </div>

              {classData.googleEventId && (
                <>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Google:</span>
                    <span className={styles.value}>
                      {classData.courseId &&
                      session?.user?.role !== "admin" &&
                      classData.userCoursePaymentStatus !== "paid" ? (
                        <span className={styles.lockedLinks}>
                          🔒 Pago pendiente para acceder a los links
                        </span>
                      ) : (
                        <>
                          {classData.googleMeetLink && (
                            <IconLink
                              href={classData.googleMeetLink}
                              icon="GoogleMeet"
                              rel="noopener noreferrer"
                              size={24}
                              target="_blank"
                            />
                          )}
                          {classData.calendarEventLink && (
                            <IconLink
                              href={classData.calendarEventLink}
                              icon="GoogleCalendar"
                              rel="noopener noreferrer"
                              size={24}
                              target="_blank"
                            />
                          )}
                        </>
                      )}
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>
          {classData.courseId && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Materiales</h2>
              </div>
              <div className={styles.resourceAddRow}>
                <input
                  className={styles.recordingInput}
                  placeholder="Título del material"
                  type="text"
                  value={newResourceTitle}
                  onChange={(e) => setNewResourceTitle(e.target.value)}
                />
                <input
                  className={styles.recordingInput}
                  placeholder="https://..."
                  type="url"
                  value={newResourceUrl}
                  onChange={(e) => setNewResourceUrl(e.target.value)}
                />
                <button
                  className={styles.recordingBtn}
                  onClick={handleAddResource}
                >
                  Agregar
                </button>
              </div>
              {resources.length > 0 && (
                <ul className={styles.resourceList}>
                  {resources.map((r, i) => (
                    <li key={i} className={styles.resourceItem}>
                      <a href={r.url} rel="noopener noreferrer" target="_blank">
                        {r.title}
                      </a>
                      <button
                        className={styles.resourceRemoveBtn}
                        onClick={() => handleRemoveResource(i)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {resources.length > 0 && (
                <button
                  className={styles.recordingBtn}
                  disabled={resourcesSaving}
                  onClick={handleSaveResources}
                >
                  {resourcesSaving ? "Guardando..." : "Guardar cambios"}
                </button>
              )}
            </section>
          )}
          {classData.courseId && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Grabación</h2>
              </div>
              <div className={styles.recordingRow}>
                <input
                  className={styles.recordingInput}
                  placeholder="https://..."
                  type="url"
                  value={recordingUrl}
                  onChange={(e) => setRecordingUrl(e.target.value)}
                />
                <button
                  className={styles.recordingBtn}
                  disabled={recordingUrlSaving}
                  onClick={handleSaveRecording}
                >
                  {recordingUrlSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
              {classData.recording_url && (
                <p className={styles.recordingCurrent}>
                  URL actual:{" "}
                  <a
                    href={classData.recording_url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {classData.recording_url}
                  </a>
                </p>
              )}
            </section>
          )}
          {classData.status !== "enrolled" && (
            <>
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
                          (participants.length / classData.max_participants) *
                            100,
                          100,
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
                                  disabled={
                                    notifyingParticipant === participant._id
                                  }
                                  fill={
                                    notifyingParticipant === participant._id
                                      ? "var(--success)"
                                      : "var(--color-4)"
                                  }
                                  icon={
                                    notifyingParticipant === participant._id
                                      ? "CheckCircle"
                                      : "Mailbox"
                                  }
                                  onClick={() =>
                                    handleNotifyParticipant(participant._id)
                                  }
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
                    fill={
                      !listDownloadState ? "var(--color-4)" : "var(--success)"
                    }
                    icon={!listDownloadState ? "ListCheck" : "CheckCircle"}
                    text={!listDownloadState ? "Exportar (CSV)" : "Descargado"}
                    onClick={handleExportParticipants}
                  />
                  <IconLink
                    asButton
                    disabled={notifyAllState || participants.length === 0}
                    fill={notifyAllState ? "var(--success)" : "var(--color-4)"}
                    icon={notifyAllState ? "CheckCircle" : "Mailbox"}
                    text={
                      notifyAllState ? "Notificados" : "Notificar participantes"
                    }
                    onClick={handleNotifyAll}
                  />
                </div>
              </section>
            </>
          )}

          {/* Reviews section — visible to everyone once the class is completed */}
          {getClassStatus(
            classData.start_date,
            classData.duration,
            classData.status,
          ) === "completed" && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>
                  Reseñas
                  {classData.reviewCount > 0 && (
                    <span className={styles.reviewSummary}>
                      <StarRating
                        value={Math.round(classData.avgRating)}
                        readOnly
                        size="sm"
                      />
                      {classData.avgRating} ({classData.reviewCount})
                    </span>
                  )}
                </h2>
              </div>

              {/* Review form removed — leave review via the Star button in Mis Clases */}

              {reviews.length === 0 ? (
                <p className={styles.noReviews}>
                  Todavía no hay reseñas para esta clase.
                </p>
              ) : (
                <ul className={styles.reviewList}>
                  {reviews.map((r) => (
                    <li key={r._id?.toString()} className={styles.reviewItem}>
                      <div className={styles.reviewHeader}>
                        <span className={styles.reviewAuthor}>
                          {r.firstName}
                        </span>
                        <StarRating value={r.rating} readOnly size="sm" />
                        <span className={styles.reviewDate}>
                          {format(new Date(r.createdAt), "dd/MM/yyyy", {
                            locale: es,
                          })}
                        </span>
                      </div>
                      {r.comment && (
                        <p className={styles.reviewComment}>{r.comment}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      ) : (
        <section className={styles.section}>
          <h2 className={styles.formTitle}>Editar Clase</h2>
          <ClassForm
            classData={classData}
            onSuccess={handleFormSuccess}
            onCancel={() => setEditMode(false)}
            hasCalendarAccess={hasCalendarAccess}
            allowFullEdit={
              classData?.status === "enrolled" &&
              getCourseTimeStatus(
                linkedCourseInfo?.start_date,
                linkedCourseInfo?.end_date,
                linkedCourseInfo?.status,
              ) !== "in-progress"
            }
          />
        </section>
      )}
    </div>
  );
};

export default ClassDetailPage;
