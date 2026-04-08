import { useState, useEffect, useMemo } from 'react';

// Shared pagination hook. Page is 0-indexed internally; UI can render +1.
export function usePagination(rows, pageSize = 25) {
  const [page, setPage] = useState(0);

  // Reset to first page whenever the row set changes (filters, search, etc.)
  useEffect(() => {
    setPage(0);
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  const paged = useMemo(
    () => rows.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [rows, safePage, pageSize]
  );

  return {
    paged,
    page: safePage,
    totalPages,
    pageSize,
    rangeStart: rows.length === 0 ? 0 : safePage * pageSize + 1,
    rangeEnd: Math.min((safePage + 1) * pageSize, rows.length),
    setPage,
    nextPage: () => setPage((p) => Math.min(totalPages - 1, p + 1)),
    prevPage: () => setPage((p) => Math.max(0, p - 1)),
    canPrev: safePage > 0,
    canNext: safePage < totalPages - 1,
  };
}
