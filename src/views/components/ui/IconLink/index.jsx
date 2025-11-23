import * as Icons from "@/views/components/icons";
import Link from "next/link";
import styles from "./styles.module.css";

const IconLink = ({
  asButton = false,
  className = "",
  danger = false,
  dark = false,
  disabled = false,
  fill = "#fff",
  google = false,
  icon,
  onClick,
  spinning = false,
  success,
  text = "",
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

  return asButton ? (
    <button
      className={classes.join(" ")}
      disabled={disabled}
      onClick={() => {
        if (!disabled && onClick) onClick();
      }}
      {...props}
    >
      {IconComponent && (
        <span className={spinning ? styles.spinning : ""}>
          <IconComponent fill={fill} />
        </span>
      )}
      {text && <span className={styles.text}>{text}</span>}
    </button>
  ) : (
    <Link className={classes.join(" ")} {...props}>
      {IconComponent && (
        <span className={spinning ? styles.spinning : ""}>
          <IconComponent fill={fill} />
        </span>
      )}
      {text && <span className={styles.text}>{text}</span>}
    </Link>
  );
};

export default IconLink;
