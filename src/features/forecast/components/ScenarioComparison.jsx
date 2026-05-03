// ScenarioComparison.jsx
// Side-by-side comparison table for all scenarios. The screenshot for the
// exec deck.

import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

const formatUSD = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
};

const formatRate = (n) => `$${n.toFixed(2)}/hr`;
const formatNumber = (n) => n.toLocaleString();
const formatPct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

function deltaPct(value, base) {
  if (base === 0) return 0;
  return ((value - base) / base) * 100;
}

export default function ScenarioComparison({ scenarios, baseline, activeId }) {
  const [expanded, setExpanded] = useState(true);

  const baseTotal = baseline.totalBurden;
  const baseRate  = baseline.totalBurden / baseline.productiveHours;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
          <div className="text-left">
            <h3 className="text-lg font-bold text-gray-900">Scenario comparison</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Side-by-side view of every saved scenario versus current baseline
            </p>
          </div>
        </div>
        <div className="text-xs text-gray-400">
          {scenarios.length} scenarios
        </div>
      </button>

      {expanded && (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Metric
              </th>
              <th className="text-right py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Baseline
              </th>
              {scenarios.map((s) => (
                <th
                  key={s.id}
                  className={`text-right py-3 px-2 text-xs font-semibold uppercase tracking-wider ${
                    s.id === activeId ? "text-blue-600" : "text-gray-500"
                  }`}
                >
                  {s.name}
                  {s.id === activeId && (
                    <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 align-middle" />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-gray-900">
            {/* Drivers section */}
            <tr className="bg-gray-50">
              <td colSpan={2 + scenarios.length} className="py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Drivers
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-2 text-gray-700">Inflation</td>
              <td className="text-right py-2 px-2 text-gray-400 font-mono">—</td>
              {scenarios.map((s) => (
                <td key={s.id} className="text-right py-2 px-2 font-mono">
                  {s.drivers.inflationPct}%
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-2 text-gray-700">Productivity gain</td>
              <td className="text-right py-2 px-2 text-gray-400 font-mono">—</td>
              {scenarios.map((s) => (
                <td key={s.id} className="text-right py-2 px-2 font-mono">
                  {s.drivers.productivityPct}%
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-2 text-gray-700">AOP headcount delta</td>
              <td className="text-right py-2 px-2 text-gray-400 font-mono">—</td>
              {scenarios.map((s) => (
                <td key={s.id} className="text-right py-2 px-2 font-mono">
                  {s.drivers.aopHeadcountDeltaPct >= 0 ? "+" : ""}
                  {s.drivers.aopHeadcountDeltaPct}%
                </td>
              ))}
            </tr>

            {/* Outputs section */}
            <tr className="bg-gray-50">
              <td colSpan={2 + scenarios.length} className="py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Forecast
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-2 font-medium text-gray-900">Total burden</td>
              <td className="text-right py-2 px-2 font-mono text-gray-700">
                {formatUSD(baseTotal)}
              </td>
              {scenarios.map((s) => {
                const dp = deltaPct(s.result.forecastedTotal, baseTotal);
                return (
                  <td key={s.id} className="text-right py-2 px-2">
                    <div className="font-mono font-semibold text-gray-900">
                      {formatUSD(s.result.forecastedTotal)}
                    </div>
                    <div className={`text-xs font-mono ${dp >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatPct(dp)}
                    </div>
                  </td>
                );
              })}
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-2 font-medium text-gray-900">Burden rate</td>
              <td className="text-right py-2 px-2 font-mono text-gray-700">
                {formatRate(baseRate)}
              </td>
              {scenarios.map((s) => {
                const dp = deltaPct(s.result.forecastedRate, baseRate);
                return (
                  <td key={s.id} className="text-right py-2 px-2">
                    <div className="font-mono font-semibold text-gray-900">
                      {formatRate(s.result.forecastedRate)}
                    </div>
                    <div className={`text-xs font-mono ${dp >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatPct(dp)}
                    </div>
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="py-2 px-2 font-medium text-gray-900">Headcount</td>
              <td className="text-right py-2 px-2 font-mono text-gray-700">
                {formatNumber(baseline.headcount)}
              </td>
              {scenarios.map((s) => {
                const dp = deltaPct(s.result.forecastedHeadcount, baseline.headcount);
                return (
                  <td key={s.id} className="text-right py-2 px-2">
                    <div className="font-mono font-semibold text-gray-900">
                      {formatNumber(s.result.forecastedHeadcount)}
                    </div>
                    <div className={`text-xs font-mono ${dp >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatPct(dp)}
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
