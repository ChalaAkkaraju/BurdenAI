import { describe, it, expect } from "vitest";
import { forecast, forecastMultiYear, forecastPerCountry } from "./forecastEngine.js";

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

  it("hiring ramp defaults to 1.0 (full year impact) — preserves prior behavior", () => {
    const r = forecast({
      baseline: sampleBaseline,
      drivers: { inflationPct: 5, productivityPct: 3, aopHeadcountDeltaPct: 10 },
    });
    expect(r.hiringRamp).toBe(1.0);
    expect(r.forecastedTotal).toBeCloseTo(6_400_000 * 1.05 * 0.97 * 1.10);
  });

  it("ramp 0.5 halves the AOP cost contribution, year-end HC unchanged", () => {
    const r = forecast({
      baseline: sampleBaseline,
      drivers: { inflationPct: 0, productivityPct: 0, aopHeadcountDeltaPct: 10, hiringRamp: 0.5 },
    });
    // Cost grows by 5%, not 10%
    expect(r.forecastedTotal).toBeCloseTo(6_400_000 * 1.05);
    // Year-end HC still reflects the full 10% growth target
    expect(r.forecastedHeadcount).toBe(Math.round(456 * 1.10));
    // avgFTE reflects the cost-bearing mid-year average
    expect(r.avgFTE).toBeCloseTo(456 * 1.05);
  });

  it("ramp 0 means new hires contribute zero cost in year 1 (back-loaded)", () => {
    const r = forecast({
      baseline: sampleBaseline,
      drivers: { aopHeadcountDeltaPct: 50, hiringRamp: 0 },
    });
    expect(r.forecastedTotal).toBeCloseTo(6_400_000); // no cost growth
    expect(r.forecastedHeadcount).toBe(Math.round(456 * 1.50)); // but HC target still set
  });

  it("ramp clamps to [0, 1] for out-of-range values", () => {
    const high = forecast({
      baseline: sampleBaseline,
      drivers: { aopHeadcountDeltaPct: 10, hiringRamp: 1.5 },
    });
    const low = forecast({
      baseline: sampleBaseline,
      drivers: { aopHeadcountDeltaPct: 10, hiringRamp: -0.5 },
    });
    expect(high.hiringRamp).toBe(1.0);
    expect(low.hiringRamp).toBe(0.0);
  });

  it("hedge ratio defaults to 0 and FX has no effect when fxChange unset", () => {
    const r = forecast({
      baseline: sampleBaseline,
      drivers: { inflationPct: 5, productivityPct: 0, aopHeadcountDeltaPct: 0 },
    });
    expect(r.hedgeRatio).toBe(0);
    expect(r.fxImpact).toBe(0);
    expect(r.forecastedTotal).toBeCloseTo(6_400_000 * 1.05);
  });

  it("100% hedge eliminates FX impact regardless of fxChange", () => {
    const r = forecast({
      baseline: sampleBaseline,
      drivers: { fxChangePct: 10, hedgeRatio: 1.0 },
    });
    expect(r.fxImpact).toBeCloseTo(0);
    expect(r.forecastedTotal).toBeCloseTo(6_400_000);
  });

  it("0% hedge passes full FX impact through to USD cost", () => {
    const r = forecast({
      baseline: sampleBaseline,
      drivers: { fxChangePct: 5, hedgeRatio: 0 },
    });
    expect(r.fxImpact).toBeCloseTo(5);
    expect(r.forecastedTotal).toBeCloseTo(6_400_000 * 1.05);
  });

  it("partial hedge: 60% hedge ratio passes through 40% of FX change", () => {
    const r = forecast({
      baseline: sampleBaseline,
      drivers: { fxChangePct: 10, hedgeRatio: 0.6 },
    });
    expect(r.fxImpact).toBeCloseTo(4); // (1 - 0.6) × 10
    expect(r.forecastedTotal).toBeCloseTo(6_400_000 * 1.04);
  });

  it("FX layered correctly with other drivers (multiplicative)", () => {
    const r = forecast({
      baseline: sampleBaseline,
      drivers: {
        inflationPct: 5, productivityPct: 3, aopHeadcountDeltaPct: 10,
        hiringRamp: 1.0, fxChangePct: -5, hedgeRatio: 0.5,
      },
    });
    // expected: 6.4M × 1.05 × 0.97 × 1.10 × (1 + 0.5 × -0.05)
    //         = 6.4M × 1.05 × 0.97 × 1.10 × 0.975
    expect(r.forecastedTotal).toBeCloseTo(6_400_000 * 1.05 * 0.97 * 1.10 * 0.975);
  });

  it("waterfall includes FX step only when impact is non-zero", () => {
    const noFx = forecast({
      baseline: sampleBaseline,
      drivers: { inflationPct: 5, fxChangePct: 0 },
    });
    expect(noFx.waterfall.find((s) => s.label.includes("FX"))).toBeUndefined();

    const withFx = forecast({
      baseline: sampleBaseline,
      drivers: { inflationPct: 5, fxChangePct: 5, hedgeRatio: 0 },
    });
    expect(withFx.waterfall.find((s) => s.label.includes("FX"))).toBeDefined();
  });
});

