// forecastXlsxExporter.js
// Builds a SheetJS workbook from the current forecast state. Produces a
// multi-tab Excel file finance teams can open, filter, and paste into
// board decks without losing structure.
//
// Sheets:
//   1. Summary           — header metadata, baseline strip, active KPIs,
//                          drivers applied, forecast bridge
//   2. Scenarios         — full scenario comparison with drivers + outputs
//   3. Country breakdown — per-country baseline vs forecast (active scenario)
//   4. Manual overrides  — per-country override values (only when set)

import * as XLSX from "xlsx";

// ===== Number format constants (Excel format strings) =====
const FMT_USD       = '"$"#,##0';
const FMT_RATE      = '"$"#,##0.00';
const FMT_INT       = "#,##0";
const FMT_PCT       = '0.00"%"';
const FMT_PCT_SIGN  = '+0.00"%";-0.00"%";0.00"%"';
const FMT_FACTOR    = "0.00";

function setCellFormat(ws, ref, fmt) {
  const cell = ws[ref];
  if (cell && (cell.t === "n" || typeof cell.v === "number")) {
    cell.z = fmt;
  }
}

function applyColumnFormats(ws, columnFormats) {
  // columnFormats is an object keyed by 0-based column index containing
  // { fmt, startRow } where startRow is the first data row (0-based).
  if (!ws["!ref"]) return;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (const [colIdxStr, { fmt, startRow = 0 }] of Object.entries(columnFormats)) {
    const colIdx = Number(colIdxStr);
    for (let r = startRow; r <= range.e.r; r++) {
      const ref = XLSX.utils.encode_cell({ r, c: colIdx });
      setCellFormat(ws, ref, fmt);
    }
  }
}

function setColumnWidths(ws, widths) {
  ws["!cols"] = widths.map((wch) => ({ wch }));
}

// ===== Sheet builders =====

