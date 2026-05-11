// forecastEngine.js
// Pure functions for projecting burden cost into the future.
// No React, no side effects — fully unit-testable.
//
// Inputs:
//   baseline: { totalBurden, headcount, productiveHours }
//   drivers:  { inflationPct, productivityPct, aopHeadcountDeltaPct }
//
// Math:
//   forecastedTotal = baseline.totalBurden × (1+i) × (1-p) × (1+a)
//   forecastedRate  = baseline.rate × (1+i) × (1-p)         // AOP scales total but not rate
//   forecastedHeadcount = baseline.headcount × (1+a)
//
// Drivers compose multiplicatively in this order: inflation -> productivity -> AOP volume.
// Each waterfall step shows the dollar delta that driver contributes.

export function forecast({ baseline, drivers }) {
  const { totalBurden, headcount, productiveHours } = baseline;

  const i = (drivers.inflationPct ?? 0) / 100;
  const p = (drivers.productivityPct ?? 0) / 100;
  const a = (drivers.aopHeadcountDeltaPct ?? 0) / 100;
  // Hiring ramp: 1.0 = full year impact (Jan hires), 0.5 = uniform across year,
  // 0.0 = back-loaded (Dec hires). Defaults to 1.0 to preserve prior behavior.
  const ramp = drivers.hiringRamp != null
    ? Math.max(0, Math.min(1, drivers.hiringRamp))
    : 1.0;
  // Cost-bearing AOP factor scaled by ramp; year-end HC uses full delta.
  const aCost = a * ramp;
  // FX hedging: hedgeRatio 0..1, fxChangePct positive = local currency strengthens
  // vs USD (cost up), negative = weakens (cost down). Hedged portion is locked,
  // unhedged portion flows through to USD-reported cost.
  const hedgeRatio = drivers.hedgeRatio != null
    ? Math.max(0, Math.min(1, drivers.hedgeRatio))
    : 0;
  const fxChange = (drivers.fxChangePct ?? 0) / 100;
  const fxImpact = (1 - hedgeRatio) * fxChange;

  const baseRate = totalBurden / productiveHours;

  // Sequential composition (cost path uses ramp-adjusted AOP, FX layered last)
  const afterInflation     = totalBurden * (1 + i);
  const afterProductivity  = afterInflation * (1 - p);
  const afterAop           = afterProductivity * (1 + aCost);
  const afterFx            = afterAop * (1 + fxImpact);

  const forecastedTotal     = afterFx;
  const forecastedRate      = baseRate * (1 + i) * (1 - p) * (1 + fxImpact);
  const forecastedHeadcount = Math.round(headcount * (1 + a));      // year-end target
  const avgFTE              = headcount * (1 + aCost);              // cost-bearing avg
  const forecastedHours     = productiveHours * (1 + aCost);

  // Waterfall: anchors (Current, Forecast) carry full values; middle steps carry deltas.
  // FX step is included only when it has a non-trivial impact (avoids clutter when fx=0).
  const waterfallSteps = [
    { label: "Current",        value: totalBurden,                          cumulative: totalBurden,        kind: "anchor" },
    { label: "+ Inflation",    value: afterInflation - totalBurden,         cumulative: afterInflation,     kind: "delta"  },
    { label: "- Productivity", value: afterProductivity - afterInflation,   cumulative: afterProductivity,  kind: "delta"  },
    { label: "+ AOP volume",   value: afterAop - afterProductivity,         cumulative: afterAop,           kind: "delta"  },
  ];
  if (Math.abs(fxImpact) > 1e-9) {
    waterfallSteps.push({
      label: fxImpact >= 0 ? "+ FX (unhedged)" : "- FX (unhedged)",
      value: afterFx - afterAop,
      cumulative: afterFx,
      kind: "delta",
    });
  }
  waterfallSteps.push({
    label: "Forecast", value: forecastedTotal, cumulative: forecastedTotal, kind: "anchor",
  });

  return {
    forecastedTotal,
    forecastedRate,
    forecastedHeadcount, // year-end target headcount
    avgFTE,              // cost-bearing average FTE for the year
    hiringRamp: ramp,
    hedgeRatio,
    fxImpact: fxImpact * 100, // for display (back to %)
    forecastedHours,
    waterfall: waterfallSteps,
  };
}

