import Modal from "@/views/components/ui/Modal";
import styles from "../styles.module.css";
import { useState } from "react";

/** Lets the admin pick the course a class is linked to. */
const LinkCourseModal = ({ classTitle, courses, onCancel, onConfirm }) => {
  const [courseId, setCourseId] = useState("");

  return (
    <Modal
      className={`${styles.modal} dark-surface`}
      onClose={onCancel}
      overlayClassName={styles.modalOverlay}
      title="Vincular clase a curso"
    >
      <p className={styles.modalSubtitle}>{classTitle}</p>
      <label className="visually-hidden" htmlFor="link-course-select">
        Curso
      </label>
      <select
        className={styles.filterSelect}
        id="link-course-select"
        value={courseId}
        onChange={(e) => setCourseId(e.target.value)}
      >
        <option value="">Seleccionar curso...</option>
        {courses.map((course) => (
          <option key={course._id} value={course._id}>
            {course.title}
          </option>
        ))}
      </select>
      <div className={styles.modalActions}>
        <button className={styles.modalCancel} onClick={onCancel} type="button">
          Cancelar
        </button>
        <button
          className={styles.modalConfirm}
          disabled={!courseId}
          onClick={() => onConfirm(courseId)}
          type="button"
        >
          Vincular
        </button>
      </div>
    </Modal>
  );
};

export default LinkCourseModal;
