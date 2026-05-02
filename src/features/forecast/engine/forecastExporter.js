// forecastExporter.js
// Pure function to build a CSV export of the current forecast state.
// Produces a single multi-section CSV that finance teams can open in Excel
// and paste straight into a board deck.

function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Escape quotes, wrap in quotes if value contains comma/quote/newline.
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells) {
  return cells.map(csvCell).join(",");
}

const fmtUSD = (n) => (n != null && Number.isFinite(n) ? Math.round(n).toString() : "");
const fmtRate = (n) => (n != null && Number.isFinite(n) ? n.toFixed(2) : "");
const fmtPct = (n) => (n != null && Number.isFinite(n) ? `${n.toFixed(2)}%` : "");

export function buildForecastCsv({
  scenarios,
  activeScenario,
  countryForecast,
  baseline,
  baselineLabel = "current period",
  forecastYear = null,
  horizonYears = 1,
}) {
  const lines = [];

  // ===== Header metadata =====
  lines.push(csvRow(["BurdenAI Forecast Export"]));
  lines.push(csvRow(["Generated", new Date().toISOString()]));
  if (forecastYear) {
    const range = horizonYears > 1 ? `${forecastYear}–${forecastYear + horizonYears - 1}` : String(forecastYear);
    lines.push(csvRow(["Forecast horizon", range]));
  }
  lines.push(csvRow(["Baseline period", baselineLabel]));
  lines.push(csvRow(["Baseline total burden", fmtUSD(baseline.totalBurden)]));
  lines.push(csvRow(["Baseline headcount", baseline.headcount]));
  lines.push(csvRow(["Baseline productive hours", baseline.productiveHours]));
  if (activeScenario) {
    lines.push(csvRow(["Active scenario", activeScenario.name]));
  }
  lines.push(""); // blank line separator

  // ===== Section 1: Scenario summary =====
  if (scenarios && scenarios.length > 0) {
    lines.push(csvRow(["SCENARIO SUMMARY"]));
    lines.push(csvRow([
      "Scenario", "Inflation %", "Productivity %", "AOP HC delta %",
      "Hiring ramp", "Hedge ratio",
      "Forecasted total burden", "Forecasted rate", "Forecasted headcount",
    ]));
    for (const s of scenarios) {
      lines.push(csvRow([
        s.name,
        s.drivers.inflationPct ?? 0,
        s.drivers.productivityPct ?? 0,
        s.drivers.aopHeadcountDeltaPct ?? 0,
        s.drivers.hiringRamp ?? 1,
        s.drivers.hedgeRatio ?? 0,
        fmtUSD(s.result?.forecastedTotal),
        fmtRate(s.result?.forecastedRate),
        s.result?.forecastedHeadcount ?? "",
      ]));
    }
    lines.push("");
  }

  // ===== Section 2: Per-country breakdown for active scenario =====
  if (countryForecast && countryForecast.byCountry && countryForecast.byCountry.length > 0) {
    lines.push(csvRow([`COUNTRY BREAKDOWN — ${activeScenario?.name || "active scenario"}`]));
    lines.push(csvRow([
      "Country code", "Country name",
      "Baseline burden", "Forecasted burden", "Δ vs baseline %",
      "Forecasted rate", "Forecasted headcount", "Contribution %",
      "Inflation applied %", "Productivity applied %", "AOP applied %", "FX impact %", "Hiring ramp",
    ]));
    for (const c of countryForecast.byCountry) {
      const baselineTotal = c.baseline.totalBurden;
      const deltaPct = baselineTotal > 0 ? ((c.forecastedTotal - baselineTotal) / baselineTotal) * 100 : 0;
      lines.push(csvRow([
        c.countryCode,
        c.label,
        fmtUSD(c.baseline.totalBurden),
        fmtUSD(c.forecastedTotal),
        deltaPct.toFixed(2),
        fmtRate(c.forecastedRate),
        c.forecastedHeadcount,
        c.contributionPct?.toFixed(2) ?? "",
        c.driversApplied?.inflationPct?.toFixed(2) ?? "",
        c.driversApplied?.productivityPct?.toFixed(2) ?? "",
        c.driversApplied?.aopHeadcountDeltaPct?.toFixed(2) ?? "",
        c.driversApplied?.fxImpactPct?.toFixed(2) ?? "",
        c.driversApplied?.hiringRamp?.toFixed(2) ?? "",
      ]));
    }
    // Totals row
    lines.push(csvRow([
      "TOTAL", "",
      fmtUSD(countryForecast.totals.baselineTotal),
      fmtUSD(countryForecast.totals.forecastedTotal),
      "",
      fmtRate(countryForecast.totals.forecastedRate),
      countryForecast.totals.forecastedHeadcount,
      "100.00",
      "", "", "", "", "",
    ]));
  }

  return lines.join("\n");
}

// Helper to compute a sensible filename for the download.
export function buildForecastFilename({ forecastYear, scenarioName }) {
  const date = new Date().toISOString().slice(0, 10);
  const safeName = (scenarioName || "all").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const yr = forecastYear ? `-${forecastYear}` : "";
  return `burdenai-forecast${yr}-${safeName}-${date}.csv`;
}
