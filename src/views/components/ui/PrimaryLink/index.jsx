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
  dark = false,
  disabled = false,
  google = false,
  href = "",
  meet = false,
  onClick = null,
  plus = false,
  target = "_self",
  text = "Inscribirse",
  type = "button",
  ...props
}) {
  const classes = [styles.link, className];
  if (danger) classes.push(`${styles.danger}`);
  if (dark) classes.push(`${styles.dark}`);
  if (disabled) classes.push(`${styles.disabled}`);
  return asButton ? (
    <button
      className={classes.join(" ")}
      disabled={disabled}
      type={type}
      {...props}
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
      {...(disabled ? { tabIndex: -1 } : {})}
      {...props}
    >
      {calendar ? <GoogleCalendar className={styles.iconLeft} /> : null}
      {google ? <Google className={styles.iconLeft} /> : null}
      {meet ? <GoogleMeet className={styles.iconLeft} /> : null}
      {text} {plus ? <Plus className={styles.iconRight} /> : null}
    </Link>
  );
}
