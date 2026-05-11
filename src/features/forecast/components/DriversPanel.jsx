// DriversPanel.jsx
// Three input controls: inflation %, productivity %, AOP headcount delta %.
// Calls onChange(key, value) up to the parent.

import React from "react";
import { TrendingUp, Zap, Users, RotateCcw, Calendar, Shield, Lock } from "lucide-react";

// Map a global driver key to the per-country override key it might collide with.
// When at least one country has an override for that key, the global slider
// is locked so country-level work can't be overwritten by accident.
const DRIVER_TO_OVERRIDE_KEY = {
  inflationPct: "inflationPct",
  productivityPct: "productivityPct",
  aopHeadcountDeltaPct: "aopHeadcountDeltaPct",
  hiringRamp: "hiringRamp",
  // hedgeRatio is global by design — no per-country lock.
};

function countOverrides(manualOverrides, key) {
  if (!manualOverrides || !key) return 0;
  return Object.values(manualOverrides).filter((ov) => ov && ov[key] != null).length;
}

const driverConfig = [
  {
    key: "inflationPct",
    label: "Inflation",
    icon: TrendingUp,
    min: 0,
    max: 20,
    step: 0.5,
    suffix: "%",
    helper: "Blended wage + benefits + overhead inflation",
    accent: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    key: "productivityPct",
    label: "Productivity gain",
    icon: Zap,
    min: 0,
    max: 20,
    step: 0.5,
    suffix: "%",
    helper: "Same output achieved with less people-cost",
    accent: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    key: "aopHeadcountDeltaPct",
    label: "AOP headcount delta",
    icon: Users,
    min: -20,
    max: 50,
    step: 1,
    suffix: "%",
    helper: "Planned headcount growth from the AOP",
    accent: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    key: "hiringRamp",
    label: "Hiring ramp",
    icon: Calendar,
    min: 0,
    max: 1,
    step: 0.05,
    suffix: "",
    helper: "1 = Jan hires · 0.5 = uniform · 0 = Dec hires",
    accent: "text-purple-600",
    bg: "bg-purple-50",
    isRamp: true,
  },
  {
    key: "hedgeRatio",
    label: "FX hedge ratio",
    icon: Shield,
    min: 0,
    max: 1,
    step: 0.05,
    suffix: "",
    helper: "0 = unhedged (full FX impact) · 1 = fully hedged",
    accent: "text-cyan-600",
    bg: "bg-cyan-50",
  },
];

export default function DriversPanel({ drivers, onChange, onReset, manualOverrides = {}, onScrollToCountryPanel }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Forecast drivers</h3>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition"
          title="Reset this scenario to defaults"
        >
          <RotateCcw size={12} />
          Reset
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Set baseline defaults. Sliders lock when a country has its own value.
      </p>

      {/* 5 drivers as horizontal cards — wraps to 2-3 cols on narrower screens */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {driverConfig.map((cfg) => {
          const Icon = cfg.icon;
          const value = drivers[cfg.key] ?? 0;
          const overrideKey = DRIVER_TO_OVERRIDE_KEY[cfg.key];
          const overrideCount = countOverrides(manualOverrides, overrideKey);
          const locked = overrideCount > 0;
          return (
            <div
              key={cfg.key}
              title={locked
                ? `Locked because ${overrideCount} ${overrideCount === 1 ? "country has" : "countries have"} their own ${cfg.label.toLowerCase()} value. Clear in the country panel below to unlock.`
                : cfg.helper}
              className={`border rounded-lg p-2.5 transition ${
                locked
                  ? "border-amber-200 bg-amber-50/30"
                  : "border-gray-100 hover:border-gray-300 bg-gray-50/40"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <div className={`p-1 rounded ${locked ? "bg-amber-100" : cfg.bg}`}>
                  {locked ? (
                    <Lock size={12} className="text-amber-700" />
                  ) : (
                    <Icon size={12} className={cfg.accent} />
                  )}
                </div>
                <span className={`text-xs font-semibold truncate ${locked ? "text-amber-900" : "text-gray-900"}`}>
                  {cfg.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-1.5">
                <input
                  type="number"
                  value={value}
                  onChange={(e) =>
                    onChange(cfg.key, parseFloat(e.target.value) || 0)
                  }
                  disabled={locked}
                  min={cfg.min}
                  max={cfg.max}
                  step={cfg.step}
                  className={`w-full px-1.5 py-0.5 text-base font-bold font-mono text-center border rounded focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 ${
                    locked
                      ? "text-gray-500 bg-gray-50 border-gray-200 cursor-not-allowed"
                      : "text-gray-900 bg-white border-gray-200"
                  }`}
                />
                {cfg.suffix && (
                  <span className={`text-sm font-medium ${locked ? "text-gray-400" : "text-gray-500"}`}>
                    {cfg.suffix}
                  </span>
                )}
              </div>
              <input
                type="range"
                min={cfg.min}
                max={cfg.max}
                step={cfg.step}
                value={value}
                onChange={(e) =>
                  onChange(cfg.key, parseFloat(e.target.value))
                }
                disabled={locked}
                className={`w-full h-1 ${locked ? "opacity-50 cursor-not-allowed" : "accent-blue-600"}`}
              />
              {locked && (
                <button
                  onClick={() => onScrollToCountryPanel && onScrollToCountryPanel()}
                  className="mt-2 w-full text-[10px] font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded px-1.5 py-0.5 transition"
                >
                  {overrideCount} country override{overrideCount === 1 ? "" : "s"} · manage
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
