// csv.js
// Plan and utilization-target CSV files: parse (with validation) and build
// templates. Headers are matched case-insensitively, ignoring spaces/underscores.

import Papa from "papaparse";

export const PLAN_COLUMNS = [
  "Period", "Country", "CostCenter", "PlanHeadcount", "PlanFTE",
  "PlanAvailableHours", "PlanProductiveHours", "PlanBurdenCost",
];
export const TARGET_COLUMNS = ["CostCenter", "TargetUtilizationPct"];

const norm = (h) => String(h || "").toLowerCase().replace(/[\s_-]+/g, "");

function parseTable(text) {
  if (typeof text !== "string" || !text.trim()) return { header: [], data: [], error: "The file is empty." };
  const res = Papa.parse(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy" });
  return { header: (res.meta.fields || []).map(norm), fields: res.meta.fields || [], data: res.data };
}

function pick(row, fields, name) {
  const want = norm(name);
  const f = fields.find((x) => norm(x) === want);
  if (!f) return undefined;
  const v = row[f];
  return v == null ? undefined : String(v).trim();
}

function num(v) {
  if (v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[,$\s]/g, ""));
  return isFinite(n) ? n : NaN;
}

// Returns { rows: [{ period, costCenter, headcount, fte, available, productive, cost }], errors: [] }
export function parsePlanCsv(text) {
  const t = parseTable(text);
  if (t.error) return { rows: [], errors: [t.error] };
  const missing = ["Period", "CostCenter"].filter((c) => !t.header.includes(norm(c)));
  if (missing.length) return { rows: [], errors: [`Missing required column(s): ${missing.join(", ")}`] };
  const numericCols = ["PlanHeadcount", "PlanFTE", "PlanAvailableHours", "PlanProductiveHours", "PlanBurdenCost"];
  if (!numericCols.some((c) => t.header.includes(norm(c)))) {
    return { rows: [], errors: [`Add at least one plan column: ${numericCols.join(", ")}`] };
  }

  const rows = [];
  const errors = [];
  t.data.forEach((r, i) => {
    const line = i + 2;
    const period = (pick(r, t.fields, "Period") || "").toUpperCase();
    const costCenter = pick(r, t.fields, "CostCenter") || "";
    if (!period && !costCenter) return;
    if (!/^\d{4}-\d{2}$/.test(period) && !/^FY\d{4}$/.test(period)) {
      errors.push(`Row ${line}: Period "${period}" must be YYYY-MM (e.g. 2025-07) or FY2026`);
      return;
    }
    if (/^\d{4}-\d{2}$/.test(period)) {
      const m = Number(period.slice(5));
      if (m < 1 || m > 12) { errors.push(`Row ${line}: month in "${period}" is not 01–12`); return; }
    }
    if (!costCenter) { errors.push(`Row ${line}: CostCenter is blank`); return; }
    const vals = {
      headcount: num(pick(r, t.fields, "PlanHeadcount")),
      fte: num(pick(r, t.fields, "PlanFTE")),
      available: num(pick(r, t.fields, "PlanAvailableHours")),
      productive: num(pick(r, t.fields, "PlanProductiveHours")),
      cost: num(pick(r, t.fields, "PlanBurdenCost")),
    };
    const bad = Object.entries(vals).filter(([, v]) => Number.isNaN(v) || (v != null && v < 0));
    if (bad.length) { errors.push(`Row ${line}: ${bad.map(([k]) => k).join(", ")} must be a number ≥ 0`); return; }
    if (vals.available != null && vals.productive != null && vals.productive > vals.available) {
      errors.push(`Row ${line}: productive hours are more than available hours`);
      return;
    }
    rows.push({ period, costCenter, ...vals });
  });
  return { rows, errors };
}

// Returns { byCostCenter: { CC: pct }, errors: [] }
export function parseTargetsCsv(text) {
  const t = parseTable(text);
  if (t.error) return { byCostCenter: {}, errors: [t.error] };
  const missing = TARGET_COLUMNS.filter((c) => !t.header.includes(norm(c)));
  if (missing.length) return { byCostCenter: {}, errors: [`Missing required column(s): ${missing.join(", ")}`] };
  const byCostCenter = {};
  const errors = [];
  t.data.forEach((r, i) => {
    const cc = pick(r, t.fields, "CostCenter") || "";
    const raw = pick(r, t.fields, "TargetUtilizationPct");
    if (!cc && !raw) return;
    const pct = num(String(raw ?? "").replace("%", ""));
    if (!cc) { errors.push(`Row ${i + 2}: CostCenter is blank`); return; }
    if (pct == null || Number.isNaN(pct) || pct <= 0 || pct > 100) {
      errors.push(`Row ${i + 2}: TargetUtilizationPct must be between 1 and 100`);
      return;
    }
    byCostCenter[cc] = pct;
  });
  return { byCostCenter, errors };
}

const csvCell = (v) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";

// Template pre-filled with the current plan as one annual row per cost center.
export function buildPlanTemplateCsv(plan, fy) {
  const byCc = new Map();
  for (const p of plan.values()) {
    let t = byCc.get(p.costCenterId);
    if (!t) {
      t = { cc: p.costCenterId, country: p.countryCode, headcount: p.headcount, fte: p.fte, available: 0, productive: 0, cost: 0 };
      byCc.set(p.costCenterId, t);
    }
    t.available += p.available;
    t.productive += p.productive;
    t.cost += p.cost;
  }
  const rows = [...byCc.values()]
    .sort((a, b) => a.cc.localeCompare(b.cc))
    .map((t) => [`FY${fy}`, t.country, t.cc, Math.round(t.headcount), t.fte.toFixed(1),
      Math.round(t.available), Math.round(t.productive), Math.round(t.cost)]);
  return toCsv([PLAN_COLUMNS, ...rows]);
}

export function buildTargetsCsv(costCenterIds, resolvePct) {
  const rows = [...costCenterIds].sort().map((cc) => [cc, resolvePct(cc)]);
  return toCsv([TARGET_COLUMNS, ...rows]);
}

export function downloadText(text, filename) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
