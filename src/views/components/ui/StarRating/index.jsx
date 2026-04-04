"use client";

import { useState } from "react";
import styles from "./styles.module.css";

const StarRating = ({ value = 0, onChange, readOnly = false, size = "md" }) => {
  const [hovered, setHovered] = useState(0);

  const display = hovered || value;

  return (
    <div
      className={`${styles.stars} ${styles[size]} ${readOnly ? styles.readOnly : ""}`}
      onMouseLeave={readOnly ? undefined : () => setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`${styles.star} ${display >= star ? styles.filled : styles.empty}`}
          role={readOnly ? undefined : "button"}
          onClick={readOnly ? undefined : () => onChange?.(star)}
          onMouseEnter={readOnly ? undefined : () => setHovered(star)}
        >
          ★
        </span>
      ))}
    </div>
  );
};

export default StarRating;
