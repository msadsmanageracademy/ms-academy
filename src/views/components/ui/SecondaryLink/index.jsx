import Link from 'next/link';
import styles from './styles.module.css';

export default function SecondaryLink({
  asButton = false,
  className = '',
  disabled = false,
  href = '#',
  onClick = null,
  text = 'Learn more',
}) {
  const classes = [styles.link, className];
  if (disabled) classes.push(`${styles.disabled}`);
  return asButton ? (
    <button
      className={classes.join(' ')}
      disabled={disabled}
      type="button"
      onClick={() => {
        if (!disabled && onClick) onClick();
      }}
    >
      {text}
    </button>
  ) : (
    <Link href={href} className={classes.join(' ')} aria-disabled={disabled}>
      {text}
    </Link>
  );
}
