import { describe, it, expect } from "vitest";
import { buildForecastCsv, buildForecastFilename } from "./forecastExporter.js";

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

describe("buildForecastCsv", () => {
  it("includes header metadata and baseline values", () => {
    const csv = buildForecastCsv({
      scenarios: sampleScenarios,
      activeScenario: sampleScenarios[0],
      baseline,
      baselineLabel: "March 2026 actual",
      forecastYear: 2027,
      horizonYears: 1,
    });
    expect(csv).toContain("BurdenAI Forecast Export");
    expect(csv).toContain("March 2026 actual");
    expect(csv).toContain("6400000");
    expect(csv).toContain("456");
    expect(csv).toContain("Active scenario,Base");
    expect(csv).toContain("2027");
  });

  it("renders multi-year horizon range when > 1", () => {
    const csv = buildForecastCsv({
      scenarios: sampleScenarios, activeScenario: sampleScenarios[0],
      baseline, forecastYear: 2027, horizonYears: 3,
    });
    expect(csv).toContain("2027–2029");
  });

  it("includes a row per scenario with drivers and forecast outputs", () => {
    const csv = buildForecastCsv({
      scenarios: sampleScenarios, activeScenario: sampleScenarios[0], baseline,
    });
    expect(csv).toContain("SCENARIO SUMMARY");
    expect(csv).toContain("Base,5,3,10,0.5,0.5,7172000");
    expect(csv).toContain("High inflation,8,2,5,0.85,0.4,7350000");
  });

  it("includes country breakdown when provided", () => {
    const csv = buildForecastCsv({
      scenarios: sampleScenarios, activeScenario: sampleScenarios[0],
      countryForecast: sampleCountryForecast, baseline,
    });
    expect(csv).toContain("COUNTRY BREAKDOWN");
    expect(csv).toContain("US,USA");
    expect(csv).toContain("IN,India");
    expect(csv).toContain("TOTAL");
  });

  it("escapes commas/quotes in scenario names", () => {
    const messy = [{
      id: "m", name: 'Bear, "stretch" case',
      drivers: { inflationPct: 1, productivityPct: 1, aopHeadcountDeltaPct: 1 },
      result: { forecastedTotal: 1, forecastedRate: 1, forecastedHeadcount: 1 },
    }];
    const csv = buildForecastCsv({ scenarios: messy, activeScenario: messy[0], baseline });
    expect(csv).toContain('"Bear, ""stretch"" case"');
  });

  it("works without country forecast", () => {
    const csv = buildForecastCsv({
      scenarios: sampleScenarios, activeScenario: sampleScenarios[0], baseline,
    });
    expect(csv).not.toContain("COUNTRY BREAKDOWN");
    expect(csv).toContain("SCENARIO SUMMARY");
  });
});

describe("buildForecastFilename", () => {
  it("includes year, scenario name, and date", () => {
    const f = buildForecastFilename({ forecastYear: 2027, scenarioName: "Base" });
    expect(f).toMatch(/burdenai-forecast-2027-base-\d{4}-\d{2}-\d{2}\.csv/);
  });

  it("falls back gracefully with no inputs", () => {
    const f = buildForecastFilename({});
    expect(f).toMatch(/burdenai-forecast-all-\d{4}-\d{2}-\d{2}\.csv/);
  });

  it("normalizes special characters in scenario name", () => {
    const f = buildForecastFilename({ scenarioName: "High Inflation!" });
    expect(f).toContain("high-inflation");
  });
});
