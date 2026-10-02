import IconLink from "@/views/components/ui/IconLink";
import StatusBadge from "@/views/components/ui/StatusBadge";
import styles from "../styles.module.css";
import { es } from "date-fns/locale";
import { formatDateAtTime } from "@/utils/dates";
import { formatDistanceToNow } from "date-fns";

const STATUS_LABELS = { enrolled: "Asociada", published: "Publicada", draft: "Borrador" };

const InfoItem = ({ label, children }) => (
  <div className={styles.infoItem}>
    <span className={styles.label}>{label}:</span>
    {children}
  </div>
);

const ClassInfoSection = ({ classData, courseTitle, onEdit }) => (
  <section className={styles.section}>
    <div className={styles.sectionHeader}>
      <h2>Información de la Clase</h2>
      <div className={styles.actionButtons}>
        <IconLink asButton warning icon="Pencil" onClick={onEdit} title="Editar clase" />
      </div>
    </div>
    <div className={styles.infoGrid}>
      <InfoItem label="Título">
        <span className={styles.value}>{classData.title}</span>
      </InfoItem>
      <InfoItem label="Descripción">
        <span className={styles.value}>{classData.short_description || "Sin descripción"}</span>
      </InfoItem>
      <InfoItem label="Fecha">
        <span className={styles.value}>
          {classData.start_date ? (
            <>
              {formatDateAtTime(classData.start_date)}
              <span className={styles.relative}>
                ({formatDistanceToNow(new Date(classData.start_date), { locale: es })})
              </span>
            </>
          ) : (
            "Sin fecha asignada"
          )}
        </span>
      </InfoItem>
      <InfoItem label="Duración">
        <span className={styles.value}>{classData.duration} minutos</span>
      </InfoItem>
      <InfoItem label="Precio">
        <span className={styles.value}>
          {classData.price === 0 ? "Gratis" : `$${classData.price}`}
        </span>
      </InfoItem>
      <InfoItem label="Estado">
        <StatusBadge status={classData.status}>
          {STATUS_LABELS[classData.status] ?? "Borrador"}
        </StatusBadge>
      </InfoItem>
      <InfoItem label="Capacidad">
        <span className={styles.value}>
          {!classData.max_participants
            ? "Sin límite"
            : `${classData.participants?.length ?? 0} / ${classData.max_participants}`}
        </span>
      </InfoItem>
      <InfoItem label="Curso">
        <span className={styles.value}>
          {courseTitle ? (
            <span className={styles.linkedValue}>
              {courseTitle}
              <IconLink
                fill="var(--color-4)"
                href={`/dashboard/courses/${classData.courseId}`}
                icon="Eye"
                title="Ver curso"
              />
            </span>
          ) : (
            "Clase independiente"
          )}
        </span>
      </InfoItem>
      {classData.googleEventId && (
        <InfoItem label="Google">
          <span className={styles.value}>
            {classData.googleMeetLink && (
              <IconLink
                href={classData.googleMeetLink}
                icon="GoogleMeet"
                rel="noopener noreferrer"
                size={24}
                target="_blank"
                title="Abrir Google Meet"
              />
            )}
            {classData.calendarEventLink && (
              <IconLink
                href={classData.calendarEventLink}
                icon="GoogleCalendar"
                rel="noopener noreferrer"
                size={24}
                target="_blank"
                title="Abrir en Google Calendar"
              />
            )}
          </span>
        </InfoItem>
      )}
    </div>
  </section>
);

export default ClassInfoSection;
