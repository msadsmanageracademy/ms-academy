import ClassStatusBadge from "@/views/components/ui/ClassStatusBadge";
import IconLink from "@/views/components/ui/IconLink";
import { getClassStatus } from "@/utils/classStatus";
import styles from "../styles.module.css";
import { classEditionTitle, isCompleted, priceLabel } from "./classList";
import { formatDate, formatTime } from "@/utils/dates";

const ExternalLinks = ({ links }) =>
  links.length === 0 ? (
    "—"
  ) : (
    <ul className={styles.resourceLinks}>
      {links.map((link, i) => (
        <li key={i}>
          <a href={link.url} rel="noopener noreferrer" target="_blank">
            {link.title}
          </a>
        </li>
      ))}
    </ul>
  );

/** Meet link, or why it isn't available yet (edition classes: only once the edition is paid). */
const MeetCell = ({ classItem }) => {
  if (classItem.editionId && classItem.userEditionPaymentStatus !== "paid") {
    return <span className={styles.lockedMeet}>🔒 Pago pendiente</span>;
  }
  if (!classItem.googleEventId) return "Próximamente";
  return (
    <div className={styles.calendarStatus}>
      <IconLink
        href={classItem.googleMeetLink}
        icon="GoogleMeet"
        rel="noopener noreferrer"
        target="_blank"
        title="Abrir Google Meet"
      />
    </div>
  );
};

const PAYMENT_LABELS = { paid: "Pagado", pending: "Pago pendiente" };

const StudentClassRow = ({ classItem, review, onReview, onUnenroll }) => {
  const completed = isCompleted(classItem);
  const edition = classEditionTitle(classItem); // "Curso · Septiembre 2026", or null if standalone
  return (
    <tr>
      <td>{classItem.title}</td>
      <td>
        {edition ? (
          <div className={styles.courseCell}>
            <span>{edition}</span>
            {PAYMENT_LABELS[classItem.userEditionPaymentStatus] && (
              <span className={styles.courseCellEdition}>{PAYMENT_LABELS[classItem.userEditionPaymentStatus]}</span>
            )}
          </div>
        ) : (
          "—"
        )}
      </td>
      <td>{classItem.start_date ? formatDate(classItem.start_date) : "—"}</td>
      <td>{classItem.start_date ? formatTime(classItem.start_date) : "—"}</td>
      <td>{classItem.duration} min</td>
      <td>{classItem.editionId ? "Incluido en el curso" : priceLabel(classItem.price)}</td>
      <td>
        <ClassStatusBadge
          status={getClassStatus(classItem.start_date, classItem.duration, classItem.status)}
        />
      </td>
      <td>
        <MeetCell classItem={classItem} />
      </td>
      <td>
        <ExternalLinks
          links={classItem.recording_url ? [{ title: "Grabación", url: classItem.recording_url }] : []}
        />
      </td>
      <td>
        <ExternalLinks links={classItem.resources ?? []} />
      </td>
      <td>
        <div className={styles.actionButtons}>
          {!classItem.editionId && (
            <IconLink
              asButton
              disabled={!completed}
              fill={review ? "var(--warning)" : "var(--color-4)"}
              icon="Star"
              onClick={() => onReview(classItem)}
              title={
                !completed
                  ? "Disponible al finalizar la clase"
                  : review
                    ? "Editar tu reseña"
                    : "Dejar una reseña"
              }
            />
          )}
          <IconLink
            asButton
            danger
            disabled={classItem.status === "enrolled"}
            icon="Delete"
            onClick={() => onUnenroll(classItem)}
            title={
              classItem.status === "enrolled"
                ? "La inscripción se gestiona desde el curso"
                : "Cancelar inscripción"
            }
          />
        </div>
      </td>
    </tr>
  );
};

export default StudentClassRow;
