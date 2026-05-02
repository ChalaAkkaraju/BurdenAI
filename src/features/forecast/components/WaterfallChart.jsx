// WaterfallChart.jsx
// Renders a waterfall chart from the forecast engine's `waterfall` array.
//
// Recharts trick: stack two bar series.
//   - "base" is invisible (transparent) and carries the running total floor.
//   - "delta" is visible and shows the contribution of each step.
// Anchor bars (Current, Forecast) sit on the floor (base = 0) and span 0..value.

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
} from "recharts";

const formatUSD = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
};

// Convert engine waterfall into Recharts-friendly data with `base` and `delta`.
function buildChartData(waterfall) {
  const data = [];
  let runningPrev = 0;

  for (const step of waterfall) {
    if (step.kind === "anchor") {
      // Anchors (Current, Forecast) sit on zero floor, span 0..value
      data.push({
        label: step.label,
        base: 0,
        delta: step.value,
        kind: "anchor",
        signed: step.value,
      });
      runningPrev = step.cumulative;
    } else {
      // Deltas: float between previous cumulative and new cumulative
      const isPositive = step.value >= 0;
      const base = isPositive ? runningPrev : runningPrev + step.value; // negative starts lower
      data.push({
        label: step.label,
        base,
        delta: Math.abs(step.value),
        kind: isPositive ? "positive" : "negative",
        signed: step.value,
      });
      runningPrev = step.cumulative;
    }
  }
  return data;
}

const COLORS = {
  anchor: "#1e293b",   // slate-800
  positive: "#dc2626", // red-600 (cost going up = bad)
  negative: "#059669", // emerald-600 (cost going down = good)
};

const renderTooltip = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-gray-900">{row.label}</p>
      <p className="text-gray-600 font-mono">{formatUSD(row.signed)}</p>
    </div>
  );
};

export default function WaterfallChart({ waterfall }) {
  const data = buildChartData(waterfall);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900">
          Forecast waterfall
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          How each driver contributes to the forecasted total burden
        </p>
      </div>

      <div style={{ width: "100%", height: 380 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 24, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
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
            <Tooltip content={renderTooltip} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar dataKey="base" stackId="wf" fill="transparent" />
            <Bar dataKey="delta" stackId="wf" radius={[4, 4, 0, 0]}>
              {data.map((d, idx) => (
                <Cell key={idx} fill={COLORS[d.kind]} />
              ))}
              <LabelList
                dataKey="signed"
                position="top"
                formatter={formatUSD}
                style={{ fontSize: 11, fontWeight: 600, fill: "#1e293b" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
