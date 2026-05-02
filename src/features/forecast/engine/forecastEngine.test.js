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
});