// forecastPerCountry: apply drivers to each country's baseline independently
// and return both the country-level breakdown and the rolled-up totals.
//
//   countryBaselines:        [{ countryCode, label?, totalBurden, headcount, productiveHours }]
//   drivers:                 { inflationPct, productivityPct, aopHeadcountDeltaPct }
//   countryDriverOverrides:  { US: { aopHeadcountDeltaPct: 12 }, ... }  (optional)
//
// Per-country overrides win over global drivers when present. Any subset of
// drivers can be overridden (e.g. AOP only). This is how AOP file upload
// passes its per-country planned-headcount deltas in.

export function forecastPerCountry({
  countryBaselines,
  drivers,
  countryDriverOverrides = {},
}) {
  const globalI = (drivers.inflationPct ?? 0) / 100;
  const globalP = (drivers.productivityPct ?? 0) / 100;
  const globalA = (drivers.aopHeadcountDeltaPct ?? 0) / 100;
  const globalRamp = drivers.hiringRamp != null
    ? Math.max(0, Math.min(1, drivers.hiringRamp))
    : 1.0;
  // Hedge ratio is global (single hedging policy). FX changes are per-country.
  const hedgeRatio = drivers.hedgeRatio != null
    ? Math.max(0, Math.min(1, drivers.hedgeRatio))
    : 0;
  const globalFxChange = (drivers.fxChangePct ?? 0) / 100;

  const byCountry = countryBaselines.map((cb) => {
    const ov = countryDriverOverrides[cb.countryCode] || {};
    const i = ov.inflationPct        != null ? ov.inflationPct        / 100 : globalI;
    const p = ov.productivityPct     != null ? ov.productivityPct     / 100 : globalP;
    const a = ov.aopHeadcountDeltaPct!= null ? ov.aopHeadcountDeltaPct/ 100 : globalA;
    const ramp = ov.hiringRamp != null
      ? Math.max(0, Math.min(1, ov.hiringRamp))
      : globalRamp;
    const fxChange = ov.fxChangePct != null ? ov.fxChangePct / 100 : globalFxChange;
    const fxImpact = (1 - hedgeRatio) * fxChange;
    const aCost = a * ramp;

    const baseRate = cb.productiveHours > 0 ? cb.totalBurden / cb.productiveHours : 0;

    // Sequential composition (matches forecast() exactly so country roll-up
    // adds back to the same global figure when there are no overrides).
    const afterInflation     = cb.totalBurden * (1 + i);
    const afterProductivity  = afterInflation * (1 - p);
    const afterAop           = afterProductivity * (1 + aCost);
    const afterFx            = afterAop * (1 + fxImpact);

    const forecastedTotal     = afterFx;
    const forecastedRate      = baseRate * (1 + i) * (1 - p) * (1 + fxImpact);
    const forecastedHeadcount = Math.round(cb.headcount * (1 + a));      // year-end
    const avgFTE              = cb.headcount * (1 + aCost);              // cost-bearing
    const forecastedHours     = cb.productiveHours * (1 + aCost);

    // Per-country contributions to each waterfall step. Aggregated below to
    // produce the bridge that reflects every country's drivers.
    const stepDeltas = {
      inflation:    afterInflation    - cb.totalBurden,
      productivity: afterProductivity - afterInflation,
      aop:          afterAop          - afterProductivity,
      fx:           afterFx           - afterAop,
    };

    return {
      countryCode: cb.countryCode,
      label: cb.label || cb.countryCode,
      baseline: {
        totalBurden: cb.totalBurden,
        headcount: cb.headcount,
        productiveHours: cb.productiveHours,
        rate: baseRate,
      },
      forecastedTotal,
      forecastedRate,
      forecastedHeadcount,
      avgFTE,
      forecastedHours,
      stepDeltas, // for bridge tooltips
      driversApplied: {
        inflationPct:         i * 100,
        productivityPct:      p * 100,
        aopHeadcountDeltaPct: a * 100,
        hiringRamp:           ramp,
        fxChangePct:          fxChange * 100,
        fxImpactPct:          fxImpact * 100,
        isOverridden: Object.keys(ov).length > 0,
      },
    };
  });

  const totals = byCountry.reduce(
    (acc, c) => ({
      forecastedTotal:     acc.forecastedTotal + c.forecastedTotal,
      forecastedHeadcount: acc.forecastedHeadcount + c.forecastedHeadcount,
      forecastedHours:     acc.forecastedHours + c.forecastedHours,
      baselineTotal:       acc.baselineTotal + c.baseline.totalBurden,
    }),
    { forecastedTotal: 0, forecastedHeadcount: 0, forecastedHours: 0, baselineTotal: 0 }
  );

  // Add contribution % (each country's share of the forecasted total)
  const enriched = byCountry.map((c) => ({
    ...c,
    contributionPct: totals.forecastedTotal > 0
      ? (c.forecastedTotal / totals.forecastedTotal) * 100
      : 0,
  }));

  // Blended rate from totals
  const blendedRate = totals.forecastedHours > 0
    ? totals.forecastedTotal / totals.forecastedHours
    : 0;

  // ===== Aggregated waterfall (the bridge the UI shows) =====
  // Sum each country's per-step delta. With per-country overrides, this
  // captures what each driver step contributes across the whole org.
  const stepTotals = enriched.reduce(
    (acc, c) => ({
      inflation:    acc.inflation    + c.stepDeltas.inflation,
      productivity: acc.productivity + c.stepDeltas.productivity,
      aop:          acc.aop          + c.stepDeltas.aop,
      fx:           acc.fx           + c.stepDeltas.fx,
    }),
    { inflation: 0, productivity: 0, aop: 0, fx: 0 }
  );

  const baselineTotal = totals.baselineTotal;
  const aggAfterInfl  = baselineTotal + stepTotals.inflation;
  const aggAfterProd  = aggAfterInfl  + stepTotals.productivity;
  const aggAfterAop   = aggAfterProd  + stepTotals.aop;
  const aggAfterFx    = aggAfterAop   + stepTotals.fx;

  // Per-country breakdown for each step (label + delta) — used by bridge
  // tooltips to show "Inflation: US +$167K, India +$44K, ...".
  const breakdownFor = (key) =>
    enriched
      .filter((c) => Math.abs(c.stepDeltas[key]) > 1e-3)
      .map((c) => ({ countryCode: c.countryCode, label: c.label, delta: c.stepDeltas[key] }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const waterfall = [
    { label: "Current",        value: baselineTotal,         cumulative: baselineTotal, kind: "anchor" },
    { label: "+ Inflation",    value: stepTotals.inflation,  cumulative: aggAfterInfl,  kind: "delta", breakdown: breakdownFor("inflation") },
    { label: "- Productivity", value: stepTotals.productivity, cumulative: aggAfterProd, kind: "delta", breakdown: breakdownFor("productivity") },
    { label: "+ AOP volume",   value: stepTotals.aop,        cumulative: aggAfterAop,   kind: "delta", breakdown: breakdownFor("aop") },
  ];
  if (Math.abs(stepTotals.fx) > 1e-3) {
    waterfall.push({
      label: stepTotals.fx >= 0 ? "+ FX (unhedged)" : "- FX (unhedged)",
      value: stepTotals.fx,
      cumulative: aggAfterFx,
      kind: "delta",
      breakdown: breakdownFor("fx"),
    });
  }
  waterfall.push({
    label: "Forecast", value: aggAfterFx, cumulative: aggAfterFx, kind: "anchor",
  });

  return {
    byCountry: enriched,
    totals: {
      forecastedTotal:     totals.forecastedTotal,
      forecastedRate:      blendedRate,
      forecastedHeadcount: totals.forecastedHeadcount,
      forecastedHours:     totals.forecastedHours,
      baselineTotal:       totals.baselineTotal,
    },
    waterfall,
  };
}

// forecastMultiYear: project the same drivers compounding across N years.
// Returns an array starting at year 0 (baseline) through year N (final forecast).
//
// Each year's "baseline" becomes the previous year's forecast, so:
//   year 1 total = baseline × (1+i)(1-p)(1+a)
//   year 2 total = year 1 × (1+i)(1-p)(1+a) = baseline × [(1+i)(1-p)(1+a)]^2
//   ...
//
// This is the standard compounding behavior finance teams expect. Per-year
// driver overrides are a future enhancement.

export function forecastMultiYear({ baseline, drivers, years }) {
  const horizon = Math.max(1, Math.floor(years || 1));
  const baseRate = baseline.totalBurden / baseline.productiveHours;

  const trajectory = [
    {
      yearOffset: 0,
      totalBurden: baseline.totalBurden,
      burdenRate: baseRate,
      headcount: baseline.headcount,
      productiveHours: baseline.productiveHours,
      isBaseline: true,
    },
  ];

  let running = baseline;
  for (let y = 1; y <= horizon; y++) {
    const r = forecast({ baseline: running, drivers });
    trajectory.push({
      yearOffset: y,
      totalBurden: r.forecastedTotal,
      burdenRate: r.forecastedRate,
      headcount: r.forecastedHeadcount,
      productiveHours: r.forecastedHours,
      isBaseline: false,
    });
    running = {
      totalBurden: r.forecastedTotal,
      headcount: r.forecastedHeadcount,
      productiveHours: r.forecastedHours,
    };
  }

  return trajectory;
}
