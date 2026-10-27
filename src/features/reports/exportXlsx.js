// exportXlsx.js — tiny helper to write a multi-sheet Excel file from arrays.
// sheets: [{ name, rows: [[header…], [row…], …], formats: { colIndex: excelFormat }, widths: [n…] }]

import * as XLSX from "xlsx";

export const FMT = {
  usd: '"$"#,##0',
  rate: '"$"#,##0.00',
  int: "#,##0",
  one: "0.0",
  pct: "0.0%",
};

export function exportSheets(filename, sheets) {
  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sh.rows);
    if (ws["!ref"] && sh.formats) {
      const range = XLSX.utils.decode_range(ws["!ref"]);
      const start = sh.headerRows ?? 1;
      for (const [c, fmt] of Object.entries(sh.formats)) {
        for (let r = start; r <= range.e.r; r++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c: Number(c) })];
          if (cell && typeof cell.v === "number") cell.z = fmt;
        }
      }
    }
    ws["!cols"] = (sh.widths || sh.rows[0]?.map(() => 16) || []).map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}

export const stamp = () => new Date().toISOString().slice(0, 10);
