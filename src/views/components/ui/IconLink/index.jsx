import * as Icons from "@/views/components/icons";
import Link from "next/link";
import styles from "./styles.module.css";

const IconLink = ({
  asButton = false,
  className = "",
  color = "var(--color-7)",
  danger = false,
  dark = false,
  disabled = false,
  google = false,
  hoverColor,
  icon,
  onClick,
  text = "",
  warning = false,
  ...props
}) => {
  const classes = [styles.link, className];
  if (danger) classes.push(`${styles.danger}`);
  if (disabled) classes.push(`${styles.disabled}`);
  if (google) classes.push(`${styles.google}`);
  if (warning) classes.push(`${styles.warning}`);

  const IconComponent = icon ? Icons[icon] : null;

  return asButton ? (
    <button
      className={classes.join(" ")}
      disabled={disabled}
      onClick={() => {
        if (!disabled && onClick) onClick();
      }}
      {...props}
    >
      {IconComponent && <IconComponent />}
      {text && <span className={styles.text}>{text}</span>}
    </button>
  ) : (
    <Link className={classes.join(" ")} {...props}>
      {IconComponent && <IconComponent />}
      {text && <span className={styles.text}>{text}</span>}
    </Link>
  );
};

export default IconLink;
