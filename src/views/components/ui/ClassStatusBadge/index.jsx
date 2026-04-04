import styles from "./styles.module.css";

const labelMap = {
  f: {
    upcoming: "Próxima",
    ongoing: "En curso",
    "in-progress": "En progreso",
    completed: "Finalizada",
  },
  m: {
    upcoming: "Próximo",
    ongoing: "En curso",
    "in-progress": "En progreso",
    completed: "Finalizado",
  },
};

const styleKey = {
  upcoming: "upcoming",
  ongoing: "ongoing",
  "in-progress": "ongoing",
  completed: "completed",
};

export default function ClassStatusBadge({ status, gender = "f" }) {
  if (!status) return null;
  return (
    <span
      className={`${styles.badge} ${styles[styleKey[status]] ?? styles.upcoming}`}
    >
      {labelMap[gender]?.[status] ?? status}
    </span>
  );
}