describe("forecastMultiYear", () => {
  const drivers = { inflationPct: 5, productivityPct: 3, aopHeadcountDeltaPct: 10 };

  it("year 0 entry equals baseline", () => {
    const t = forecastMultiYear({ baseline: sampleBaseline, drivers, years: 3 });
    expect(t[0].yearOffset).toBe(0);
    expect(t[0].totalBurden).toBeCloseTo(6_400_000);
    expect(t[0].headcount).toBe(456);
    expect(t[0].isBaseline).toBe(true);
  });

  it("trajectory length is years + 1 (includes baseline)", () => {
    expect(forecastMultiYear({ baseline: sampleBaseline, drivers, years: 1 }).length).toBe(2);
    expect(forecastMultiYear({ baseline: sampleBaseline, drivers, years: 3 }).length).toBe(4);
    expect(forecastMultiYear({ baseline: sampleBaseline, drivers, years: 5 }).length).toBe(6);
  });

  it("year 1 of multi-year matches single-year forecast output", () => {
    const single = forecast({ baseline: sampleBaseline, drivers });
    const multi  = forecastMultiYear({ baseline: sampleBaseline, drivers, years: 1 });
    expect(multi[1].totalBurden).toBeCloseTo(single.forecastedTotal);
    expect(multi[1].headcount).toBe(single.forecastedHeadcount);
  });

  it("year N total compounds: baseline × [(1+i)(1-p)(1+a)]^N", () => {
    const factor = 1.05 * 0.97 * 1.10;
    const t = forecastMultiYear({ baseline: sampleBaseline, drivers, years: 3 });
    expect(t[1].totalBurden).toBeCloseTo(6_400_000 * factor);
    expect(t[2].totalBurden).toBeCloseTo(6_400_000 * factor * factor);
    expect(t[3].totalBurden).toBeCloseTo(6_400_000 * factor * factor * factor);
  });

  it("zero drivers means flat trajectory", () => {
    const t = forecastMultiYear({
      baseline: sampleBaseline,
      drivers: { inflationPct: 0, productivityPct: 0, aopHeadcountDeltaPct: 0 },
      years: 5,
    });
    for (const point of t) {
      expect(point.totalBurden).toBeCloseTo(6_400_000);
      expect(point.headcount).toBe(456);
    }
  });

  it("years defaults to 1 if zero or negative", () => {
    const t = forecastMultiYear({ baseline: sampleBaseline, drivers, years: 0 });
    expect(t.length).toBe(2);
  });
});

