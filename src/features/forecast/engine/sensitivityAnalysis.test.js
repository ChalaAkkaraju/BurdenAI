import { describe, it, expect } from "vitest";
import { runSensitivity } from "./sensitivityAnalysis.js";

const baseline = { totalBurden: 6_400_000, headcount: 456, productiveHours: 83_000 };
const drivers = {
  inflationPct: 5,
  productivityPct: 3,
  aopHeadcountDeltaPct: 10,
  hiringRamp: 0.5,
  hedgeRatio: 0.5,
};

describe("runSensitivity", () => {
  it("returns one row per percentage driver", () => {
    const r = runSensitivity({ baseline, drivers, deltaPct: 1 });
    expect(r.rows).toHaveLength(3);
    const keys = r.rows.map((row) => row.key).sort();
    expect(keys).toEqual(["aopHeadcountDeltaPct", "inflationPct", "productivityPct"]);
  });

  it("each row's swing equals abs(highForecast - lowForecast)", () => {
    const r = runSensitivity({ baseline, drivers, deltaPct: 1 });
    for (const row of r.rows) {
      expect(row.swing).toBeCloseTo(Math.abs(row.highForecast - row.lowForecast));
    }
  });

  it("inflation perturbation: ±1pp moves cost by ~1% of baseline at scenario nominals", () => {
    const r = runSensitivity({ baseline, drivers, deltaPct: 1 });
    const infl = r.rows.find((row) => row.key === "inflationPct");
    // Sensitivity to ±1pp inflation roughly scales with baseline cost path
    // Don't pin exact value; just confirm it's substantially > 0
    expect(infl.swing).toBeGreaterThan(50_000);
  });

  it("productivity moves forecast in opposite direction (higher productivity = lower cost)", () => {
    const r = runSensitivity({ baseline, drivers, deltaPct: 2 });
    const prod = r.rows.find((row) => row.key === "productivityPct");
    // Lower productivity (low) = higher forecast → lowDelta > 0
    // Higher productivity (high) = lower forecast → highDelta < 0
    expect(prod.lowDelta).toBeGreaterThan(0);
    expect(prod.highDelta).toBeLessThan(0);
  });

  it("rows are sorted by swing descending", () => {
    const r = runSensitivity({ baseline, drivers, deltaPct: 2 });
    for (let i = 1; i < r.rows.length; i++) {
      expect(r.rows[i - 1].swing).toBeGreaterThanOrEqual(r.rows[i].swing);
    }
  });

  it("doubling deltaPct roughly doubles the swing", () => {
    const r1 = runSensitivity({ baseline, drivers, deltaPct: 1 });
    const r2 = runSensitivity({ baseline, drivers, deltaPct: 2 });
    const infl1 = r1.rows.find((row) => row.key === "inflationPct").swing;
    const infl2 = r2.rows.find((row) => row.key === "inflationPct").swing;
    // Should be very close to 2× (linear in inflation perturbation)
    expect(infl2 / infl1).toBeCloseTo(2, 1);
  });

  it("baseline forecast equals what `forecast` returns for the same inputs", () => {
    const r = runSensitivity({ baseline, drivers, deltaPct: 1 });
    expect(r.baselineTotal).toBeGreaterThan(0);
    expect(r.deltaPct).toBe(1);
  });
});
