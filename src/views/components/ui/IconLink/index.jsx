import * as Icons from "@/views/components/icons";
import Link from "next/link";
import styles from "./styles.module.css";

const IconLink = ({
  asButton = false,
  className = "",
  danger = false,
  dark = false,
  disabled = false,
  fill,
  filled,
  google = false,
  icon,
  onClick,
  size = 20,
  spinning = false,
  success,
  text = "",
  title,
  warning = false,
  ...props
}) => {
  const classes = [styles.link, className];
  if (danger) classes.push(`${styles.danger}`);
  if (disabled) classes.push(`${styles.disabled}`);
  if (google) classes.push(`${styles.google}`);
  if (success) classes.push(`${styles.success}`);
  if (warning) classes.push(`${styles.warning}`);

  const IconComponent = icon ? Icons[icon] : null;
  const iconFill = fill === undefined ? (warning ? "var(--color-7)" : "#fff") : fill;
  const a11yProps = { title, ...(!text && title ? { "aria-label": title } : {}) };

  const content = (
    <>
      {IconComponent && (
        <span className={spinning ? styles.spinning : ""}>
          <IconComponent fill={iconFill} filled={filled} size={size} />
        </span>
      )}
      {text && <span className={styles.text}>{text}</span>}
    </>
  );

  if (asButton) {
    return (
      <button
        className={classes.join(" ")}
        disabled={disabled}
        type="button"
        onClick={() => {
          if (!disabled && onClick) onClick();
        }}
        {...a11yProps}
        {...props}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      className={classes.join(" ")}
      {...(disabled ? { "aria-disabled": true, tabIndex: -1 } : {})}
      {...a11yProps}
      {...props}
    >
      {content}
    </Link>
  );
};

export default IconLink;