describe("forecastPerCountry", () => {
  const sampleCountries = [
    { countryCode: "US", label: "USA",   totalBurden: 4_000_000, headcount: 200, productiveHours: 36_000 },
    { countryCode: "IN", label: "India", totalBurden: 1_500_000, headcount: 180, productiveHours: 32_000 },
    { countryCode: "DE", label: "Germany", totalBurden: 900_000, headcount:  76, productiveHours: 15_000 },
  ];
  const drivers = { inflationPct: 5, productivityPct: 3, aopHeadcountDeltaPct: 10 };

  it("each country forecasts independently with the same drivers", () => {
    const r = forecastPerCountry({ countryBaselines: sampleCountries, drivers });
    expect(r.byCountry).toHaveLength(3);
    expect(r.byCountry[0].forecastedTotal).toBeCloseTo(4_000_000 * 1.05 * 0.97 * 1.10);
    expect(r.byCountry[1].forecastedTotal).toBeCloseTo(1_500_000 * 1.05 * 0.97 * 1.10);
    expect(r.byCountry[2].forecastedTotal).toBeCloseTo(  900_000 * 1.05 * 0.97 * 1.10);
  });

  it("totals.forecastedTotal equals sum of country forecasts", () => {
    const r = forecastPerCountry({ countryBaselines: sampleCountries, drivers });
    const sum = r.byCountry.reduce((acc, c) => acc + c.forecastedTotal, 0);
    expect(r.totals.forecastedTotal).toBeCloseTo(sum);
  });

  it("contribution percentages sum to ~100", () => {
    const r = forecastPerCountry({ countryBaselines: sampleCountries, drivers });
    const sumPct = r.byCountry.reduce((acc, c) => acc + c.contributionPct, 0);
    expect(sumPct).toBeCloseTo(100);
  });

  it("blended rate equals total burden divided by total hours", () => {
    const r = forecastPerCountry({ countryBaselines: sampleCountries, drivers });
    expect(r.totals.forecastedRate).toBeCloseTo(
      r.totals.forecastedTotal / r.totals.forecastedHours
    );
  });

  it("zero drivers leave per-country baselines unchanged", () => {
    const r = forecastPerCountry({
      countryBaselines: sampleCountries,
      drivers: { inflationPct: 0, productivityPct: 0, aopHeadcountDeltaPct: 0 },
    });
    expect(r.byCountry[0].forecastedTotal).toBeCloseTo(4_000_000);
    expect(r.byCountry[1].forecastedTotal).toBeCloseTo(1_500_000);
    expect(r.byCountry[2].forecastedTotal).toBeCloseTo(  900_000);
  });

  it("aggregate forecastPerCountry total equals single forecast on summed baseline", () => {
    // Cross-check: forecasting each country and summing should equal forecasting
    // the rolled-up baseline directly (because drivers are uniform).
    const aggregateBaseline = sampleCountries.reduce(
      (acc, c) => ({
        totalBurden:     acc.totalBurden + c.totalBurden,
        headcount:       acc.headcount + c.headcount,
        productiveHours: acc.productiveHours + c.productiveHours,
      }),
      { totalBurden: 0, headcount: 0, productiveHours: 0 }
    );
    const single = forecast({ baseline: aggregateBaseline, drivers });
    const perCountry = forecastPerCountry({ countryBaselines: sampleCountries, drivers });
    expect(perCountry.totals.forecastedTotal).toBeCloseTo(single.forecastedTotal);
  });

  it("country override replaces global driver only for that country", () => {
    // Override US AOP to 20%; everyone else uses the 10% global default.
    const r = forecastPerCountry({
      countryBaselines: sampleCountries,
      drivers,
      countryDriverOverrides: { US: { aopHeadcountDeltaPct: 20 } },
    });
    const us = r.byCountry.find((c) => c.countryCode === "US");
    const india = r.byCountry.find((c) => c.countryCode === "IN");
    expect(us.driversApplied.aopHeadcountDeltaPct).toBe(20);
    expect(us.driversApplied.isOverridden).toBe(true);
    expect(india.driversApplied.aopHeadcountDeltaPct).toBe(10);
    expect(india.driversApplied.isOverridden).toBe(false);
    expect(us.forecastedTotal).toBeCloseTo(4_000_000 * 1.05 * 0.97 * 1.20);
  });

  it("override can specify only a subset of drivers; others fall back", () => {
    const r = forecastPerCountry({
      countryBaselines: sampleCountries,
      drivers,
      countryDriverOverrides: { IN: { aopHeadcountDeltaPct: 15 } }, // only AOP overridden
    });
    const india = r.byCountry.find((c) => c.countryCode === "IN");
    expect(india.driversApplied.inflationPct).toBe(5);    // global
    expect(india.driversApplied.productivityPct).toBe(3); // global
    expect(india.driversApplied.aopHeadcountDeltaPct).toBe(15); // override
  });

  it("global hiring ramp dampens AOP cost contribution per country, year-end HC unchanged", () => {
    const r = forecastPerCountry({
      countryBaselines: sampleCountries,
      drivers: { ...drivers, hiringRamp: 0.5 },
    });
    // Each country's cost should reflect aopCost = 0.5 × 10% = 5%
    expect(r.byCountry[0].forecastedTotal).toBeCloseTo(4_000_000 * 1.05 * 0.97 * 1.05);
    expect(r.byCountry[0].forecastedHeadcount).toBe(Math.round(200 * 1.10)); // year-end unchanged
    expect(r.byCountry[0].avgFTE).toBeCloseTo(200 * 1.05);
  });
});

