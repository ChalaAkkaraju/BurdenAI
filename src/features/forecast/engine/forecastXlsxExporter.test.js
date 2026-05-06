import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  buildForecastWorkbook,
  buildForecastXlsxFilename,
} from "./forecastXlsxExporter.js";

const baseline = { totalBurden: 6_400_000, headcount: 456, productiveHours: 83_000 };

const sampleScenarios = [
  {
    id: "base", name: "Base",
    drivers: { inflationPct: 5, productivityPct: 3, aopHeadcountDeltaPct: 10, hiringRamp: 0.5, hedgeRatio: 0.5 },
    result: { forecastedTotal: 7_172_000, forecastedRate: 78.5, forecastedHeadcount: 502 },
  },
  {
    id: "high", name: "High inflation",
    drivers: { inflationPct: 8, productivityPct: 2, aopHeadcountDeltaPct: 5, hiringRamp: 0.85, hedgeRatio: 0.4 },
    result: { forecastedTotal: 7_350_000, forecastedRate: 81.0, forecastedHeadcount: 479 },
  },
];

const sampleCountryForecast = {
  byCountry: [
    {
      countryCode: "US", label: "USA",
      baseline: { totalBurden: 4_000_000, headcount: 200, productiveHours: 36_000, rate: 111.11 },
      forecastedTotal: 4_200_000, forecastedRate: 116.7, forecastedHeadcount: 220,
      contributionPct: 60.0,
      driversApplied: { inflationPct: 5, productivityPct: 3, aopHeadcountDeltaPct: 10, fxImpactPct: 0, hiringRamp: 0.5 },
    },
    {
      countryCode: "IN", label: "India",
      baseline: { totalBurden: 1_500_000, headcount: 180, productiveHours: 32_000, rate: 46.88 },
      forecastedTotal: 1_700_000, forecastedRate: 53.13, forecastedHeadcount: 198,
      contributionPct: 30.0,
      driversApplied: { inflationPct: 8, productivityPct: 3, aopHeadcountDeltaPct: 10, fxImpactPct: 0, hiringRamp: 0.5 },
    },
  ],
  totals: {
    baselineTotal: 5_500_000,
    forecastedTotal: 5_900_000,
    forecastedRate: 86.76,
    forecastedHeadcount: 418,
  },
};

// Helper: read all cell values from a sheet as an array-of-arrays.
function sheetToAoa(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
}

