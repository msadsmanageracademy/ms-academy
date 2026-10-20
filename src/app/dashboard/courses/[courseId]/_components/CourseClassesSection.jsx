import ClassStatusBadge from "@/views/components/ui/ClassStatusBadge";
import IconLink from "@/views/components/ui/IconLink";
import Link from "next/link";
import StatusBadge from "@/views/components/ui/StatusBadge";
import styles from "../styles.module.css";
import { formatDate, formatTime } from "@/utils/dates";
import { getClassStatus, getCourseProgress } from "@/utils/classStatus";

const PROGRESS = {
  completed: { label: "Finalizado", badge: "published" },
  "in-progress": { label: "En progreso", badge: "enrolled" },
  upcoming: { label: "Por comenzar", badge: "draft" },
};

const CourseProgress = ({ classes }) => {
  const progress = getCourseProgress(classes);
  const { label, badge } = PROGRESS[progress.status] ?? PROGRESS.upcoming;
  return (
    <div className={styles.progressSection}>
      <div className={styles.progressHeader}>
        <span>
          {progress.completedCount}/{progress.totalCount} clases completadas
        </span>
        <StatusBadge status={badge}>{label}</StatusBadge>
      </div>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress.percentage}%` }} />
      </div>
    </div>
  );
};

/** Classes of an edition with its overall progress. Classes are linked from /dashboard/classes. */
const CourseClassesSection = ({ classes }) => (
  <section aria-labelledby="edition-classes-title" className={styles.section}>
    <div className={styles.sectionHeader}>
      <h2 id="edition-classes-title">Clases de la edición ({classes.length})</h2>
      <Link className={styles.sectionLink} href="/dashboard/classes">
        Gestionar clases
      </Link>
    </div>
    {classes.length === 0 ? (
      <p className={styles.noParticipants}>
        No hay clases asignadas a esta edición. Vinculalas desde{" "}
        <Link href="/dashboard/classes">Gestión de Clases</Link>.
      </p>
    ) : (
      <>
        <CourseProgress classes={classes} />
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <caption className="visually-hidden">Clases de la edición</caption>
            <thead>
              <tr>
                <th scope="col">Título</th>
                <th scope="col">Fecha</th>
                <th scope="col">Hora</th>
                <th scope="col">Duración</th>
                <th scope="col">Progreso</th>
                <th scope="col">Google Meet</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((cls) => (
                <tr key={cls._id}>
                  <td>
                    <div className={styles.titleCell}>
                      {cls.title}
                      <IconLink
                        aria-label={`Ver clase ${cls.title}`}
                        fill="var(--color-4)"
                        href={`/dashboard/classes/${cls._id}`}
                        icon="Eye"
                        title="Ver clase"
                      />
                    </div>
                  </td>
                  <td>{cls.start_date ? formatDate(cls.start_date) : "—"}</td>
                  <td>{cls.start_date ? formatTime(cls.start_date) : "—"}</td>
                  <td>{cls.duration ? `${cls.duration} min` : "—"}</td>
                  <td>
                    {cls.start_date && cls.duration ? (
                      <ClassStatusBadge status={getClassStatus(cls.start_date, cls.duration)} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <div className={styles.actionButtons}>
                      {cls.googleMeetLink ? (
                        <IconLink
                          href={cls.googleMeetLink}
                          icon="GoogleMeet"
                          rel="noopener noreferrer"
                          target="_blank"
                          title="Abrir Google Meet"
                        />
                      ) : (
                        <IconLink asButton disabled icon="GoogleMeet" title="Sin evento de Calendar" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )}
  </section>
);

export default CourseClassesSection;
