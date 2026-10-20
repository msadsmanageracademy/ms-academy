import Modal from "@/views/components/ui/Modal";
import styles from "../styles.module.css";
import { useMemo, useState } from "react";

const STATUS_NOTE = { draft: "borrador", published: "publicada" };

/** Courses (by title) with their editions (newest first) from a flat edition list. */
export function groupEditionsByCourse(editions) {
  const byCourse = new Map();
  for (const edition of editions) {
    const key = String(edition.courseId);
    if (!byCourse.has(key)) byCourse.set(key, { _id: key, title: edition.courseTitle, editions: [] });
    byCourse.get(key).editions.push(edition);
  }
  return [...byCourse.values()]
    .map((course) => ({ ...course, editions: [...course.editions].sort((a, b) => b.adminNumber - a.adminNumber) }))
    .sort((a, b) => String(a.title ?? "").localeCompare(String(b.title ?? ""), "es"));
}

/**
 * "Vincular clase": the admin picks the course first and then one of its editions.
 * `editions` = listAdminEditions ({ _id, courseId, courseTitle, adminNumber, label, status }),
 * listed by date label, chronologically last first.
 * onConfirm receives the chosen edition.
 */
const LinkEditionModal = ({ classTitle, editions, onCancel, onConfirm }) => {
  const courses = useMemo(() => groupEditionsByCourse(editions), [editions]);
  const [courseId, setCourseId] = useState("");
  const [editionId, setEditionId] = useState("");
  const course = courses.find((c) => c._id === courseId) ?? null;
  const edition = course?.editions.find((e) => String(e._id) === editionId) ?? null;

  return (
    <Modal
      className={`${styles.modal} dark-surface`}
      onClose={onCancel}
      overlayClassName={styles.modalOverlay}
      title="Vincular clase a una edición"
    >
      <p className={styles.modalSubtitle}>{classTitle}</p>
      {courses.length === 0 ? (
        <p className={styles.modalSubtitle}>Todavía no hay cursos con ediciones. Creá un curso primero.</p>
      ) : (
        <>
          <div className={styles.modalField}>
            <label htmlFor="link-course-select">Curso</label>
            <select
              className={styles.filterSelect}
              id="link-course-select"
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setEditionId("");
              }}
            >
              <option value="">Seleccionar curso...</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.modalField}>
            <label htmlFor="link-edition-select">Edición</label>
            <select
              className={styles.filterSelect}
              disabled={!course}
              id="link-edition-select"
              value={editionId}
              onChange={(e) => setEditionId(e.target.value)}
            >
              <option value="">{course ? "Seleccionar edición..." : "Elegí un curso primero"}</option>
              {course?.editions.map((e) => (
                <option key={e._id} value={String(e._id)}>
                  {e.label} ({STATUS_NOTE[e.status] ?? e.status})
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      <div className={styles.modalActions}>
        <button className={styles.modalCancel} onClick={onCancel} type="button">
          Cancelar
        </button>
        <button
          className={styles.modalConfirm}
          disabled={!edition}
          onClick={() => onConfirm(edition)}
          type="button"
        >
          Vincular
        </button>
      </div>
    </Modal>
  );
};

export default LinkEditionModal;
