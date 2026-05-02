// MultiYearChart.jsx
// Line chart showing each scenario's forecasted total burden trajectory over
// the horizon (year 0 = baseline through year N).

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const formatUSD = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
};

// Predefined scenario colors. If we ever add more scenarios, fall back to a
// neutral gray.
const SCENARIO_COLORS = {
  base: "#2563eb",   // blue-600
  high: "#dc2626",   // red-600
  low:  "#059669",   // emerald-600 (called "Conservative" in UI)
};
const FALLBACK_COLOR = "#6b7280"; // gray-500

const renderTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((row) => (
        <div key={row.dataKey} className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: row.color }}
          />
          <span className="text-gray-700">{row.name}</span>
          <span className="ml-auto font-mono text-gray-900">
            {formatUSD(row.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function MultiYearChart({ scenarios, baselineYear }) {
  // Reshape: we want one row per yearOffset, with a column per scenario.
  // [{ year: '2026', Base: 6400000, High: 6400000, Conservative: 6400000 },
  //  { year: '2027', Base: ..., High: ..., Conservative: ... }, ...]
  const horizonYears = scenarios[0]?.trajectory?.length || 1;
  const data = [];
  for (let i = 0; i < horizonYears; i++) {
    const point = scenarios[0].trajectory[i];
    const yearLabel = baselineYear ? String(baselineYear + point.yearOffset) : `Year ${point.yearOffset}`;
    const row = {
      year: yearLabel,
      _isBaseline: point.yearOffset === 0,
    };
    for (const s of scenarios) {
      row[s.name] = s.trajectory[i].totalBurden;
    }
    data.push(row);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900">
          Multi-year trajectory
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Total burden compounded across the forecast horizon by scenario
        </p>
      </div>

      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12, fill: "#475569" }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatUSD}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={renderTooltip} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              iconType="circle"
            />
            {scenarios.map((s) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.name}
                stroke={SCENARIO_COLORS[s.id] || FALLBACK_COLOR}
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
