// sensitivityAnalysis.js
// For each percentage driver, perturbs by ±deltaPct and re-runs the forecast.
// Returns rows sorted by total swing (magnitude of forecast change), which
// is the standard tornado-chart layout: biggest sensitivity at the top.

import { forecast } from "./forecastEngine.js";

const SENSITIVITY_DRIVERS = [
  { key: "inflationPct",         label: "Inflation" },
  { key: "productivityPct",      label: "Productivity gain" },
  { key: "aopHeadcountDeltaPct", label: "AOP headcount" },
];

export function runSensitivity({ baseline, drivers, deltaPct = 1 }) {
  const base = forecast({ baseline, drivers });
  const baselineTotal = base.forecastedTotal;

  const rows = SENSITIVITY_DRIVERS.map((d) => {
    const baseValue = drivers[d.key] ?? 0;
    const lowValue  = baseValue - deltaPct;
    const highValue = baseValue + deltaPct;

    const lowForecast  = forecast({ baseline, drivers: { ...drivers, [d.key]: lowValue  } }).forecastedTotal;
    const highForecast = forecast({ baseline, drivers: { ...drivers, [d.key]: highValue } }).forecastedTotal;

    const lowDelta  = lowForecast  - baselineTotal;
    const highDelta = highForecast - baselineTotal;
    const swing = Math.abs(highForecast - lowForecast);

    return {
      key: d.key,
      label: d.label,
      baseValue,
      lowValue,
      highValue,
      lowForecast,
      highForecast,
      lowDelta,
      highDelta,
      swing,
    };
  });

  rows.sort((a, b) => b.swing - a.swing);

  return {
    baselineTotal,
    rows,
    deltaPct,
  };
}
