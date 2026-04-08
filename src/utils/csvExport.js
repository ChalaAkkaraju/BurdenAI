// Shared CSV export utility.
// Usage: exportCSV({ filename, columns, rows }) where columns is an array
// of either strings (used as both header and key) or { key, label, format }.

function escapeCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportCSV({ filename, columns, rows }) {
  const cols = columns.map((c) =>
    typeof c === 'string' ? { key: c, label: c } : c
  );
  const header = cols.map((c) => escapeCell(c.label)).join(',');
  const body = rows.map((row) =>
    cols
      .map((c) => {
        const raw = row[c.key];
        const val = c.format ? c.format(raw, row) : raw;
        return escapeCell(val);
      })
      .join(',')
  );
  const csv = [header, ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
