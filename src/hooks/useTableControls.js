"use client";

import { useMemo, useState } from "react";

export const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function useTableControls(items, { fields, pageSize = 10 }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return items;
    return items.filter((item) => {
      const haystack = normalize(fields(item).join(" "));
      return terms.every((term) => haystack.includes(term));
    });
  }, [items, query, fields]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return {
    query,
    setQuery: (value) => {
      setQuery(value);
      setPage(1);
    },
    page: currentPage,
    setPage,
    totalPages,
    pageItems,
    filteredCount: filtered.length,
    totalCount: items.length,
  };
}
