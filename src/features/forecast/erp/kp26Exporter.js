// kp26Exporter.js
// Turns rows from kp26Mapper into a CSV file matching the SAP KP26 flexible
// upload column order, and triggers a browser download.
//
// CSV is comma-separated with a header row using the SAP-internal field names
// (KOKRS, VERSN, etc.). Most modern S/4HANA flexible-upload tools accept this;
// teams that need tab-delimited can re-save the file in Excel.

const COLUMNS = [
  "KOKRS",       // Controlling Area
  "VERSN",       // Plan Version
  "GJAHR",       // Fiscal Year
  "VON_PERIOD",  // Period From
  "BIS_PERIOD",  // Period To
  "KOSTL",       // Cost Center
  "LSTAR",       // Activity Type
  "PLNMG",       // Plan Quantity
  "MEINS",       // Unit
  "TKF",         // Plan Price Fixed
  "TKV",         // Plan Price Variable
  "WAERS",       // Currency
  "TKG",         // Price Indicator
];

function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToKp26Csv(rows) {
  const lines = [COLUMNS.join(",")];
  for (const r of rows || []) {
    lines.push(COLUMNS.map((c) => csvCell(r[c])).join(","));
  }
  return lines.join("\n");
}

export function buildKp26Filename({ planVersion, fiscalYear, scenarioName }) {
  const date = new Date().toISOString().slice(0, 10);
  const safeScenario = (scenarioName || "scenario").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const v = (planVersion || "v").toString().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const yr = fiscalYear ? `-${fiscalYear}` : "";
  return `burdenai-kp26${yr}-${v}-${safeScenario}-${date}.csv`;
}

// Triggers a browser download of the CSV. Side-effecting; thin wrapper over
// the pure rowsToKp26Csv builder so unit tests stay clean.
export function downloadKp26Csv(rows, filename) {
  const csv = rowsToKp26Csv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Strip the internal _meta field from rows before CSV export. Mapper emits
// _meta for UI use; SAP shouldn't see it.
export function stripMeta(rows) {
  return (rows || []).map(({ _meta, ...rest }) => rest);
}
