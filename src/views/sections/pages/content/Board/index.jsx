"use client";

import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";

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
          ? items.map(({ _id, start_date, title }) => (
              <div key={_id} className={`${styles.postIt} ${styles.classNote}`}>
                <div className={styles.postItPin}></div>
                <h3 className={styles.postItTitle}>{title}</h3>
                <div className={styles.postItText}>
                  <p>
                    Día: {new Date(start_date).toLocaleDateString("es-AR")}{" "}
                  </p>
                  <p>Hora: {new Date(start_date).toLocaleTimeString()}</p>
                </div>
                <PrimaryLink asButton onClick={() => onSignUp(_id)} />
              </div>
            ))
          : null}
        {type === "course"
          ? items.map(
              ({
                _id,
                amount_of_classes,
                max_participants,
                start_date,
                title,
              }) => (
                <div
                  key={_id}
                  className={`${styles.postIt} ${styles.courseNote}`}
                >
                  <div className={styles.postItPin}></div>
                  <h3 className={styles.postItTitle}>{title}</h3>
                  <div className={styles.postItText}>
                    <p>
                      Comienza:{" "}
                      {start_date
                        ? new Date(start_date).toLocaleDateString("es-AR")
                        : "No se puede mostrar la fecha"}
                    </p>
                    <p>Cantidad de clases: {amount_of_classes}</p>
                    <p>Cupo: {max_participants ?? "Ilimitado"} </p>
                  </div>
                  <PrimaryLink
                    href={`/content/courses/${_id}`}
                    text={"Ver detalles"}
                  />
                </div>
              )
            )
          : null}
      </div>
    </div>
  );
};
