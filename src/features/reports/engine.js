// engine.js — calculations for the Utilization & Absorption and Forecast
// accuracy report tabs. Pure functions, no React.

import { forecast } from "../forecast/engine/forecastEngine.js";
import { learnedForecast } from "../ai/engine/holtWinters.js";
import { plannableFiscalYears, availableMonths } from "../planVsActual/engine/fiscal.js";
import { annualByCostCenter, derivePlan, applyUploads } from "../planVsActual/engine/plan.js";
import { buildLines, summarize, groupBy } from "../planVsActual/engine/variance.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shiftPeriod(period, months) {
  const [y, m] = String(period).split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function periodLabel(period) {
  const [y, m] = String(period).split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

// "Sep 2026 actual" → "2026-09"; null when the label has no month/year.
export function periodFromLabel(label) {
  const m = /([A-Z][a-z]{2})[a-z]*\s+(\d{4})/.exec(String(label || ""));
  if (!m) return null;
  const idx = MONTHS.indexOf(m[1]);
  return idx < 0 ? null : `${m[2]}-${String(idx + 1).padStart(2, "0")}`;
}

const pctErr = (forecastV, actualV) => (actualV ? (forecastV - actualV) / actualV : null);

function baselineFrom(p) {
  return { totalBurden: p.totalCostToCompany, headcount: p.employeeCount, productiveHours: p.totalHours };
}

// ---------------------------------------------------------------------------
// Backtest: for each of the last `years` anchors, run every scenario's drivers
// from the actuals 12 months before, and compare with what actually happened.
// Anchors are the latest month and the same month in earlier years.
// ---------------------------------------------------------------------------
export function backtest({ periodData, scenarios, asOfPeriod, years = 4 }) {
  const byPeriod = new Map(periodData.map((p) => [p.period, p]));
  const rows = [];
  for (let k = 0; k < years; k++) {
    const actualPeriod = shiftPeriod(asOfPeriod, -12 * k);
    const baselinePeriod = shiftPeriod(actualPeriod, -12);
    const a = byPeriod.get(actualPeriod);
    const b = byPeriod.get(baselinePeriod);
    if (!a || !b || !(b.totalHours > 0)) continue;
    const actualRate = a.totalHours > 0 ? a.totalCostToCompany / a.totalHours : 0;
    for (const s of scenarios) {
      const f = forecast({ baseline: baselineFrom(b), drivers: s.drivers });
      rows.push({
        baselinePeriod, actualPeriod, scenarioId: s.id, scenarioName: s.name,
        forecastCost: f.forecastedTotal, actualCost: a.totalCostToCompany, costErrPct: pctErr(f.forecastedTotal, a.totalCostToCompany),
        forecastRate: f.forecastedRate, actualRate, rateErrPct: pctErr(f.forecastedRate, actualRate),
        forecastHeadcount: f.forecastedHeadcount, actualHeadcount: a.employeeCount,
      });
    }
  }
  return rows;
}

// The learned trend model, scored the same way: fitted only on months up to
// each baseline month, forecasting 12 months ahead.
export const LEARNED_ID = "learned";
export const LEARNED_NAME = "Learned (trend model)";

export function learnedBacktest({ periodData, asOfPeriod, years = 4 }) {
  const byPeriod = new Map(periodData.map((p) => [p.period, p]));
  const rows = [];
  for (let k = 0; k < years; k++) {
    const actualPeriod = shiftPeriod(asOfPeriod, -12 * k);
    const baselinePeriod = shiftPeriod(actualPeriod, -12);
    const a = byPeriod.get(actualPeriod);
    if (!a || !byPeriod.has(baselinePeriod)) continue;
    const hist = periodData.filter((p) => p.period <= baselinePeriod);
    const cost = learnedForecast(hist.map((p) => p.totalCostToCompany), 12);
    if (!cost) continue;
    const rateF = learnedForecast(hist.map((p) => (p.totalHours > 0 ? p.totalCostToCompany / p.totalHours : 0)), 12);
    const actualRate = a.totalHours > 0 ? a.totalCostToCompany / a.totalHours : 0;
    const fc = cost.path[11];
    const fr = rateF ? rateF.path[11] : null;
    rows.push({
      baselinePeriod, actualPeriod, scenarioId: LEARNED_ID, scenarioName: LEARNED_NAME,
      forecastCost: fc, actualCost: a.totalCostToCompany, costErrPct: pctErr(fc, a.totalCostToCompany),
      forecastRate: fr, actualRate, rateErrPct: fr != null ? pctErr(fr, actualRate) : null,
      forecastHeadcount: null, actualHeadcount: a.employeeCount,
    });
  }
  return rows;
}

// Per-scenario scorecard: mean absolute % error and average bias.
export function scorecard(rows) {
  const by = new Map();
  for (const r of rows) {
    if (r.costErrPct == null) continue;
    if (!by.has(r.scenarioId)) by.set(r.scenarioId, { scenarioId: r.scenarioId, scenarioName: r.scenarioName, n: 0, absCost: 0, biasCost: 0, absRate: 0 });
    const s = by.get(r.scenarioId);
    s.n += 1;
    s.absCost += Math.abs(r.costErrPct);
    s.biasCost += r.costErrPct;
    s.absRate += Math.abs(r.rateErrPct ?? 0);
  }
  const out = [...by.values()].map((s) => ({
    scenarioId: s.scenarioId,
    scenarioName: s.scenarioName,
    tests: s.n,
    costMape: s.n ? s.absCost / s.n : null,
    costBias: s.n ? s.biasCost / s.n : null,
    rateMape: s.n ? s.absRate / s.n : null,
  }));
  out.sort((a, b) => a.costMape - b.costMape);
  return out;
}

// Saved Forecast snapshots scored against actuals for the month 12 months after
// their baseline. Not-yet-due snapshots are listed with their due month.
export function snapshotAccuracy({ snapshots, periodData }) {
  const byPeriod = new Map(periodData.map((p) => [p.period, p]));
  const rows = [];
  for (const snap of snapshots || []) {
    const baselinePeriod = periodFromLabel(snap.baselineLabel);
    const duePeriod = baselinePeriod ? shiftPeriod(baselinePeriod, 12) : null;
    const a = duePeriod ? byPeriod.get(duePeriod) : null;
    const actualRate = a && a.totalHours > 0 ? a.totalCostToCompany / a.totalHours : null;
    for (const sc of snap.scenarios || []) {
      if (!(sc.forecastedTotal > 0)) continue;
      rows.push({
        snapshotId: snap.id, snapshotName: snap.name, createdAt: snap.createdAt, createdBy: snap.createdBy,
        scenarioName: sc.name, isActive: sc.id === snap.activeScenarioId,
        baselinePeriod, duePeriod, status: !duePeriod ? "No baseline month" : a ? "Scored" : "Not yet due",
        forecastCost: sc.forecastedTotal, actualCost: a ? a.totalCostToCompany : null,
        costErrPct: a ? pctErr(sc.forecastedTotal, a.totalCostToCompany) : null,
        forecastRate: sc.forecastedRate ?? null, actualRate,
        rateErrPct: a && sc.forecastedRate ? pctErr(sc.forecastedRate, actualRate) : null,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Utilization & absorption history: every plannable fiscal year (oldest first),
// sample plan + that year's uploads, by country.
// ---------------------------------------------------------------------------
export function utilizationHistory({ actuals, periods, targets, uploads = {}, inScope = () => true }) {
  const actualsByKey = new Map(actuals.map((a) => [a.key, a]));
  const fys = plannableFiscalYears(periods).slice().sort((a, b) => a - b);
  return fys.map((fy) => {
    const months = availableMonths(fy, periods);
    let plan = derivePlan({ priorAnnual: annualByCostCenter(actuals, fy - 1), fy, source: "sample" });
    if (uploads[fy]) plan = applyUploads(plan, uploads[fy].rows, fy).plan;
    const lines = buildLines({ plan, actualsByKey, periods: months, targets, filter: (i) => inScope(i.countryCode) });
    const byCountry = new Map([...groupBy(lines, (l) => l.countryCode).entries()].map(([c, ls]) => [c, summarize(ls)]));
    return { fy, months, partial: months.length < 12, total: summarize(lines), byCountry, uploadName: uploads[fy]?.fileName || null };
  });
}
