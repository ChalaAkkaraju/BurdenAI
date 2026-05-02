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

  const baseRate = totalBurden / productiveHours;

  // Sequential composition
  const afterInflation     = totalBurden * (1 + i);
  const afterProductivity  = afterInflation * (1 - p);
  const afterAop           = afterProductivity * (1 + a);

  const forecastedTotal     = afterAop;
  const forecastedRate      = baseRate * (1 + i) * (1 - p);
  const forecastedHeadcount = Math.round(headcount * (1 + a));
  const forecastedHours     = productiveHours * (1 + a);

  // Waterfall: anchors (Current, Forecast) carry full values; middle steps carry deltas.
  const waterfall = [
    { label: "Current",        value: totalBurden,                          cumulative: totalBurden,        kind: "anchor" },
    { label: "+ Inflation",    value: afterInflation - totalBurden,         cumulative: afterInflation,     kind: "delta"  },
    { label: "- Productivity", value: afterProductivity - afterInflation,   cumulative: afterProductivity,  kind: "delta"  },
    { label: "+ AOP volume",   value: afterAop - afterProductivity,         cumulative: afterAop,           kind: "delta"  },
    { label: "Forecast",       value: forecastedTotal,                      cumulative: forecastedTotal,    kind: "anchor" },
  ];

  return {
    forecastedTotal,
    forecastedRate,
    forecastedHeadcount,
    forecastedHours,
    waterfall,
  };
}
