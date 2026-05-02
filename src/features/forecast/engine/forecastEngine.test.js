import { describe, it, expect } from "vitest";
import { forecast } from "./forecastEngine.js";

const sampleBaseline = {
  totalBurden: 6_400_000,
  headcount: 456,
  productiveHours: 83_000,
};

describe("forecast engine", () => {
  it("zero drivers returns baseline-equivalent forecast", () => {
    const r = forecast({
      baseline: sampleBaseline,
      drivers: { inflationPct: 0, productivityPct: 0, aopHeadcountDeltaPct: 0 },
    });
    expect(r.forecastedTotal).toBeCloseTo(6_400_000);
    expect(r.forecastedHeadcount).toBe(456);
    expect(r.forecastedRate).toBeCloseTo(6_400_000 / 83_000);
  });

  it("inflation only scales total by (1+i)", () => {
    const r = forecast({
      baseline: sampleBaseline,
      drivers: { inflationPct: 5, productivityPct: 0, aopHeadcountDeltaPct: 0 },
    });
    expect(r.forecastedTotal).toBeCloseTo(6_400_000 * 1.05);
    expect(r.forecastedRate).toBeCloseTo((6_400_000 / 83_000) * 1.05);
  });

  it("inflation + productivity compounds: x (1+i)(1-p)", () => {
    const r = forecast({
      baseline: sampleBaseline,
      drivers: { inflationPct: 5, productivityPct: 3, aopHeadcountDeltaPct: 0 },
    });
    expect(r.forecastedTotal).toBeCloseTo(6_400_000 * 1.05 * 0.97);
    expect(r.forecastedRate).toBeCloseTo((6_400_000 / 83_000) * 1.05 * 0.97);
  });

  it("AOP headcount growth scales total but does NOT change rate", () => {
    const r = forecast({
      baseline: sampleBaseline,
      drivers: { inflationPct: 0, productivityPct: 0, aopHeadcountDeltaPct: 10 },
    });
    expect(r.forecastedTotal).toBeCloseTo(6_400_000 * 1.10);
    expect(r.forecastedHeadcount).toBe(Math.round(456 * 1.10));
    expect(r.forecastedRate).toBeCloseTo(6_400_000 / 83_000);
  });

  it("waterfall delta steps sum to forecast total", () => {
    const r = forecast({
      baseline: sampleBaseline,
      drivers: { inflationPct: 5, productivityPct: 3, aopHeadcountDeltaPct: 10 },
    });
    // [Current, +Inflation, -Productivity, +AOP, Forecast]
    // Current value + sum of 3 delta steps should equal forecastedTotal.
    const current = r.waterfall[0].value;
    const deltas = r.waterfall.slice(1, 4).reduce((acc, s) => acc + s.value, 0);
    expect(current + deltas).toBeCloseTo(r.forecastedTotal);
  });

  it("missing driver fields default to zero", () => {
    const r = forecast({
      baseline: sampleBaseline,
      drivers: { inflationPct: 5 }, // productivity & aop omitted
    });
    expect(r.forecastedTotal).toBeCloseTo(6_400_000 * 1.05);
  });
});
