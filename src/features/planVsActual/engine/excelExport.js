// excelExport.js
// Multi-sheet Excel export for Plan vs Actual. All amounts in USD.
//   1. Summary       — selection, plan source, KPIs, bridge
//   2. Cost centers  — one row per cost center with every measure
//   3. Monthly       — utilization and cost by month, plan vs actual
//   4. Targets       — utilization target used for each cost center

import * as XLSX from "xlsx";

const USD = '"$"#,##0';
const RATE = '"$"#,##0.00';
const INT = "#,##0";
const PCT = "0.0%";
const ONE = "0.0";

function formatCols(ws, formats, startRow = 1) {
  if (!ws["!ref"]) return;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (const [c, fmt] of Object.entries(formats)) {
    for (let r = startRow; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: Number(c) })];
      if (cell && typeof cell.v === "number") cell.z = fmt;
    }
  }
}

export function buildPlanVsActualWorkbook({ meta, total, costCenters, monthly }) {
  const wb = XLSX.utils.book_new();

  const summary = [
    ["Burden AI — Plan vs Actual"],
    [],
    ["Fiscal year", meta.fiscalYearLabel],
    ["Period", meta.periodLabel],
    ["Plan version", meta.planLabel],
    ["Filters", meta.filterLabel],
    ["Exported", new Date().toISOString().slice(0, 16).replace("T", " ")],
    ["Currency", "USD"],
    [],
    ["Measure", "Plan", "Actual", "Variance"],
    ["FTE (average)", total.plan.fte, total.actual.fte, total.actual.fte - total.plan.fte],
    ["Available hours", total.plan.available, total.actual.available, total.actual.available - total.plan.available],
    ["Productive hours", total.plan.productive, total.actual.productive, total.actual.productive - total.plan.productive],
    ["Utilization", total.planUtil, total.actualUtil, total.actualUtil - total.planUtil],
    ["Utilization target", total.targetUtil, null, null],
    ["Burden rate ($/productive hr)", total.planRate, total.actualRate, total.actualRate - total.planRate],
    ["Burden cost", total.plan.cost, total.actual.cost, total.costVariance],
    [],
    ["Cost bridge", "Amount"],
    ["Plan cost", total.plan.cost],
    ["Volume effect", total.volume],
    ["Rate effect", total.rateEffect],
    ["Actual cost", total.actual.cost],
    [],
    ["Over / under absorption", total.absorption],
    ["Absorption as % of plan cost", total.absorptionPct],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  for (const r of [10, 11, 12]) for (const c of [1, 2, 3]) {
    const cell = ws1[XLSX.utils.encode_cell({ r, c })]; if (cell) cell.z = r === 10 ? ONE : INT;
  }
  for (const r of [13, 14]) for (const c of [1, 2, 3]) {
    const cell = ws1[XLSX.utils.encode_cell({ r, c })]; if (cell) cell.z = PCT;
  }
  for (const c of [1, 2, 3]) { const cell = ws1[XLSX.utils.encode_cell({ r: 15, c })]; if (cell) cell.z = RATE; }
  for (const c of [1, 2, 3]) { const cell = ws1[XLSX.utils.encode_cell({ r: 16, c })]; if (cell) cell.z = USD; }
  for (const r of [19, 20, 21, 22, 24]) { const cell = ws1[XLSX.utils.encode_cell({ r, c: 1 })]; if (cell) cell.z = USD; }
  { const cell = ws1[XLSX.utils.encode_cell({ r: 25, c: 1 })]; if (cell) cell.z = PCT; }
  ws1["!cols"] = [{ wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Summary");

  const ccHeader = ["Country", "Department", "Cost center", "Plan source", "FTE plan", "FTE actual",
    "Available hrs plan", "Available hrs actual", "Productive hrs plan", "Productive hrs actual",
    "Utilization plan", "Utilization actual", "Target", "Gap to target (pts)",
    "Plan rate", "Actual rate", "Plan cost", "Actual cost", "Volume effect", "Rate effect", "Absorption", "Needs review"];
  const ccRows = costCenters.map((c) => [c.countryName, c.departmentName, c.costCenterId, c.source,
    c.s.plan.fte, c.s.actual.fte, c.s.plan.available, c.s.actual.available, c.s.plan.productive, c.s.actual.productive,
    c.s.planUtil, c.s.actualUtil, c.s.targetUtil, Math.round(c.s.gapToTargetPts * 10) / 10,
    c.s.planRate, c.s.actualRate, c.s.plan.cost, c.s.actual.cost, c.s.volume, c.s.rateEffect, c.s.absorption,
    c.flag ? "Yes" : ""]);
  const ws2 = XLSX.utils.aoa_to_sheet([ccHeader, ...ccRows]);
  formatCols(ws2, { 4: ONE, 5: ONE, 6: INT, 7: INT, 8: INT, 9: INT, 10: PCT, 11: PCT, 12: PCT, 13: ONE,
    14: RATE, 15: RATE, 16: USD, 17: USD, 18: USD, 19: USD, 20: USD });
  ws2["!cols"] = ccHeader.map((h, i) => ({ wch: i < 4 ? 22 : 15 }));
  XLSX.utils.book_append_sheet(wb, ws2, "Cost centers");

  const mHeader = ["Month", "Utilization plan", "Utilization actual", "Target", "Plan cost", "Actual cost", "Absorption"];
  const mRows = monthly.map((m) => [m.label, m.s.planUtil, m.s.actualUtil, m.s.targetUtil, m.s.plan.cost, m.s.actual.cost, m.s.absorption]);
  const ws3 = XLSX.utils.aoa_to_sheet([mHeader, ...mRows]);
  formatCols(ws3, { 1: PCT, 2: PCT, 3: PCT, 4: USD, 5: USD, 6: USD });
  ws3["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Monthly");

  const tRows = costCenters.map((c) => [c.costCenterId, c.s.targetUtil, c.targetIsDefault ? "Company default" : "Set for cost center"]);
  const ws4 = XLSX.utils.aoa_to_sheet([["Cost center", "Target utilization", "Source"], ...tRows]);
  formatCols(ws4, { 1: PCT });
  ws4["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws4, "Targets");

  return wb;
}

export function downloadWorkbook(wb, filename) {
  XLSX.writeFile(wb, filename);
}
