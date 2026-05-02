// CountryBreakdown.jsx
// Per-country breakdown of the active scenario's forecast. Shows each country's
// baseline, forecasted total, and share of the global forecast. Designed for
// finance leads who want to see which countries are driving the change.

import React, { useState } from "react";
import { Globe, ChevronDown, ChevronRight } from "lucide-react";

const formatUSD = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
};

const formatRate = (n) => `$${n.toFixed(2)}/hr`;
const formatPct  = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

const COUNTRY_NAME = {
  US: "USA", IN: "India", GB: "UK", DE: "Germany",
  JP: "Japan", AU: "Australia", SG: "Singapore", BR: "Brazil",
  FR: "France", CA: "Canada", MX: "Mexico", PH: "Philippines",
};

function deltaPct(value, base) {
  if (base === 0) return 0;
  return ((value - base) / base) * 100;
}

export default function CountryBreakdown({ activeScenario, countryForecast }) {
  const [expanded, setExpanded] = useState(true);

  if (!countryForecast || !countryForecast.byCountry || countryForecast.byCountry.length === 0) {
    return null;
  }

  // Sort by forecasted total descending — biggest contributors first
  const rows = [...countryForecast.byCountry].sort(
    (a, b) => b.forecastedTotal - a.forecastedTotal
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
          <Globe size={18} className="text-blue-600" />
          <div className="text-left">
            <h3 className="text-lg font-bold text-gray-900">
              Country contribution
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {activeScenario.name} scenario, broken down by geography ·{" "}
              {rows.length} countries
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Forecasted total</div>
          <div className="text-base font-bold text-gray-900 font-mono">
            {formatUSD(countryForecast.totals.forecastedTotal)}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Country</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Baseline</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Forecast</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Δ vs base</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Burden rate</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Headcount</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const dp = deltaPct(c.forecastedTotal, c.baseline.totalBurden);
                return (
                  <tr key={c.countryCode} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-2 font-medium text-gray-900">
                      {COUNTRY_NAME[c.countryCode] || c.label}
                      <span className="ml-2 text-xs text-gray-400 font-mono">{c.countryCode}</span>
                    </td>
                    <td className="text-right py-2.5 px-2 font-mono text-gray-600">
                      {formatUSD(c.baseline.totalBurden)}
                    </td>
                    <td className="text-right py-2.5 px-2 font-mono font-semibold text-gray-900">
                      {formatUSD(c.forecastedTotal)}
                    </td>
                    <td className={`text-right py-2.5 px-2 font-mono ${dp >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatPct(dp)}
                    </td>
                    <td className="text-right py-2.5 px-2 font-mono text-gray-700">
                      {formatRate(c.forecastedRate)}
                    </td>
                    <td className="text-right py-2.5 px-2 font-mono text-gray-700">
                      {c.forecastedHeadcount.toLocaleString()}
                    </td>
                    <td className="text-right py-2.5 px-2">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${Math.min(100, c.contributionPct)}%` }}
                          />
                        </div>
                        <span className="font-mono text-gray-700 text-xs w-12 text-right">
                          {c.contributionPct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td className="py-3 px-2 font-bold text-gray-900">Total</td>
                <td className="text-right py-3 px-2 font-mono font-semibold text-gray-700">
                  {formatUSD(countryForecast.totals.baselineTotal)}
                </td>
                <td className="text-right py-3 px-2 font-mono font-bold text-gray-900">
                  {formatUSD(countryForecast.totals.forecastedTotal)}
                </td>
                <td className={`text-right py-3 px-2 font-mono font-semibold ${
                  deltaPct(countryForecast.totals.forecastedTotal, countryForecast.totals.baselineTotal) >= 0
                    ? "text-red-600" : "text-emerald-600"
                }`}>
                  {formatPct(deltaPct(countryForecast.totals.forecastedTotal, countryForecast.totals.baselineTotal))}
                </td>
                <td className="text-right py-3 px-2 font-mono font-semibold text-gray-700">
                  {formatRate(countryForecast.totals.forecastedRate)}
                </td>
                <td className="text-right py-3 px-2 font-mono font-semibold text-gray-700">
                  {countryForecast.totals.forecastedHeadcount.toLocaleString()}
                </td>
                <td className="text-right py-3 px-2 font-mono font-semibold text-gray-700">100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
