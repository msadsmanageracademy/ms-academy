import styles from "./styles.module.css";

const statusClassMap = {
  published: styles.published,
  enrolled: styles.enrolled,
  draft: styles.draft,
};

export default function StatusBadge({ status, children }) {
  return (
    <span
      className={`${styles.badge} ${statusClassMap[status] ?? styles.draft}`}
    >
      {children}
    </span>
  );
}
