import IconLink from "@/views/components/ui/IconLink";
import { archiveCourseError } from "@/server/courses/rules";
import { formatDate } from "@/utils/dates";
import styles from "../styles.module.css";

const COURSE_STATUS = {
  active: { label: "Activo", className: styles.chipActive },
  archived: { label: "Archivado", className: styles.chipArchived },
};

const InfoItem = ({ label, children, fullWidth = false }) => (
  <div className={`${styles.infoItem} ${fullWidth ? styles.fullWidth : ""}`}>
    <dt className={styles.label}>{label}</dt>
    <dd className={styles.value}>{children}</dd>
  </div>
);

/**
 * The course content (always editable) and its lifecycle: archive / reactivate and
 * delete. Deleting is only offered while no edition has enrollments (archive instead).
 */
const CourseInfoSection = ({ course, hasEnrollments, onEdit, onToggleStatus, onDelete }) => {
  const archived = course.status === "archived";
  // Same rule as the server: not while an edition is published and upcoming or in progress
  const archiveError = archived ? null : archiveCourseError({ editions: course.editions ?? [] });
  const status = COURSE_STATUS[course.status] ?? COURSE_STATUS.active;

  return (
    <section aria-labelledby="course-info-title" className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 id="course-info-title">Información del curso</h2>
        <div className={styles.actionButtons}>
          <IconLink asButton warning icon="Pencil" onClick={onEdit} title="Editar curso" />
          <IconLink
            aria-label={archived ? "Reactivar curso" : "Archivar curso"}
            asButton
            danger={!archived}
            disabled={Boolean(archiveError)}
            icon={archived ? "Confetti" : "Pin"}
            onClick={onToggleStatus}
            success={archived}
            title={archiveError ?? (archived ? "Reactivar curso" : "Archivar curso")}
          />
          <IconLink
            asButton
            danger
            disabled={hasEnrollments}
            icon="Delete"
            onClick={onDelete}
            title={hasEnrollments ? "Tiene inscriptos: archivalo en su lugar" : "Eliminar curso"}
          />
        </div>
      </div>
      <dl className={styles.infoGrid}>
        <InfoItem label="Título">{course.title}</InfoItem>
        <InfoItem label="Estado">
          <span className={`${styles.chip} ${status.className}`}>{status.label}</span>
        </InfoItem>
        {course.createdAt && <InfoItem label="Creado">{formatDate(course.createdAt)}</InfoItem>}
        <InfoItem fullWidth label="Descripción breve">
          {course.short_description || "Sin descripción"}
        </InfoItem>
        {course.full_description && (
          <InfoItem fullWidth label="Descripción completa">
            {course.full_description}
          </InfoItem>
        )}
      </dl>
    </section>
  );
};

export default CourseInfoSection;
