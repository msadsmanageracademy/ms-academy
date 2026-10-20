import Link from "next/link";
import { adminEditionNumber } from "@/utils/courseEditions";
import styles from "../../../styles.module.css";

/**
 * "Cursos › <curso> › Septiembre 2026 · Edición N de M". N is the chronological position
 * of the edition among the M editions of the course (informational: it may change when
 * editions are added, dated or deleted).
 */
const EditionBreadcrumb = ({ course, label, adminNumber, editionCount }) => (
  <nav aria-label="Ubicación" className={styles.breadcrumb}>
    <ol className={styles.breadcrumbList}>
      <li>
        <Link href="/dashboard/courses">Cursos</Link>
      </li>
      <li>
        <Link href={`/dashboard/courses/${course._id}`}>{course.title}</Link>
      </li>
      <li aria-current="page">{`${label} · ${adminEditionNumber(adminNumber, editionCount)}`}</li>
    </ol>
  </nav>
);

export default EditionBreadcrumb;
