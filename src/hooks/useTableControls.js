"use client";

import { useMemo, useState } from "react";

export const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** True when every term of `query` appears in `values` (accent/case-insensitive); empty query matches. */
export function matchesQuery(values, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalize(values.join(" "));
  return terms.every((term) => haystack.includes(term));
}

export function useTableControls(items, { fields, pageSize = 10 }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!normalize(query).trim()) return items;
    return items.filter((item) => matchesQuery(fields(item), query));
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
