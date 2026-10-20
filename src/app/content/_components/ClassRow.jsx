import ClassSignUpButton from "./ClassSignUpButton";
import Link from "next/link";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import SeatsInfo from "./SeatsInfo";
import styles from "../styles.module.css";
import { Clock } from "@/views/components/icons";
import { formatLongDateAtTime, formatTime, getDateParts } from "@/utils/dates";
import { getSeatsInfo } from "@/utils/seats";

// Native button: PrimaryLink's asButton attaches an onClick, which a Server Component can't pass
const DisabledCta = ({ label, text }) => (
  <button aria-label={label} className={styles.ctaDisabled} disabled type="button">
    {text}
  </button>
);

/**
 * CTA by viewer, in order of precedence: admin → manage; participant → already
 * enrolled; full → no seats; visitor or student → sign up.
 */
const ClassAction = ({ classItem, seatsFull, viewerRole }) => {
  const { _id, isParticipant, title } = classItem;

  if (viewerRole === "admin") {
    return (
      <PrimaryLink
        aria-label={`Gestionar ${title}`}
        dark
        href="/dashboard/classes"
        text="Gestionar"
      />
    );
  }
  if (isParticipant) {
    return (
      <>
        <DisabledCta label={`Ya estás inscripto en ${title}`} text="Ya estás inscripto" />
        <Link
          aria-label={`Ver mis clases (${title})`}
          className={styles.secondaryLink}
          href="/dashboard/classes"
        >
          Ver mis clases
        </Link>
      </>
    );
  }
  if (seatsFull) {
    return <DisabledCta label={`Cupo completo en ${title}`} text="Cupo completo" />;
  }
  return <ClassSignUpButton classId={_id} title={title} viewerRole={viewerRole} />;
};

/** Agenda row of a free class: date block, details and the viewer's CTA. */
const ClassRow = ({ classItem, viewerRole }) => {
  const {
    _id,
    duration,
    max_participants,
    participantsCount = 0,
    short_description,
    start_date,
    title,
  } = classItem;
  const parts = getDateParts(start_date);
  const seats = getSeatsInfo(participantsCount, max_participants);
  const titleId = `class-${_id}`;

  return (
    <article aria-labelledby={titleId} className={styles.row}>
      <time className={styles.dateBlock} dateTime={start_date}>
        {parts ? (
          <>
            <span aria-hidden="true" className={styles.weekday}>
              {parts.weekday}
            </span>
            <span aria-hidden="true" className={styles.day}>
              {parts.day}
            </span>
            <span aria-hidden="true" className={styles.month}>
              {parts.month}
            </span>
          </>
        ) : null}
        <span className="visually-hidden">{formatLongDateAtTime(start_date)}</span>
      </time>
      <div className={styles.rowBody}>
        <h3 className={styles.rowTitle} id={titleId}>
          {title}
        </h3>
        {short_description ? <p className={styles.rowDescription}>{short_description}</p> : null}
        <div className={styles.rowMeta}>
          <p className={styles.metaItem}>
            <Clock fill="currentColor" size={16} /> {formatTime(start_date)} · {duration} min
          </p>
          <SeatsInfo max={max_participants} taken={participantsCount} />
        </div>
      </div>
      <div className={`${styles.actions} ${styles.rowActions}`}>
        <ClassAction classItem={classItem} seatsFull={seats.full} viewerRole={viewerRole} />
      </div>
    </article>
  );
};

export default ClassRow;
