// DriversPanel.jsx
// Three input controls: inflation %, productivity %, AOP headcount delta %.
// Calls onChange(key, value) up to the parent.

import React from "react";
import { TrendingUp, Zap, Users, RotateCcw } from "lucide-react";

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
];

export default function DriversPanel({ drivers, onChange, onReset }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Forecast drivers</h3>
          <p className="text-xs text-gray-500 mt-1">
            Adjust to see how the forecast changes
          </p>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      <div className="space-y-6">
        {driverConfig.map((cfg) => {
          const Icon = cfg.icon;
          const value = drivers[cfg.key] ?? 0;
          return (
            <div key={cfg.key}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${cfg.bg}`}>
                    <Icon size={14} className={cfg.accent} />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {cfg.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={value}
                    onChange={(e) =>
                      onChange(cfg.key, parseFloat(e.target.value) || 0)
                    }
                    min={cfg.min}
                    max={cfg.max}
                    step={cfg.step}
                    className="w-20 px-2 py-1 text-sm font-mono text-right border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  />
                  <span className="text-sm text-gray-500 font-medium">
                    {cfg.suffix}
                  </span>
                </div>
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
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-gray-500">{cfg.helper}</p>
                <p className="text-xs text-gray-400 font-mono">
                  {cfg.min}% — {cfg.max}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
