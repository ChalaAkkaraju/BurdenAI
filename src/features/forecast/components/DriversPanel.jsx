// DriversPanel.jsx
// Three input controls: inflation %, productivity %, AOP headcount delta %.
// Calls onChange(key, value) up to the parent.

import React from "react";
import { TrendingUp, Zap, Users, RotateCcw, Calendar, Shield } from "lucide-react";

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

export default function DriversPanel({ drivers, onChange, onReset }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
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

      {/* 5 drivers as horizontal cards — wraps to 2-3 cols on narrower screens */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {driverConfig.map((cfg) => {
          const Icon = cfg.icon;
          const value = drivers[cfg.key] ?? 0;
          return (
            <div
              key={cfg.key}
              title={cfg.helper}
              className="border border-gray-100 rounded-lg p-2.5 hover:border-gray-300 transition bg-gray-50/40"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <div className={`p-1 rounded ${cfg.bg}`}>
                  <Icon size={12} className={cfg.accent} />
                </div>
                <span className="text-xs font-semibold text-gray-900 truncate">
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
                  min={cfg.min}
                  max={cfg.max}
                  step={cfg.step}
                  className="w-full px-1.5 py-0.5 text-base font-bold font-mono text-gray-900 text-center bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
                {cfg.suffix && (
                  <span className="text-sm text-gray-500 font-medium">
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
                className="w-full accent-blue-600 h-1"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
