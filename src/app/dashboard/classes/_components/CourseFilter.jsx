import styles from "../styles.module.css";
import { getCourseOptions } from "./classList";

/** Filters the class list by course ("all", "none" or a course id). */
const CourseFilter = ({ classes, value, onChange }) => (
  <select
    aria-label="Filtrar por curso"
    className={styles.filterSelect}
    value={value}
    onChange={(e) => onChange(e.target.value)}
  >
    <option value="all">Todas</option>
    {getCourseOptions(classes).map((c) => (
      <option key={c.id} value={c.id}>
        {c.title}
      </option>
    ))}
    {classes.some((c) => !c.courseId) && <option value="none">Sin curso</option>}
  </select>
);

export default CourseFilter;
