"use client";

import styles from "./styles.module.css";
import { useRef, useState } from "react";

const STARS = [1, 2, 3, 4, 5];
const starsLabel = (n) => `${n} ${n === 1 ? "estrella" : "estrellas"}`;

const StarRating = ({ value = 0, onChange, readOnly = false, size = "md", labelledBy }) => {
  const [hovered, setHovered] = useState(0);
  const buttons = useRef([]);
  const display = hovered || value;

  const glyph = (star) => (display >= star ? "★" : "☆");
  const starClass = (star) => `${styles.star} ${display >= star ? styles.filled : styles.empty}`;

  if (readOnly) {
    return (
      <span
        aria-label={`${value} de 5 estrellas`}
        className={`${styles.stars} ${styles[size]} ${styles.readOnly}`}
        role="img"
      >
        {STARS.map((star) => (
          <span key={star} aria-hidden="true" className={starClass(star)}>
            {glyph(star)}
          </span>
        ))}
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
