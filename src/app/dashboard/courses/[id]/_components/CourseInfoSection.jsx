import IconLink from "@/views/components/ui/IconLink";
import StatusBadge from "@/views/components/ui/StatusBadge";
import { formatDate } from "@/utils/dates";
import styles from "../styles.module.css";

const InfoItem = ({ label, children, fullWidth = false }) => (
  <div className={`${styles.infoItem} ${fullWidth ? styles.fullWidth : ""}`}>
    <span className={styles.label}>{label}:</span>
    {children}
  </div>
);

const CourseInfoSection = ({ course, onEdit, onClone }) => (
  <section className={styles.section}>
    <div className={styles.sectionHeader}>
      <h2>Información del Curso</h2>
      <div className={styles.actionButtons}>
        <IconLink asButton warning icon="Pencil" onClick={onEdit} title="Editar curso" />
        <IconLink
          asButton
          icon="Redo"
          onClick={onClone}
          success
          title="Repetir curso (crear nueva iteración)"
        />
      </div>
    </div>
    <div className={styles.infoGrid}>
      <InfoItem label="Título">
        <span className={styles.value}>{course.title}</span>
      </InfoItem>
      <InfoItem label="Descripción corta">
        <span className={styles.value}>{course.short_description || "Sin descripción"}</span>
      </InfoItem>
      <InfoItem label="Estado">
        <StatusBadge status={course.status}>
          {course.status === "published" ? "Publicado" : "Borrador"}
        </StatusBadge>
      </InfoItem>
      <InfoItem label="Precio">
        <span className={styles.value}>{course.price === 0 ? "Gratis" : `$${course.price}`}</span>
      </InfoItem>
      <InfoItem label="Capacidad">
        <span className={styles.value}>
          {!course.max_participants
            ? "Sin límite"
            : `${course.enrollmentCount ?? 0} / ${course.max_participants}`}
        </span>
      </InfoItem>
      <InfoItem label="Clases">
        <span className={styles.value}>{course.amount_of_classes ?? 0}</span>
      </InfoItem>
      {course.start_date && (
        <InfoItem label="Inicio">
          <span className={styles.value}>{formatDate(course.start_date)}</span>
        </InfoItem>
      )}
      {course.end_date && (
        <InfoItem label="Fin">
          <span className={styles.value}>{formatDate(course.end_date)}</span>
        </InfoItem>
      )}
      {course.full_description && (
        <InfoItem label="Descripción completa" fullWidth>
          <span className={styles.value}>{course.full_description}</span>
        </InfoItem>
      )}
    </div>
  </section>
);

export default CourseInfoSection;