describe("buildForecastWorkbook", () => {
  it("creates Summary, Scenarios, and Country breakdown sheets", () => {
    const wb = buildForecastWorkbook({
      scenarios: sampleScenarios,
      activeScenario: sampleScenarios[0],
      countryForecast: sampleCountryForecast,
      baseline,
      baselineLabel: "March 2026 actual",
      forecastYear: 2027,
      horizonYears: 1,
    });
    expect(wb.SheetNames).toContain("Summary");
    expect(wb.SheetNames).toContain("Scenarios");
    expect(wb.SheetNames).toContain("Country breakdown");
  });

  it("Summary sheet contains baseline figures and active scenario name", () => {
    const wb = buildForecastWorkbook({
      scenarios: sampleScenarios,
      activeScenario: sampleScenarios[0],
      baseline,
      baselineLabel: "March 2026 actual",
      forecastYear: 2027,
      horizonYears: 1,
    });
    const aoa = sheetToAoa(wb.Sheets["Summary"]);
    const flat = aoa.flat().map(String);
    expect(flat).toContain("BurdenAI Forecast Export");
    expect(flat).toContain("March 2026 actual");
    expect(flat).toContain("Base");
    // Baseline total burden is stored as a number, not formatted text
    expect(aoa.some((row) => row.includes(6_400_000))).toBe(true);
    expect(aoa.some((row) => row.includes(456))).toBe(true);
  });

  it("renders multi-year horizon range when > 1", () => {
    const wb = buildForecastWorkbook({
      scenarios: sampleScenarios,
      activeScenario: sampleScenarios[0],
      baseline,
      forecastYear: 2027,
      horizonYears: 3,
    });
    const flat = sheetToAoa(wb.Sheets["Summary"]).flat().map(String);
    expect(flat).toContain("2027–2029");
  });

  it("Scenarios sheet has one row per scenario plus header", () => {
    const wb = buildForecastWorkbook({
      scenarios: sampleScenarios,
      activeScenario: sampleScenarios[0],
      baseline,
    });
    const aoa = sheetToAoa(wb.Sheets["Scenarios"]);
    // Header + 2 scenarios
    expect(aoa.length).toBe(3);
    expect(aoa[0]).toEqual([
      "Scenario", "Inflation %", "Productivity %", "AOP HC delta %",
      "Hiring ramp", "Hedge ratio",
      "Forecasted total", "Forecasted rate", "Forecasted headcount",
    ]);
    expect(aoa[1][0]).toBe("Base");
    expect(aoa[1][6]).toBe(7_172_000); // forecasted total as a number
    expect(aoa[2][0]).toBe("High inflation");
    expect(aoa[2][6]).toBe(7_350_000);
  });

  it("Country breakdown sheet has header + country rows + totals row", () => {
    const wb = buildForecastWorkbook({
      scenarios: sampleScenarios,
      activeScenario: sampleScenarios[0],
      countryForecast: sampleCountryForecast,
      baseline,
    });
    const aoa = sheetToAoa(wb.Sheets["Country breakdown"]);
    expect(aoa.length).toBe(4); // header + 2 countries + totals
    expect(aoa[1][0]).toBe("US");
    expect(aoa[1][1]).toBe("USA");
    expect(aoa[2][0]).toBe("IN");
    // Totals row
    expect(aoa[3][0]).toBe("TOTAL");
    expect(aoa[3][2]).toBe(5_500_000);
    expect(aoa[3][3]).toBe(5_900_000);
  });

  it("omits Country breakdown sheet when not provided", () => {
    const wb = buildForecastWorkbook({
      scenarios: sampleScenarios,
      activeScenario: sampleScenarios[0],
      baseline,
    });
    expect(wb.SheetNames).not.toContain("Country breakdown");
    expect(wb.SheetNames).toContain("Scenarios");
  });

  it("includes Manual overrides sheet when overrides are present", () => {
    const wb = buildForecastWorkbook({
      scenarios: sampleScenarios,
      activeScenario: sampleScenarios[0],
      baseline,
      manualOverrides: {
        US: { inflationPct: 7, hiringRamp: 0.8 },
        IN: { aopHeadcountDeltaPct: 15 },
      },
    });
    expect(wb.SheetNames).toContain("Manual overrides");
    const aoa = sheetToAoa(wb.Sheets["Manual overrides"]);
    expect(aoa.length).toBe(3); // header + 2 country rows
    expect(aoa[1][0]).toBe("US");
    expect(aoa[1][1]).toBe(7);
  });

  it("omits Manual overrides sheet when overrides are empty", () => {
    const wb = buildForecastWorkbook({
      scenarios: sampleScenarios,
      activeScenario: sampleScenarios[0],
      baseline,
      manualOverrides: {},
    });
    expect(wb.SheetNames).not.toContain("Manual overrides");
  });

  it("applies the right number format to each summary cell", () => {
    const wb = buildForecastWorkbook({
      scenarios: sampleScenarios,
      activeScenario: sampleScenarios[0],
      baseline,
    });
    const ws = wb.Sheets["Summary"];
    // Baseline strip
    expect(ws["B9"].z).toBe('"$"#,##0');         // total burden
    expect(ws["B10"].z).toBe("#,##0");            // headcount
    expect(ws["B11"].z).toBe("#,##0");            // productive hours
    expect(ws["B12"].z).toBe('"$"#,##0.00');     // burden rate
    // Drivers applied — guard against off-by-one drift
    expect(ws["B22"].z).toBe('0.00"%"');         // inflation
    expect(ws["B23"].z).toBe('0.00"%"');         // productivity
    expect(ws["B24"].z).toBe('0.00"%"');         // AOP HC delta
    expect(ws["B25"].z).toBe("0.00");            // hiring ramp (factor)
    expect(ws["B26"].z).toBe("0.00");            // hedge ratio (factor)
    // Forecast bridge — every step formatted as USD
    for (let r = 30; r <= 34; r++) {
      expect(ws[`B${r}`].z).toBe('"$"#,##0');
      expect(ws[`C${r}`].z).toBe('"$"#,##0');
    }
  });

  it("handles scenario names with commas/quotes safely", () => {
    const messy = [{
      id: "m", name: 'Bear, "stretch" case',
      drivers: { inflationPct: 1, productivityPct: 1, aopHeadcountDeltaPct: 1 },
      result: { forecastedTotal: 1, forecastedRate: 1, forecastedHeadcount: 1 },
    }];
    const wb = buildForecastWorkbook({
      scenarios: messy,
      activeScenario: messy[0],
      baseline,
    });
    const aoa = sheetToAoa(wb.Sheets["Scenarios"]);
    expect(aoa[1][0]).toBe('Bear, "stretch" case');
  });
});

describe("buildForecastXlsxFilename", () => {
  it("includes year, scenario name, date, and .xlsx extension", () => {
    const f = buildForecastXlsxFilename({ forecastYear: 2027, scenarioName: "Base" });
    expect(f).toMatch(/burdenai-forecast-2027-base-\d{4}-\d{2}-\d{2}\.xlsx/);
  });

  it("falls back gracefully with no inputs", () => {
    const f = buildForecastXlsxFilename({});
    expect(f).toMatch(/burdenai-forecast-all-\d{4}-\d{2}-\d{2}\.xlsx/);
  });

  it("normalizes special characters in scenario name", () => {
    const f = buildForecastXlsxFilename({ scenarioName: "High Inflation!" });
    expect(f).toContain("high-inflation");
  });
});
