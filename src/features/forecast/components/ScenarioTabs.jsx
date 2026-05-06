// ScenarioTabs.jsx
// Pill-style tab bar for switching between scenarios. Each tab shows the
// scenario name and a tiny preview of its forecasted total.

import React from "react";
import { Layers, RotateCcw, FileText } from "lucide-react";

const formatUSD = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
};

export default function ScenarioTabs({ scenarios, activeId, onSelect, onResetAll }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <Layers size={14} />
          Scenarios
        </div>

        {scenarios.map((s) => {
          const isActive = s.id === activeId;
          const hasAop = !!s.aopState;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              title={hasAop ? `AOP attached: ${s.aopState.fileName}` : "No AOP attached"}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition border ${
                isActive
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <span className="font-semibold">{s.name}</span>
              {hasAop && (
                <FileText size={11} className={isActive ? "text-emerald-600" : "text-emerald-500"} />
              )}
              <span
                className={`text-xs font-mono ${
                  isActive ? "text-blue-500" : "text-gray-400"
                }`}
              >
                {formatUSD(s.result.forecastedTotal)}
              </span>
            </button>
          );
        })}

        <div className="ml-auto">
          <button
            onClick={onResetAll}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-gray-900 transition"
          >
            <RotateCcw size={12} />
            Reset all scenarios
          </button>
        </div>
      </div>
    </div>
  );
}
