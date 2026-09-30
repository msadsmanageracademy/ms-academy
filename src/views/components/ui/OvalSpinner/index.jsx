import styles from "./styles.module.css";

export const OvalSpinner = ({ size = 80, label = "Cargando" }) => {
  return (
    <span
      aria-label={label}
      className={styles.spinner}
      role="status"
      style={{ height: size, width: size }}
    />
  );
};

export default OvalSpinner;
