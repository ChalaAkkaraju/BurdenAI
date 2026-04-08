import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePagination } from '../hooks/usePagination';

// Reusable paginated data table.
// columns: [{ key, label, format?, align? }]
export default function DataTable({ rows, columns, pageSize = 25, emptyMessage = 'No matching rows' }) {
  const { paged, page, totalPages, rangeStart, rangeEnd, prevPage, nextPage, canPrev, canNext } =
    usePagination(rows, pageSize);

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <div className="text-xs text-gray-500">{rows.length.toLocaleString()} rows</div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-2.5 font-semibold text-gray-700 whitespace-nowrap ${
                    c.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-2 text-gray-700 whitespace-nowrap ${
                      c.align === 'right' ? 'text-right' : ''
                    }`}
                  >
                    {c.format ? c.format(row[c.key], row) : (row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
        <span>
          {rangeStart}–{rangeEnd} of {rows.length.toLocaleString()}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={prevPage}
            disabled={!canPrev}
            className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={nextPage}
            disabled={!canNext}
            className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