describe("forecastPerCountry — country-up bridge (waterfall aggregation)", () => {
  const sampleCountries = [
    { countryCode: "US", label: "USA", totalBurden: 4_000_000, headcount: 200, productiveHours: 36_000 },
    { countryCode: "IN", label: "India", totalBurden: 1_500_000, headcount: 180, productiveHours: 32_000 },
    { countryCode: "DE", label: "Germany", totalBurden:   900_000, headcount:  76, productiveHours: 15_000 },
  ];
  const drivers = { inflationPct: 5, productivityPct: 3, aopHeadcountDeltaPct: 10 };

  it("returns a waterfall array on the result", () => {
    const r = forecastPerCountry({ countryBaselines: sampleCountries, drivers });
    expect(Array.isArray(r.waterfall)).toBe(true);
    expect(r.waterfall.length).toBeGreaterThanOrEqual(5); // anchor + 3 steps + anchor
  });

  it("waterfall first/last anchors equal baseline total / forecast total", () => {
    const r = forecastPerCountry({ countryBaselines: sampleCountries, drivers });
    const start = r.waterfall.find((s) => s.kind === "anchor");
    const end = r.waterfall[r.waterfall.length - 1];
    expect(start.cumulative).toBeCloseTo(r.totals.baselineTotal);
    expect(end.cumulative).toBeCloseTo(r.totals.forecastedTotal);
  });

  it("waterfall delta steps sum exactly to (forecast − baseline)", () => {
    const r = forecastPerCountry({ countryBaselines: sampleCountries, drivers });
    const deltaSum = r.waterfall
      .filter((s) => s.kind === "delta")
      .reduce((acc, s) => acc + s.value, 0);
    expect(deltaSum).toBeCloseTo(r.totals.forecastedTotal - r.totals.baselineTotal);
  });

  it("FX step appears in waterfall when any country has FX impact", () => {
    const drs = { ...drivers, hedgeRatio: 0.5 };
    const overrides = { IN: { fxChangePct: 5 } };
    const r = forecastPerCountry({
      countryBaselines: sampleCountries,
      drivers: drs,
      countryDriverOverrides: overrides,
    });
    const fxStep = r.waterfall.find((s) => s.label.includes("FX"));
    expect(fxStep).toBeDefined();
    expect(fxStep.value).toBeGreaterThan(0);
  });

  it("FX step omitted when no country has any FX change", () => {
    const r = forecastPerCountry({
      countryBaselines: sampleCountries,
      drivers,
    });
    const fxStep = r.waterfall.find((s) => s.label.includes("FX"));
    expect(fxStep).toBeUndefined();
  });

  it("each delta step has a breakdown array with one entry per country that contributed", () => {
    const r = forecastPerCountry({ countryBaselines: sampleCountries, drivers });
    const inflationStep = r.waterfall.find((s) => s.label === "+ Inflation");
    expect(inflationStep.breakdown).toBeDefined();
    expect(inflationStep.breakdown).toHaveLength(3);
    // Sum of breakdown deltas equals the step's total delta
    const breakdownSum = inflationStep.breakdown.reduce((acc, b) => acc + b.delta, 0);
    expect(breakdownSum).toBeCloseTo(inflationStep.value);
  });

  it("waterfall reflects per-country overrides (India inflation 8% lifts the inflation step)", () => {
    const baseRun = forecastPerCountry({ countryBaselines: sampleCountries, drivers });
    const baseStep = baseRun.waterfall.find((s) => s.label === "+ Inflation");

    const ovRun = forecastPerCountry({
      countryBaselines: sampleCountries,
      drivers,
      countryDriverOverrides: { IN: { inflationPct: 8 } },
    });
    const ovStep = ovRun.waterfall.find((s) => s.label === "+ Inflation");

    // India override should add (8% − 5%) of India's $1.5M baseline = $45K to the inflation step
    expect(ovStep.value).toBeGreaterThan(baseStep.value);
    expect(ovStep.value - baseStep.value).toBeCloseTo(1_500_000 * 0.03, -2);
  });

  it("country-up total equals sum of byCountry forecastedTotal (reconciles)", () => {
    const r = forecastPerCountry({
      countryBaselines: sampleCountries,
      drivers: { ...drivers, hedgeRatio: 0.5 },
      countryDriverOverrides: { IN: { fxChangePct: 5 } },
    });
    const sum = r.byCountry.reduce((acc, c) => acc + c.forecastedTotal, 0);
    expect(r.totals.forecastedTotal).toBeCloseTo(sum);
    // And waterfall's last anchor matches
    const last = r.waterfall[r.waterfall.length - 1];
    expect(last.cumulative).toBeCloseTo(sum);
  });

  it("each country has stepDeltas (per-country contribution to each waterfall step)", () => {
    const r = forecastPerCountry({ countryBaselines: sampleCountries, drivers });
    for (const c of r.byCountry) {
      expect(c.stepDeltas).toBeDefined();
      expect(typeof c.stepDeltas.inflation).toBe("number");
      expect(typeof c.stepDeltas.productivity).toBe("number");
      expect(typeof c.stepDeltas.aop).toBe("number");
      expect(typeof c.stepDeltas.fx).toBe("number");
    }
  });
});
