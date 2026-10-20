import ClassStatusBadge from "@/views/components/ui/ClassStatusBadge";
import EditionForm from "./EditionForm";
import IconLink from "@/views/components/ui/IconLink";
import { ReviewSummary } from "@/views/components/ui/ReviewList";
import StatusBadge from "@/views/components/ui/StatusBadge";
import { adminEditionNumber } from "@/utils/courseEditions";
import { formatDate } from "@/utils/dates";
import styles from "../../../styles.module.css";
import { deleteEditionError, editionEditError, publishEditionError, unpublishEditionError } from "@/server/courses/rules";
import { formatAmount, formatPrice } from "@/utils/price";


const InfoItem = ({ label, children, fullWidth = false }) => (
  <div className={`${styles.infoItem} ${fullWidth ? styles.fullWidth : ""}`}>
    <dt className={styles.label}>{label}</dt>
    <dd className={styles.value}>{children}</dd>
  </div>
);

const capacityText = ({ enrollmentCount = 0, max_participants }) =>
  max_participants
    ? `${enrollmentCount} / ${max_participants}`
    : `Sin límite (${enrollmentCount} ${enrollmentCount === 1 ? "inscripto" : "inscriptos"})`;

/**
 * Data of one edition (price, capacity, dates, figures) and its lifecycle: edit price
 * and capacity (drafts only), publish / unpublish, delete (drafts only) and create the
 * next edition. The same pure rules as the server decide which actions are available;
 * the server checks them again on every action.
 */
const EditionInfoSection = ({
  edition,
  courseStatus,
  classes,
  editing,
  onEdit,
  onCloseEdit,
  onSaved,
  onToggleStatus,
  onDelete,
  onNewEdition,
}) => {
  const published = edition.status === "published";
  const editError = editionEditError(edition);
  const deleteError = deleteEditionError(edition);
  const statusError = published
    ? unpublishEditionError(edition)
    : publishEditionError({ courseStatus, classes, now: new Date() });

  return (
    <section aria-labelledby="edition-info-title" className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 id="edition-info-title">{editing ? "Editar precio y cupo" : "Información de la edición"}</h2>
        {!editing && (
          <div className={styles.actionButtons}>
            <IconLink
              aria-label="Editar precio y cupo"
              asButton
              disabled={Boolean(editError)}
              icon="Pencil"
              onClick={onEdit}
              title={editError ?? "Editar precio y cupo"}
              warning
            />
            <IconLink
              aria-label={published ? "Despublicar edición" : "Publicar edición"}
              asButton
              danger={published}
              disabled={Boolean(statusError)}
              icon={published ? "Pin" : "Confetti"}
              onClick={onToggleStatus}
              success={!published}
              title={statusError ?? (published ? "Despublicar edición" : "Publicar edición")}
            />
            <IconLink
              aria-label="Eliminar edición"
              asButton
              danger
              disabled={Boolean(deleteError)}
              icon="Delete"
              onClick={onDelete}
              title={deleteError ?? "Eliminar edición"}
            />
            <IconLink
              aria-label="Crear una nueva edición de este curso"
              asButton
              icon="Plus"
              onClick={onNewEdition}
              success
              text="Nueva edición"
              title="Crear una nueva edición de este curso"
            />
          </div>
        )}
      </div>

      {editing ? (
        <EditionForm edition={edition} onCancel={onCloseEdit} onSuccess={onSaved} />
      ) : (
        <>
          {!published && statusError && (
            <p className={styles.editionHint} role="note">
              {statusError}
            </p>
          )}
          <dl className={styles.infoGrid}>
            <InfoItem label="Edición">{edition.label}</InfoItem>
            <InfoItem label="Número">{adminEditionNumber(edition.adminNumber, edition.editionCount)}</InfoItem>
            <InfoItem label="Estado">
              <span className={styles.badgeRow}>
                <StatusBadge status={edition.status}>{published ? "Publicada" : "Borrador"}</StatusBadge>
                <ClassStatusBadge gender="f" status={edition.timeStatus} />
              </span>
            </InfoItem>
            <InfoItem label="Fechas">
              {edition.start_date
                ? `${formatDate(edition.start_date)} – ${formatDate(edition.end_date)}`
                : "Sin fechas (se definen con sus clases)"}
            </InfoItem>
            <InfoItem label="Clases">{edition.amount_of_classes ?? 0}</InfoItem>
            <InfoItem label="Precio">{formatPrice(edition.price)}</InfoItem>
            <InfoItem label="Cupo">{capacityText(edition)}</InfoItem>
            <InfoItem label="Alumnos pagos">{edition.paidCount ?? 0}</InfoItem>
            <InfoItem label="Ingreso estimado">{formatAmount((edition.price ?? 0) * (edition.paidCount ?? 0))}</InfoItem>
            <InfoItem label="Reseñas">
              {edition.reviewCount ? (
                <ReviewSummary
                  avgRating={edition.avgRating}
                  className={styles.ratingSummary}
                  reviewCount={edition.reviewCount}
                />
              ) : (
                "Sin reseñas"
              )}
            </InfoItem>
          </dl>
        </>
      )}
    </section>
  );
};

export default EditionInfoSection;
