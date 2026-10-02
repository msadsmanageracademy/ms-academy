"use client";

import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./classes/styles.module.css";
import { useEffect } from "react";

// Errors inside the dashboard: the sidebar stays and the user can retry
export default function DashboardError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={styles.container}>
      <h1>Algo salió mal</h1>
      <p>No pudimos cargar esta sección. Probá de nuevo en unos segundos.</p>
      <PrimaryLink asButton dark text="Reintentar" onClick={reset} />
    </div>
  );
}
