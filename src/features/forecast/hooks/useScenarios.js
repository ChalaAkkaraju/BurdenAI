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
    description: "Steady-state, uniform hires, 50% FX hedged",
    drivers: { inflationPct: 5, productivityPct: 3, aopHeadcountDeltaPct: 10, hiringRamp: 0.5, hedgeRatio: 0.5 },
    aopState: null,
  },
  {
    id: "high",
    name: "High inflation",
    description: "Wage surge, front-loaded hiring, partial hedge",
    drivers: { inflationPct: 8, productivityPct: 2, aopHeadcountDeltaPct: 5, hiringRamp: 0.85, hedgeRatio: 0.4 },
    aopState: null,
  },
  {
    id: "low",
    name: "Conservative",
    description: "Cooler economy, back-loaded hiring, fully hedged",
    drivers: { inflationPct: 3, productivityPct: 5, aopHeadcountDeltaPct: -5, hiringRamp: 0.25, hedgeRatio: 1.0 },
    aopState: null,
  },
];

function loadScenarios() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Migrate older saved scenarios that lack newer driver fields by
        // inheriting from the matching default scenario. Also ensure aopState
        // is present (defaults to null = no AOP attached).
        return parsed.map((s) => {
          const def = DEFAULT_SCENARIOS.find((d) => d.id === s.id);
          return {
            ...s,
            aopState: s.aopState ?? null,
            drivers: {
              ...s.drivers,
              hiringRamp: s.drivers?.hiringRamp ?? def?.drivers.hiringRamp ?? 1.0,
              hedgeRatio: s.drivers?.hedgeRatio ?? def?.drivers.hedgeRatio ?? 0,
            },
          };
        });
      }
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

  // Attach (or clear) an AOP file to a specific scenario.
  // aopState: { fileName, rows, overrides } or null to clear.
  const setScenarioAop = (id, aopState) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, aopState } : s))
    );
  };

  const resetScenario = (id) => {
    const def = DEFAULT_SCENARIOS.find((d) => d.id === id);
    if (!def) return;
    setScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, drivers: def.drivers, aopState: null } : s))
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
    setScenarioAop,
    resetScenario,
    resetAllScenarios,
  };
}
