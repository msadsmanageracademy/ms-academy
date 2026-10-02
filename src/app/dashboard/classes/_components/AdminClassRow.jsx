import ClassStatusBadge from "@/views/components/ui/ClassStatusBadge";
import IconLink from "@/views/components/ui/IconLink";
import StatusBadge from "@/views/components/ui/StatusBadge";
import styles from "../styles.module.css";
import { formatDate, formatTime } from "@/utils/dates";
import { getClassStatus } from "@/utils/classStatus";
import { priceLabel } from "./classList";

const STATUS_LABELS = { published: "Publicada", enrolled: "Asociada", draft: "Borrador" };

/** Google cell: connect Calendar, links of the existing event, or create one. */
const CalendarCell = ({ classItem, hasCalendarAccess, isAdding, onConnect, onAdd }) => {
  if (!hasCalendarAccess) {
    return (
      <div className={styles.calendarButton}>
        <IconLink asButton icon="GoogleCalendar" onClick={onConnect} text="Conectar" />
      </div>
    );
  }
  if (classItem.googleEventId) {
    return (
      <div className={styles.calendarStatus}>
        <IconLink
          href={classItem.calendarEventLink}
          icon="GoogleCalendar"
          rel="noopener noreferrer"
          target="_blank"
          title="Abrir en Google Calendar"
        />
        {classItem.googleMeetLink && (
          <IconLink
            href={classItem.googleMeetLink}
            icon="GoogleMeet"
            rel="noopener noreferrer"
            target="_blank"
            title="Abrir Google Meet"
          />
        )}
      </div>
    );
  }
  return (
    <div className={styles.calendarButton}>
      <IconLink
        asButton
        disabled={isAdding}
        icon="GoogleCalendar"
        onClick={onAdd}
        text={isAdding ? "Aguarde..." : "Agregar"}
      />
    </div>
  );
};

const AdminClassRow = ({
  classItem,
  hasCalendarAccess,
  isAddingToCalendar,
  onConnectCalendar,
  onAddToCalendar,
  onLink,
  onUnlink,
  onToggleStatus,
  onDelete,
}) => {
  const { status } = classItem;
  return (
    <tr>
      <td>{classItem.title}</td>
      <td>{classItem.courseTitle || "—"}</td>
      <td>{classItem.start_date ? formatDate(classItem.start_date) : "—"}</td>
      <td>{classItem.start_date ? formatTime(classItem.start_date) : "—"}</td>
      <td>{classItem.duration} min</td>
      <td>{priceLabel(classItem.price)}</td>
      <td>
        {classItem.participantsCount ?? 0} / {classItem.max_participants || "∞"}
      </td>
      <td>
        <ClassStatusBadge
          status={getClassStatus(classItem.start_date, classItem.duration, status)}
        />
      </td>
      <td>
        <StatusBadge status={status}>{STATUS_LABELS[status] ?? "Borrador"}</StatusBadge>
      </td>
      <td>
        <CalendarCell
          classItem={classItem}
          hasCalendarAccess={hasCalendarAccess}
          isAdding={isAddingToCalendar}
          onConnect={onConnectCalendar}
          onAdd={() => onAddToCalendar(classItem)}
        />
      </td>
      <td>
        <div className={styles.actionButtons}>
          <IconLink
            fill="var(--color-4)"
            href={`/dashboard/classes/${classItem._id}`}
            icon="Eye"
            title="Ver detalles"
          />
          {classItem.courseId ? (
            <IconLink
              asButton
              icon="MinusSign"
              onClick={() => onUnlink(classItem)}
              title={`Desvincular de "${classItem.courseTitle}"`}
              warning
            />
          ) : (
            <IconLink
              asButton
              disabled={status === "published"}
              icon="Courses"
              onClick={() => onLink(classItem)}
              title={
                status === "published"
                  ? "No se puede vincular una clase publicada"
                  : "Vincular a curso"
              }
              warning
            />
          )}
          <IconLink
            asButton
            disabled={status === "enrolled"}
            icon={status === "draft" ? "Confetti" : "Pin"}
            onClick={() => onToggleStatus(classItem)}
            success={status === "draft"}
            title={status === "published" ? "Ocultar" : "Publicar"}
            warning={status === "published"}
          />
          <IconLink
            asButton
            danger
            disabled={status !== "draft"}
            icon="Delete"
            onClick={() => onDelete(classItem)}
            title={status !== "draft" ? "Solo se pueden eliminar clases archivadas" : "Eliminar"}
          />
        </div>
      </td>
    </tr>
  );
};

export default AdminClassRow;
