import Link from "next/link";
import styles from "./styles.module.css";
import {
  Google,
  GoogleCalendar,
  GoogleMeet,
  Plus,
} from "@/views/components/icons";

export default function PrimaryLink({
  asButton = false,
  calendar = false,
  className = "",
  danger = false,
  disabled = false,
  google = false,
  href = "",
  meet = false,
  onClick = null,
  plus = false,
  target = "_self",
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
      {calendar ? <GoogleCalendar className={styles.iconLeft} /> : null}
      {google ? <Google className={styles.iconLeft} /> : null}
      {meet ? <GoogleMeet className={styles.iconLeft} /> : null}
      {text}
      {plus ? <Plus className={styles.iconRight} /> : null}
    </button>
  ) : (
    <Link
      aria-disabled={disabled}
      className={classes.join(" ")}
      href={href}
      target={target}
    >
      {calendar ? <GoogleCalendar className={styles.iconLeft} /> : null}
      {google ? <Google className={styles.iconLeft} /> : null}
      {meet ? <GoogleMeet className={styles.iconLeft} /> : null}
      {text} {plus ? <Plus className={styles.iconRight} /> : null}
    </Link>
  );
}
