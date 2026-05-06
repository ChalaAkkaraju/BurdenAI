// useSnapshots.js
// Manages frozen forecast snapshots, persisted to localStorage. Each snapshot
// captures the full forecast state (baseline + scenarios + AOP + overrides)
// at the moment it was saved. Snapshots are immutable — once created, they
// preserve their frozen numbers even if underlying baseline data changes.

import { useEffect, useState } from "react";

const STORAGE_KEY = "burdenai_forecast_snapshots";

function loadSnapshots() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fall through
  }
  return [];
}

// Pure function — testable. Builds a snapshot record from current state.
// Strips computed results from scenarios to keep snapshot minimal; results
// are recomputed when needed (or already present in scenarios.result).
export function buildSnapshot({
  name,
  description = "",
  baseline,
  baselineLabel,
  forecastYear,
  horizonYears,
  scenarios,
  activeScenarioId,
  manualOverrides,
  aopState,
  createdBy = "Anonymous",
}) {
  return {
    id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(name || "Untitled forecast").trim(),
    description: String(description || "").trim(),
    createdAt: new Date().toISOString(),
    createdBy,
    baseline: { ...baseline },
    baselineLabel,
    forecastYear,
    horizonYears,
    activeScenarioId,
    // Persist just the user-controlled inputs + computed totals; UI can recompute
    // if it wants full waterfall later.
    scenarios: scenarios.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      notes: s.notes ?? "",
      drivers: { ...s.drivers },
      aopState: s.aopState ? {
        fileName: s.aopState.fileName,
        rows: s.aopState.rows,
        overrides: s.aopState.overrides,
      } : null,
      forecastedTotal:    s.result?.forecastedTotal,
      forecastedRate:     s.result?.forecastedRate,
      forecastedHeadcount: s.result?.forecastedHeadcount,
    })),
    manualOverrides: { ...manualOverrides },
    aopState: aopState ? {
      fileName: aopState.fileName,
      rows: aopState.rows,
      overrides: aopState.overrides,
    } : null,
  };
}

export function useSnapshots() {
  const [snapshots, setSnapshots] = useState(loadSnapshots);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
    } catch {
      // quota errors ignored
    }
  }, [snapshots]);

  const addSnapshot = (snapshot) => {
    setSnapshots((prev) => [snapshot, ...prev]);
  };

  const deleteSnapshot = (id) => {
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
  };

  const clearAll = () => setSnapshots([]);

  return {
    snapshots,
    addSnapshot,
    deleteSnapshot,
    clearAll,
  };
}
