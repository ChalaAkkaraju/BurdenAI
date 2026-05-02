// useScenarios.js
// Manages an array of named forecast scenarios with persistence to localStorage.
// Each scenario carries its own drivers; the active scenario is the one being
// edited / shown in detail.

import { useEffect, useMemo, useState } from "react";
import { forecast, forecastMultiYear } from "../engine/forecastEngine.js";

const STORAGE_KEY = "burdenai_forecast_scenarios";

export const DEFAULT_SCENARIOS = [
  {
    id: "base",
    name: "Base",
    description: "Steady-state assumptions",
    drivers: { inflationPct: 5, productivityPct: 3, aopHeadcountDeltaPct: 10 },
  },
  {
    id: "high",
    name: "High inflation",
    description: "Wage and benefits surge, slower productivity",
    drivers: { inflationPct: 8, productivityPct: 2, aopHeadcountDeltaPct: 5 },
  },
  {
    id: "low",
    name: "Conservative",
    description: "Cooler economy, hiring slowdown",
    drivers: { inflationPct: 3, productivityPct: 5, aopHeadcountDeltaPct: -5 },
  },
];

function loadScenarios() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Fall through to defaults
  }
  return DEFAULT_SCENARIOS;
}

export function useScenarios(baseline, horizonYears = 1) {
  const [scenarios, setScenarios] = useState(loadScenarios);
  const [activeId, setActiveId] = useState(scenarios[0]?.id || "base");

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
    } catch {
      // Ignore quota errors
    }
  }, [scenarios]);

  // Compute forecast result + multi-year trajectory for every scenario.
  // `result` is the year-1 forecast (for the waterfall + KPIs of the active
  // scenario); `trajectory` is the [year 0 .. year N] series for charts.
  const scenarioResults = useMemo(
    () =>
      scenarios.map((s) => ({
        ...s,
        result: forecast({ baseline, drivers: s.drivers }),
        trajectory: forecastMultiYear({ baseline, drivers: s.drivers, years: horizonYears }),
      })),
    [scenarios, baseline, horizonYears]
  );

  const active =
    scenarioResults.find((s) => s.id === activeId) || scenarioResults[0];

  const updateDriver = (id, key, value) => {
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, drivers: { ...s.drivers, [key]: value } } : s
      )
    );
  };

  const resetScenario = (id) => {
    const def = DEFAULT_SCENARIOS.find((d) => d.id === id);
    if (!def) return;
    setScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, drivers: def.drivers } : s))
    );
  };

  const resetAllScenarios = () => {
    setScenarios(DEFAULT_SCENARIOS);
    setActiveId("base");
  };

  return {
    scenarios: scenarioResults,
    activeId,
    setActiveId,
    active,
    updateDriver,
    resetScenario,
    resetAllScenarios,
  };
}
