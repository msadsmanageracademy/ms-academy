"use client";

import ClassStatusBadge from "@/views/components/ui/ClassStatusBadge";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import StarRating from "@/views/components/ui/StarRating";
import { getCourseTimeStatus } from "@/utils/classStatus";
import styles from "./styles.module.css";
import { formatDate, formatWeekdayDateTime } from "@/utils/dates";

export const Board = ({ items, title, type, onSignUp }) => {
  if (!items.length) {
    return (
      <div
        className={`${styles.board} ${type === "course" ? styles.courses : ""}`}
      >
        <h2 className={styles.boardTitle}>{title}</h2>
        <div className={styles.emptyMessage}>
          {type === "class"
            ? "No hay clases disponibles"
            : "No hay cursos programados"}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.board} ${type === "course" ? styles.courses : ""}`}
    >
      <h2 className={styles.boardTitle}>{title}</h2>
      <div className={styles.notesContainer}>
        {type === "class"
          ? items.map(
              ({
                _id,
                start_date,
                title,
                participantsCount = 0,
                max_participants,
              }) => {
                const isFull =
                  max_participants !== null &&
                  max_participants !== undefined &&
                  participantsCount >= max_participants;
                return (
                  <div
                    key={_id}
                    className={`${styles.postIt} ${styles.classNote}`}
                  >
                    <div className={styles.postItPin}></div>
                    <h3 className={styles.postItTitle}>{title}</h3>
                    <div className={styles.postItText}>
                      <p>
                        {formatWeekdayDateTime(start_date)}
                      </p>
                      {max_participants !== null &&
                        max_participants !== undefined && (
                          <p>
                            Cupo: {participantsCount}/{max_participants}
                            {isFull ? " — Lleno" : ""}
                          </p>
                        )}
                    </div>
                    {!isFull && (
                      <PrimaryLink
                        aria-label={`Inscribirse a ${title}`}
                        asButton
                        dark
                        onClick={() => onSignUp(_id)}
                      />
                    )}
                  </div>
                );
              },
            )
          : null}
        {type === "course"
          ? items.map(
              ({
                _id,
                amount_of_classes,
                avgRating,
                end_date,
                max_participants,
                reviewCount,
                start_date,
                status,
                title,
                enrollmentCount,
              }) => {
                const isFull =
                  max_participants !== null &&
                  max_participants !== undefined &&
                  enrollmentCount !== undefined &&
                  enrollmentCount >= max_participants;
                const timeStatus = getCourseTimeStatus(
                  start_date,
                  end_date,
                  status,
                );
                return (
                  <div
                    key={_id}
                    className={`${styles.postIt} ${styles.courseNote}`}
                  >
                    <div className={styles.postItPin}></div>
                    <h3 className={styles.postItTitle}>{title}</h3>
                    <div className={styles.postItText}>
                      {timeStatus && (
                        <ClassStatusBadge status={timeStatus} gender="m" />
                      )}
                      {avgRating ? (
                        <p className={styles.courseRating}>
                          <StarRating
                            value={Math.round(avgRating)}
                            readOnly
                            size="sm"
                          />
                          {avgRating} ({reviewCount})
                        </p>
                      ) : null}
                      <p>
                        Comienza:{" "}
                        {start_date
                          ? formatDate(start_date)
                          : "No se puede mostrar la fecha"}
                      </p>
                      <p>Cantidad de clases: {amount_of_classes}</p>
                      <p>
                        Cupo:{" "}
                        {max_participants
                          ? `${enrollmentCount ?? "?"}/${max_participants}${isFull ? " — Lleno" : ""}`
                          : "Ilimitado"}
                      </p>
                    </div>
                    <PrimaryLink
                      aria-label={`Ver detalles de ${title}`}
                      dark
                      href={`/content/courses/${_id}`}
                      text={"Ver detalles"}
                    />
                  </div>
                );
              },
            )
          : null}
      </div>
    </div>
  );
};
