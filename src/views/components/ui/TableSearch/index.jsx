"use client";

import styles from "./styles.module.css";
import { useId } from "react";

const TableSearch = ({
  label,
  value,
  onChange,
  filteredCount,
  totalCount,
  placeholder = "Buscar...",
  className = "",
}) => {
  const id = useId();
  return (
    <div className={`${styles.search} ${className}`}>
      <label className="visually-hidden" htmlFor={id}>
        {label}
      </label>
      <input
        className={styles.input}
        id={id}
        placeholder={placeholder}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span aria-live="polite" className={styles.count}>
        {value ? `${filteredCount} de ${totalCount}` : ""}
      </span>
    </div>
  );
};

export default TableSearch;
