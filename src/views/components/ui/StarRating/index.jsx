"use client";

import styles from "./styles.module.css";
import { useRef, useState } from "react";

const STARS = [1, 2, 3, 4, 5];
const ratingFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const starsLabel = (n) => `${n} ${n === 1 ? "estrella" : "estrellas"}`;

const StarRating = ({ value = 0, onChange, readOnly = false, size = "md", labelledBy }) => {
  const [hovered, setHovered] = useState(0);
  const buttons = useRef([]);
  const display = hovered || value;

  const glyph = (star) => (display >= star ? "★" : "☆");
  const starClass = (star) => `${styles.star} ${display >= star ? styles.filled : styles.empty}`;

  if (readOnly) {
    const rating = Math.min(5, Math.max(0, Number(value) || 0));
    return (
      <span
        aria-label={`${ratingFormatter.format(rating)} de 5 estrellas`}
        className={`${styles.stars} ${styles[size]} ${styles.readOnly}`}
        role="img"
      >
        {STARS.map((star) => {
          const fill = Math.min(1, Math.max(0, rating - (star - 1)));
          return (
            <span key={star} aria-hidden="true" className={`${styles.star} ${styles.partial}`}>
              <span className={styles.empty}>★</span>
              {fill > 0 && (
                <span className={`${styles.fill} ${styles.filled}`} style={{ width: `${fill * 100}%` }}>
                  ★
                </span>
              )}
            </span>
          );
        })}
      </span>
    );
  }

  const select = (star) => {
    onChange?.(star);
    buttons.current[star - 1]?.focus();
  };

  const handleKeyDown = (event) => {
    const current = value || 1;
    const next = {
      ArrowRight: Math.min(5, current + 1),
      ArrowUp: Math.min(5, current + 1),
      ArrowLeft: Math.max(1, current - 1),
      ArrowDown: Math.max(1, current - 1),
      Home: 1,
      End: 5,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  };

  return (
    <div
      aria-label={labelledBy ? undefined : "Puntuación"}
      aria-labelledby={labelledBy}
      className={`${styles.stars} ${styles[size]}`}
      role="radiogroup"
    >
      {STARS.map((star) => (
        <button
          key={star}
          ref={(el) => (buttons.current[star - 1] = el)}
          aria-checked={value === star}
          aria-label={starsLabel(star)}
          className={`${styles.starButton} ${starClass(star)}`}
          onClick={() => select(star)}
          onKeyDown={handleKeyDown}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          role="radio"
          tabIndex={(value || 1) === star ? 0 : -1}
          type="button"
        >
          <span aria-hidden="true">{glyph(star)}</span>
        </button>
      ))}
    </div>
  );
};

export default StarRating;
