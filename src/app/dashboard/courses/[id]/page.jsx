"use client";

import CourseForm from "@/views/sections/pages/dashboard/courses/CourseForm";
import IconLink from "@/views/components/ui/IconLink";
import PageLoader from "@/views/components/layout/PageLoader";
import StatusBadge from "@/views/components/ui/StatusBadge";
import styles from "./styles.module.css";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  closeLoading,
  confirmDelete,
  confirmUnenroll,
  toastError,
  toastLoading,
  toastSuccess,
} from "@/utils/alerts";
import { useEffect, useState } from "react";

const CourseDetailPage = ({ params }) => {
  const { data: session } = useSession();
  const router = useRouter();

  const [courseData, setCourseData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    if (session) {
      fetchCourseDetails();
    }
  }, [session, params.id]);

  const fetchCourseDetails = async () => {
    try {
      const res = await fetch(`/api/courses/${params.id}`);
      if (!res.ok) throw new Error("Error fetching course");

      const data = await res.json();
      setCourseData(data.data);

      // Fetch classes belonging to this course
      const classesRes = await fetch(`/api/classes?courseId=${params.id}`);
      if (classesRes.ok) {
        const classesData = await classesRes.json();
        setClasses(classesData.data || []);
      }

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
      console.error("Error fetching course details:", err);
      toastError(
        3000,
        "Ha habido un error",
        "No se pudo cargar la información del curso",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const result = await confirmDelete(
      "¿Eliminar curso?",
      "Esta acción no se puede deshacer",
    );

    if (!result.isConfirmed) return;

    toastLoading("Eliminando curso...", "Se eliminará el curso y sus datos");

    try {
      const res = await fetch(`/api/courses/${params.id}`, {
        method: "DELETE",
      });

      closeLoading();

      if (!res.ok) throw new Error("Error deleting course");

      toastSuccess(
        3000,
        "Operación exitosa",
        "El curso se eliminó correctamente",
      );
      router.push("/dashboard/courses");
    } catch (err) {
      console.error("Error deleting course:", err);
      closeLoading();
      toastError(3000, "Ha habido un error", "No se pudo eliminar el curso");
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    const result = await confirmUnenroll(
      "¿Remover participante?",
      "El usuario será dado de baja de este curso",
    );

    if (!result.isConfirmed) return;

    toastLoading("Procesando solicitud", "Removiendo participante...");

    try {
      const res = await fetch(
        `/api/courses/${params.id}/remove-participant?userId=${participantId}`,
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
      setCourseData({
        ...courseData,
        participants: courseData.participants.filter(
          (id) => id !== participantId,
        ),
      });

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

  const handleFormSuccess = () => {
    setEditMode(false);
    fetchCourseDetails();
  };

  if (loading) return <PageLoader />;

  if (!courseData) {
    return (
      <div className={styles.container}>
        <h1>Curso no encontrado</h1>
        <IconLink
          fill={"var(--color-4)"}
          href="/dashboard/courses"
          icon="Back"
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Detalles del Curso</h1>
        <IconLink
          asButton={editMode}
          fill={"var(--color-4)"}
          href={editMode ? undefined : "/dashboard/courses"}
          icon="Back"
          onClick={editMode ? () => setEditMode(false) : undefined}
        />
      </div>

      {!editMode ? (
        <>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Información del Curso</h2>
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
                <span className={styles.value}>{courseData.title}</span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.label}>Descripción corta:</span>
                <span className={styles.value}>
                  {courseData.short_description || "Sin descripción"}
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.label}>Estado:</span>
                <StatusBadge status={courseData.status}>
                  {courseData.status === "published" ? "Publicado" : "Borrador"}
                </StatusBadge>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.label}>Precio:</span>
                <span className={styles.value}>
                  {courseData.price === 0 ? "Gratis" : `$${courseData.price}`}
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.label}>Capacidad:</span>
                <span className={styles.value}>
                  {!courseData.max_participants
                    ? "Sin límite"
                    : `${courseData.participants?.length ?? 0} / ${courseData.max_participants}`}
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.label}>Clases:</span>
                <span className={styles.value}>
                  {courseData.amount_of_classes ?? 0}
                </span>
              </div>

              {courseData.start_date && (
                <div className={styles.infoItem}>
                  <span className={styles.label}>Inicio:</span>
                  <span className={styles.value}>
                    {format(new Date(courseData.start_date), "dd/MM/yyyy")}
                  </span>
                </div>
              )}

              {courseData.end_date && (
                <div className={styles.infoItem}>
                  <span className={styles.label}>Fin:</span>
                  <span className={styles.value}>
                    {format(new Date(courseData.end_date), "dd/MM/yyyy")}
                  </span>
                </div>
              )}

              {courseData.full_description && (
                <div className={`${styles.infoItem} ${styles.fullWidth}`}>
                  <span className={styles.label}>Descripción completa:</span>
                  <span className={styles.value}>
                    {courseData.full_description}
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Clases del Curso ({classes.length})</h2>
            </div>
            {classes.length === 0 ? (
              <p className={styles.noParticipants}>
                No hay clases asignadas a este curso
              </p>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Título</th>
                      <th>Fecha</th>
                      <th>Hora</th>
                      <th>Duración</th>
                      <th>Google Meet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((cls) => (
                      <tr key={cls._id}>
                        <td>
                          <div className={styles.titleCell}>
                            {cls.title}
                            <IconLink
                              href={`/dashboard/classes/${cls._id}`}
                              fill={"var(--color-4)"}
                              icon={"Eye"}
                            />
                          </div>
                        </td>
                        <td>
                          {cls.start_date
                            ? format(new Date(cls.start_date), "dd/MM/yyyy")
                            : "—"}
                        </td>
                        <td>
                          {cls.start_date
                            ? format(new Date(cls.start_date), "h:mm a")
                            : "—"}
                        </td>
                        <td>{cls.duration ? `${cls.duration} min` : "—"}</td>
                        <td>
                          <div className={styles.actionButtons}>
                            {cls.googleMeetLink ? (
                              <IconLink
                                href={cls.googleMeetLink}
                                icon="GoogleMeet"
                                rel="noopener noreferrer"
                                target="_blank"
                              />
                            ) : (
                              <IconLink asButton disabled icon="GoogleMeet" />
                            )}
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
              <h2>
                Participantes ({participants.length}
                {courseData.max_participants > 0 &&
                  ` / ${courseData.max_participants}`}
                )
              </h2>
            </div>
            {courseData.max_participants > 0 && (
              <div className={styles.capacityBar}>
                <div
                  className={styles.capacityFill}
                  style={{
                    width: `${Math.min(
                      (participants.length / courseData.max_participants) * 100,
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
        </>
      ) : (
        <section className={styles.section}>
          <h2 className={styles.formTitle}>Editar Curso</h2>
          <CourseForm
            courseData={courseData}
            onSuccess={handleFormSuccess}
            onCancel={() => setEditMode(false)}
          />
        </section>
      )}
    </div>
  );
};

export default CourseDetailPage;