function buildSummarySheet({
  baseline, baselineLabel, forecastYear, horizonYears,
  activeScenario, generatedAt,
}) {
  const horizonRange = horizonYears > 1
    ? `${forecastYear}–${forecastYear + horizonYears - 1}`
    : forecastYear ? String(forecastYear) : "";

  const baselineRate = baseline.productiveHours > 0
    ? baseline.totalBurden / baseline.productiveHours
    : 0;

  const result = activeScenario?.result || {};
  const deltaPct = baseline.totalBurden > 0 && result.forecastedTotal != null
    ? ((result.forecastedTotal - baseline.totalBurden) / baseline.totalBurden) * 100
    : 0;
  const ratePct = baselineRate > 0 && result.forecastedRate != null
    ? ((result.forecastedRate - baselineRate) / baselineRate) * 100
    : 0;
  const hcPct = baseline.headcount > 0 && result.forecastedHeadcount != null
    ? ((result.forecastedHeadcount - baseline.headcount) / baseline.headcount) * 100
    : 0;

  // Forecast bridge (approximation reusing engine math: split deltas).
  // Each step is computed as the marginal effect when applied independently.
  const drivers = activeScenario?.drivers || {};
  const inflationDelta   = baseline.totalBurden * ((drivers.inflationPct ?? 0) / 100);
  const productivityDelta = -baseline.totalBurden * ((drivers.productivityPct ?? 0) / 100);
  const aopDelta         = baseline.totalBurden * ((drivers.aopHeadcountDeltaPct ?? 0) / 100);

  const aoa = [
    ["BurdenAI Forecast Export"],
    ["Generated", generatedAt],
    ["Forecast horizon", horizonRange || "—"],
    ["Baseline period", baselineLabel || "—"],
    ["Active scenario", activeScenario?.name || "—"],
    [],
    ["BASELINE"],
    ["Metric", "Value"],
    ["Total burden",       baseline.totalBurden],
    ["Headcount",          baseline.headcount],
    ["Productive hours",   Math.round(baseline.productiveHours)],
    ["Burden rate ($/hr)", baselineRate],
    [],
    ["ACTIVE FORECAST"],
    ["Metric", "Value", "Δ vs baseline"],
    ["Forecasted total burden",  result.forecastedTotal ?? 0,        deltaPct],
    ["Forecasted rate ($/hr)",   result.forecastedRate ?? 0,         ratePct],
    ["Forecasted headcount",     result.forecastedHeadcount ?? 0,    hcPct],
    [],
    ["DRIVERS APPLIED"],
    ["Driver", "Value"],
    ["Inflation",          drivers.inflationPct ?? 0],
    ["Productivity",       drivers.productivityPct ?? 0],
    ["AOP HC delta",       drivers.aopHeadcountDeltaPct ?? 0],
    ["Hiring ramp",        drivers.hiringRamp ?? 1],
    ["Hedge ratio",        drivers.hedgeRatio ?? 0],
    [],
    ["FORECAST BRIDGE"],
    ["Step", "Δ amount", "Running total"],
    ["Current baseline",   0,                  baseline.totalBurden],
    ["+ Inflation",        inflationDelta,     baseline.totalBurden + inflationDelta],
    ["− Productivity",     productivityDelta,  baseline.totalBurden + inflationDelta + productivityDelta],
    ["+ AOP volume",       aopDelta,           baseline.totalBurden + inflationDelta + productivityDelta + aopDelta],
    ["Forecast",           result.forecastedTotal ?? 0, result.forecastedTotal ?? 0],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  setColumnWidths(ws, [28, 22, 18]);

  // Format numeric cells. aoa_to_sheet uses 0-based row indexing matching
  // the array index, so:
  //   row 8  = Total burden          (col 1: USD)
  //   row 9  = Headcount             (col 1: integer)
  //   row 10 = Productive hours      (col 1: integer)
  //   row 11 = Burden rate           (col 1: rate)
  setCellFormat(ws, "B9",  FMT_USD);
  setCellFormat(ws, "B10", FMT_INT);
  setCellFormat(ws, "B11", FMT_INT);
  setCellFormat(ws, "B12", FMT_RATE);

  // Active forecast (rows 15-17, cols B value + C delta%):
  setCellFormat(ws, "B16", FMT_USD);   setCellFormat(ws, "C16", FMT_PCT_SIGN);
  setCellFormat(ws, "B17", FMT_RATE);  setCellFormat(ws, "C17", FMT_PCT_SIGN);
  setCellFormat(ws, "B18", FMT_INT);   setCellFormat(ws, "C18", FMT_PCT_SIGN);

  // Drivers applied (rows 22-26 — Inflation, Productivity, AOP HC delta,
  // Hiring ramp, Hedge ratio):
  setCellFormat(ws, "B22", FMT_PCT);
  setCellFormat(ws, "B23", FMT_PCT);
  setCellFormat(ws, "B24", FMT_PCT);
  setCellFormat(ws, "B25", FMT_FACTOR);
  setCellFormat(ws, "B26", FMT_FACTOR);

  // Forecast bridge (rows 30-34 — Current baseline through Forecast):
  for (let r = 30; r <= 34; r++) {
    setCellFormat(ws, `B${r}`, FMT_USD);
    setCellFormat(ws, `C${r}`, FMT_USD);
  }

  return ws;
}

function buildScenariosSheet(scenarios) {
  if (!scenarios || scenarios.length === 0) return null;
  const header = [
    "Scenario", "Inflation %", "Productivity %", "AOP HC delta %",
    "Hiring ramp", "Hedge ratio",
    "Forecasted total", "Forecasted rate", "Forecasted headcount",
  ];
  const rows = scenarios.map((s) => [
    s.name,
    s.drivers?.inflationPct ?? 0,
    s.drivers?.productivityPct ?? 0,
    s.drivers?.aopHeadcountDeltaPct ?? 0,
    s.drivers?.hiringRamp ?? 1,
    s.drivers?.hedgeRatio ?? 0,
    s.result?.forecastedTotal ?? 0,
    s.result?.forecastedRate ?? 0,
    s.result?.forecastedHeadcount ?? 0,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  setColumnWidths(ws, [22, 14, 16, 16, 14, 14, 18, 16, 18]);
  applyColumnFormats(ws, {
    1: { fmt: FMT_PCT,    startRow: 1 },
    2: { fmt: FMT_PCT,    startRow: 1 },
    3: { fmt: FMT_PCT,    startRow: 1 },
    4: { fmt: FMT_FACTOR, startRow: 1 },
    5: { fmt: FMT_FACTOR, startRow: 1 },
    6: { fmt: FMT_USD,    startRow: 1 },
    7: { fmt: FMT_RATE,   startRow: 1 },
    8: { fmt: FMT_INT,    startRow: 1 },
  });
  return ws;
}

function buildCountrySheet(countryForecast, activeScenarioName) {
  if (!countryForecast?.byCountry?.length) return null;

  const header = [
    "Country code", "Country name",
    "Baseline burden", "Forecasted burden", "Δ vs baseline %",
    "Forecasted rate", "Forecasted headcount", "Contribution %",
    "Inflation applied %", "Productivity applied %", "AOP applied %",
    "FX impact %", "Hiring ramp",
  ];

  const rows = countryForecast.byCountry.map((c) => {
    const baselineTotal = c.baseline?.totalBurden ?? 0;
    const deltaPct = baselineTotal > 0
      ? ((c.forecastedTotal - baselineTotal) / baselineTotal) * 100
      : 0;
    return [
      c.countryCode || "",
      c.label || "",
      baselineTotal,
      c.forecastedTotal ?? 0,
      deltaPct,
      c.forecastedRate ?? 0,
      c.forecastedHeadcount ?? 0,
      c.contributionPct ?? 0,
      c.driversApplied?.inflationPct ?? 0,
      c.driversApplied?.productivityPct ?? 0,
      c.driversApplied?.aopHeadcountDeltaPct ?? 0,
      c.driversApplied?.fxImpactPct ?? 0,
      c.driversApplied?.hiringRamp ?? 1,
    ];
  });

  // Totals row
  const totals = countryForecast.totals;
  const totalDelta = totals.baselineTotal > 0
    ? ((totals.forecastedTotal - totals.baselineTotal) / totals.baselineTotal) * 100
    : 0;
  const totalRow = [
    "TOTAL", activeScenarioName ? `(${activeScenarioName})` : "",
    totals.baselineTotal,
    totals.forecastedTotal,
    totalDelta,
    totals.forecastedRate,
    totals.forecastedHeadcount,
    100,
    "", "", "", "", "",
  ];

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows, totalRow]);
  setColumnWidths(ws, [14, 18, 18, 18, 16, 16, 18, 16, 18, 20, 16, 14, 14]);
  applyColumnFormats(ws, {
    2:  { fmt: FMT_USD,       startRow: 1 },
    3:  { fmt: FMT_USD,       startRow: 1 },
    4:  { fmt: FMT_PCT_SIGN,  startRow: 1 },
    5:  { fmt: FMT_RATE,      startRow: 1 },
    6:  { fmt: FMT_INT,       startRow: 1 },
    7:  { fmt: FMT_PCT,       startRow: 1 },
    8:  { fmt: FMT_PCT,       startRow: 1 },
    9:  { fmt: FMT_PCT,       startRow: 1 },
    10: { fmt: FMT_PCT,       startRow: 1 },
    11: { fmt: FMT_PCT,       startRow: 1 },
    12: { fmt: FMT_FACTOR,    startRow: 1 },
  });

  return ws;
}

function buildOverridesSheet(manualOverrides) {
  if (!manualOverrides || Object.keys(manualOverrides).length === 0) return null;

  const header = ["Country code", "Inflation %", "Productivity %", "AOP HC delta %", "FX change %", "Hiring ramp"];
  const rows = Object.entries(manualOverrides)
    .map(([code, ov]) => [
      code,
      ov?.inflationPct ?? "",
      ov?.productivityPct ?? "",
      ov?.aopHeadcountDeltaPct ?? "",
      ov?.fxChangePct ?? "",
      ov?.hiringRamp ?? "",
    ])
    .filter((row) => row.slice(1).some((v) => v !== "" && v !== null && v !== undefined));

  if (rows.length === 0) return null;

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  setColumnWidths(ws, [16, 14, 16, 18, 14, 14]);
  applyColumnFormats(ws, {
    1: { fmt: FMT_PCT,    startRow: 1 },
    2: { fmt: FMT_PCT,    startRow: 1 },
    3: { fmt: FMT_PCT,    startRow: 1 },
    4: { fmt: FMT_PCT,    startRow: 1 },
    5: { fmt: FMT_FACTOR, startRow: 1 },
  });
  return ws;
}

// ===== Public API =====

export function buildForecastWorkbook({
  scenarios,
  activeScenario,
  countryForecast,
  baseline,
  baselineLabel = "current period",
  forecastYear = null,
  horizonYears = 1,
  manualOverrides = null,
  generatedAt = new Date().toISOString(),
}) {
  const wb = XLSX.utils.book_new();

  const summary = buildSummarySheet({
    baseline, baselineLabel, forecastYear, horizonYears,
    activeScenario, generatedAt,
  });
  XLSX.utils.book_append_sheet(wb, summary, "Summary");

  const scenariosWs = buildScenariosSheet(scenarios);
  if (scenariosWs) XLSX.utils.book_append_sheet(wb, scenariosWs, "Scenarios");

  const countryWs = buildCountrySheet(countryForecast, activeScenario?.name);
  if (countryWs) XLSX.utils.book_append_sheet(wb, countryWs, "Country breakdown");

  const overridesWs = buildOverridesSheet(manualOverrides);
  if (overridesWs) XLSX.utils.book_append_sheet(wb, overridesWs, "Manual overrides");

  return wb;
}

// Helper to compute a sensible filename for the download.
export function buildForecastXlsxFilename({ forecastYear, scenarioName }) {
  const date = new Date().toISOString().slice(0, 10);
  const safeName = (scenarioName || "all").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const yr = forecastYear ? `-${forecastYear}` : "";
  return `burdenai-forecast${yr}-${safeName}-${date}.xlsx`;
}

// Triggers a browser download. Side-effecting wrapper kept thin so the
// pure builder above remains testable in isolation.
export function downloadForecastXlsx(data, filename) {
  const wb = buildForecastWorkbook(data);
  const fname = filename || buildForecastXlsxFilename({
    forecastYear: data.forecastYear,
    scenarioName: data.activeScenario?.name,
  });
  XLSX.writeFile(wb, fname);
}
