import { describe, it, expect } from "vitest";
import { buildSnapshot } from "./useSnapshots.js";

const baseline = { totalBurden: 6_400_000, headcount: 456, productiveHours: 83_000 };
const scenarios = [
  {
    id: "base", name: "Base", description: "Steady-state",
    drivers: { inflationPct: 5, productivityPct: 3, aopHeadcountDeltaPct: 10, hiringRamp: 0.5, hedgeRatio: 0.5 },
    result: { forecastedTotal: 7_172_000, forecastedRate: 78.5, forecastedHeadcount: 502 },
  },
];

describe("buildSnapshot", () => {
  it("creates a snapshot with required metadata", () => {
    const s = buildSnapshot({
      name: "FY27 Approved",
      description: "Board-locked April 2026",
      baseline, baselineLabel: "March 2026 actual",
      forecastYear: 2027, horizonYears: 3,
      scenarios, activeScenarioId: "base",
      manualOverrides: {},
    });
    expect(s.name).toBe("FY27 Approved");
    expect(s.description).toBe("Board-locked April 2026");
    expect(s.id).toMatch(/^snap-\d+-/);
    expect(s.createdAt).toBeDefined();
    expect(s.forecastYear).toBe(2027);
    expect(s.horizonYears).toBe(3);
    expect(s.baselineLabel).toBe("March 2026 actual");
  });

  it("freezes baseline values into the snapshot", () => {
    const s = buildSnapshot({
      name: "x", baseline,
      forecastYear: 2027, horizonYears: 1,
      scenarios, activeScenarioId: "base",
      manualOverrides: {},
    });
    expect(s.baseline.totalBurden).toBe(6_400_000);
    expect(s.baseline.headcount).toBe(456);
    expect(s.baseline.productiveHours).toBe(83_000);
    // Mutating live baseline must not affect stored snapshot
    baseline.totalBurden = 9_999_999;
    expect(s.baseline.totalBurden).toBe(6_400_000);
    baseline.totalBurden = 6_400_000; // restore for other tests
  });

  it("preserves each scenario's drivers and forecasted totals", () => {
    const s = buildSnapshot({
      name: "x", baseline,
      forecastYear: 2027, horizonYears: 1,
      scenarios, activeScenarioId: "base",
      manualOverrides: {},
    });
    expect(s.scenarios).toHaveLength(1);
    expect(s.scenarios[0].drivers.inflationPct).toBe(5);
    expect(s.scenarios[0].forecastedTotal).toBe(7_172_000);
    expect(s.scenarios[0].forecastedRate).toBe(78.5);
  });

  it("captures manual overrides and AOP state when present", () => {
    const aopState = {
      fileName: "fy27-aop.csv",
      rows: [{ countryCode: "US", plannedHeadcount: 220 }],
      overrides: { US: { aopHeadcountDeltaPct: 10 } },
    };
    const manualOverrides = { IN: { inflationPct: 8 } };
    const s = buildSnapshot({
      name: "x", baseline,
      forecastYear: 2027, horizonYears: 1,
      scenarios, activeScenarioId: "base",
      manualOverrides, aopState,
    });
    expect(s.aopState.fileName).toBe("fy27-aop.csv");
    expect(s.aopState.overrides.US.aopHeadcountDeltaPct).toBe(10);
    expect(s.manualOverrides.IN.inflationPct).toBe(8);
  });

  it("handles missing AOP gracefully", () => {
    const s = buildSnapshot({
      name: "x", baseline,
      forecastYear: 2027, horizonYears: 1,
      scenarios, activeScenarioId: "base",
      manualOverrides: {},
    });
    expect(s.aopState).toBeNull();
  });

  it("trims whitespace on name and description", () => {
    const s = buildSnapshot({
      name: "   FY27 Approved   ",
      description: "  notes  ",
      baseline,
      forecastYear: 2027, horizonYears: 1,
      scenarios, activeScenarioId: "base",
      manualOverrides: {},
    });
    expect(s.name).toBe("FY27 Approved");
    expect(s.description).toBe("notes");
  });

  it("falls back to 'Untitled forecast' if name is missing", () => {
    const s = buildSnapshot({
      baseline,
      forecastYear: 2027, horizonYears: 1,
      scenarios, activeScenarioId: "base",
      manualOverrides: {},
    });
    expect(s.name).toBe("Untitled forecast");
  });
});
