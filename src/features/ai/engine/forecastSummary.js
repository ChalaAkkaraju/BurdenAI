// forecastSummary.js
// The driver scenarios as the Forecast page shows them (same saved scenarios,
// same per-country overrides), plus the learned forecast — computed on demand
// for "Ask Burden AI" without touching the Forecast page's saved state.

import { forecastPerCountry } from "../../forecast/engine/forecastEngine.js";
import { DEFAULT_SCENARIOS } from "../../forecast/hooks/useScenarios.js";
import { learnedForecast } from "./holtWinters.js";
import { monthLabel } from "../../planVsActual/engine/fiscal.js";

function readJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function shift(period, months) {
  const [y, m] = String(period).split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Learned forecast fitted on monthly company burden cost up to `asOf`.
export function learnedFromPeriods(periodData, asOf, h = 12) {
  const hist = periodData.filter((p) => p.period <= asOf);
  const values = hist.map((p) => p.totalCostToCompany);
  const lf = learnedForecast(values, h);
  if (!lf) return null;
  const periods = Array.from({ length: h }, (_, i) => shift(asOf, i + 1));
  return { ...lf, periods, history: hist };
}

export function forecastSummary({ kpis, summaryByCountry, selectedPeriod, periodData }) {
  if (!kpis || !(kpis.totalCTC > 0)) return null;
  const countryBaselines = (summaryByCountry || []).filter((c) => c.totalCostToCompany > 0).map((c) => ({
    countryCode: c.key, label: c.label, totalBurden: c.totalCostToCompany, headcount: c.employeeCount, productiveHours: c.totalHours,
  }));
  const saved = readJson("burdenai_forecast_scenarios", null);
  const scenarios = Array.isArray(saved) && saved.length ? saved : DEFAULT_SCENARIOS;
  const manual = readJson("burdenai_forecast_manual_overrides", {});
  const out = scenarios.map((s) => {
    const merged = {};
    for (const code of new Set([...Object.keys(s.aopState?.overrides || {}), ...Object.keys(manual || {})])) {
      merged[code] = { ...(manual?.[code] || {}), ...(s.aopState?.overrides?.[code] || {}) };
    }
    const cf = forecastPerCountry({ countryBaselines, drivers: s.drivers, countryDriverOverrides: merged });
    return { id: s.id, name: s.name, total: cf.totals.forecastedTotal, rate: cf.totals.forecastedRate };
  });
  const lf = learnedFromPeriods(periodData, selectedPeriod);
  const target = shift(selectedPeriod, 12);
  return {
    baselineTotal: kpis.totalCTC,
    baselineLabel: monthLabel(selectedPeriod),
    targetLabel: monthLabel(target),
    scenarios: out,
    learned: lf ? { total: lf.path[11], low: lf.range[11].low, high: lf.range[11].high, months: lf.fittedOn } : null,
  };
}
