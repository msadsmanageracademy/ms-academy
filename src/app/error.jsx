"use client";

import PageWrapper from "@/views/components/layout/PageWrapper";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import { useEffect } from "react";

export default function PageError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageWrapper>
      <h1>Algo salió mal</h1>
      <p>No pudimos cargar esta página. Probá de nuevo en unos segundos.</p>
      <PrimaryLink asButton dark text="Reintentar" onClick={reset} />
    </PageWrapper>
  );
}
