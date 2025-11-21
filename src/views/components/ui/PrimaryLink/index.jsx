import Link from "next/link";
import styles from "./styles.module.css";
import { Arrow, Google, Plus } from "@/views/components/icons";

export default function PrimaryLink({
  arrow = false,
  asButton = false,
  className = "",
  danger = false,
  disabled = false,
  google = false,
  href = "",
  onClick = null,
  plus = false,
  text = "Inscribirse",
  type = "button",
}) {
  const classes = [styles.link, className];
  if (danger) classes.push(`${styles.danger}`);
  if (disabled) classes.push(`${styles.disabled}`);
  return asButton ? (
    <button
      className={classes.join(" ")}
      disabled={disabled}
      type={type}
      onClick={() => {
        if (!disabled && onClick) onClick();
      }}
    >
      {google ? <Google className={styles.iconLeft} /> : null} {text}{" "}
      {plus ? <Plus className={styles.iconRight} /> : null}{" "}
      {arrow ? <Arrow className={styles.iconRight} /> : null}
    </button>
  ) : (
    <Link aria-disabled={disabled} className={classes.join(" ")} href={href}>
      {plus ? <Plus className={styles.iconLeft} /> : null}
      {google ? <Google className={styles.iconLeft} /> : null} {text}{" "}
      {arrow ? <Arrow className={styles.iconRight} /> : null}
    </Link>
  );
}
