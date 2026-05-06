// SensitivityChart.jsx
// Tornado chart showing how each driver's ±deltaPct perturbation moves the
// forecasted total. Rows sorted by swing magnitude (biggest at top).

import React, { useState } from "react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, LabelList,
} from "recharts";
import { Activity, ChevronDown, ChevronRight } from "lucide-react";

const formatUSD = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
};

const COST_UP   = "#dc2626"; // red — bad direction (cost rising)
const COST_DOWN = "#059669"; // green — good direction (cost falling)

const renderTooltip = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-gray-900 mb-1">{row.label}</p>
      <div className="space-y-0.5 text-xs">
        <div className="flex gap-3">
          <span className="text-gray-500 w-24">{row.lowValue}% (low)</span>
          <span className={`font-mono ${row.lowDelta >= 0 ? "text-red-600" : "text-emerald-600"}`}>
            {row.lowDelta >= 0 ? "+" : ""}{formatUSD(row.lowDelta)}
          </span>
        </div>
        <div className="flex gap-3">
          <span className="text-gray-500 w-24">{row.highValue}% (high)</span>
          <span className={`font-mono ${row.highDelta >= 0 ? "text-red-600" : "text-emerald-600"}`}>
            {row.highDelta >= 0 ? "+" : ""}{formatUSD(row.highDelta)}
          </span>
        </div>
        <div className="pt-1 mt-1 border-t border-gray-100 text-gray-600">
          Total swing: <span className="font-mono font-semibold">{formatUSD(row.swing)}</span>
        </div>
      </div>
    </div>
  );
};

export default function SensitivityChart({ sensitivity, deltaPct, onDeltaChange }) {
  const [expanded, setExpanded] = useState(false);

  if (!sensitivity || sensitivity.rows.length === 0) return null;

  const data = sensitivity.rows;

  // Domain padding — symmetric around zero based on largest absolute swing.
  const maxAbs = Math.max(
    ...data.flatMap((d) => [Math.abs(d.lowDelta), Math.abs(d.highDelta)])
  );
  const pad = maxAbs * 1.15 || 100_000;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between hover:opacity-80 transition mb-2"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
          <Activity size={18} className="text-rose-600" />
          <div className="text-left">
            <h3 className="text-lg font-bold text-gray-900">
              Sensitivity analysis
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Forecast impact of perturbing each driver by ±{deltaPct}pp ·
              biggest sensitivity first
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 uppercase tracking-wider font-semibold">Swing</span>
          <select
            value={deltaPct}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onDeltaChange(parseFloat(e.target.value))}
            className="px-2 py-1 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:border-gray-300 cursor-pointer"
          >
            <option value={1}>±1 pp</option>
            <option value={2}>±2 pp</option>
            <option value={5}>±5 pp</option>
          </select>
        </div>
      </button>

      {expanded && (
        <div style={{ width: "100%", height: Math.max(180, data.length * 70) }}>
          <ResponsiveContainer>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 12, right: 80, left: 8, bottom: 8 }}
              stackOffset="sign"
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis
                type="number"
                domain={[-pad, pad]}
                tickFormatter={formatUSD}
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 12, fill: "#1e293b", fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                width={140}
              />
              <ReferenceLine x={0} stroke="#475569" strokeWidth={1.5} />
              <Tooltip content={renderTooltip} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="lowDelta" stackId="t" radius={[0, 0, 0, 0]}>
                {data.map((d, idx) => (
                  <Cell key={idx} fill={d.lowDelta >= 0 ? COST_UP : COST_DOWN} />
                ))}
              </Bar>
              <Bar dataKey="highDelta" stackId="t" radius={[0, 0, 0, 0]}>
                {data.map((d, idx) => (
                  <Cell key={idx} fill={d.highDelta >= 0 ? COST_UP : COST_DOWN} />
                ))}
                <LabelList
                  dataKey="swing"
                  position="right"
                  formatter={(v) => `swing ${formatUSD(v)}`}
                  style={{ fontSize: 11, fontWeight: 600, fill: "#1e293b" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {expanded && (
        <p className="text-xs text-gray-400 italic mt-2">
          Red = unfavorable (cost rising) · Green = favorable (cost falling).
          Each driver perturbed independently from the active scenario; other drivers held constant.
        </p>
      )}
    </div>
  );
}
