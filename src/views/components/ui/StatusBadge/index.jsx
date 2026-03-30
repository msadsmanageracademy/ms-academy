import styles from "./styles.module.css";

const statusClassMap = {
  draft: styles.draft,
  enrolled: styles.enrolled,
  pending: styles.pending,
  published: styles.published,
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
