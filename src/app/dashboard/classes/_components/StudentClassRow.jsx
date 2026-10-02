import ClassStatusBadge from "@/views/components/ui/ClassStatusBadge";
import IconLink from "@/views/components/ui/IconLink";
import { getClassStatus } from "@/utils/classStatus";
import styles from "../styles.module.css";
import { formatDate, formatTime } from "@/utils/dates";
import { isCompleted, priceLabel } from "./classList";

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

/** Meet link, or why it isn't available yet. */
const MeetCell = ({ classItem }) => {
  if (classItem.courseId && classItem.userCoursePaymentStatus !== "paid") {
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

const StudentClassRow = ({ classItem, review, onReview, onUnenroll }) => {
  const completed = isCompleted(classItem);
  return (
    <tr>
      <td>{classItem.title}</td>
      <td>{classItem.courseTitle || "—"}</td>
      <td>{classItem.start_date ? formatDate(classItem.start_date) : "—"}</td>
      <td>{classItem.start_date ? formatTime(classItem.start_date) : "—"}</td>
      <td>{classItem.duration} min</td>
      <td>{classItem.courseTitle ? "Incluido en el curso" : priceLabel(classItem.price)}</td>
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
          {/* Course classes are reviewed through the course */}
          {!classItem.courseId && (
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
