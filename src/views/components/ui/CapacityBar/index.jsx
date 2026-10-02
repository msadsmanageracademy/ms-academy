import styles from "./styles.module.css";

const CapacityBar = ({ current, max }) => {
  if (!(max > 0)) return null;
  const percentage = Math.min((current / max) * 100, 100);
  return (
    <div
      className={styles.bar}
      role="progressbar"
      aria-label="Cupo ocupado"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={current}
    >
      <div className={styles.fill} style={{ width: `${percentage}%` }} />
    </div>
  );
};

export default CapacityBar;
