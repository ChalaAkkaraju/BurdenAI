// UtilizationTrend.jsx — monthly utilization, actual vs plan vs target.

import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea,
} from "recharts";
import { monthLabel } from "../engine/fiscal.js";

export default function UtilizationTrend({ trend, selectedPeriods, fyLabel }) {
  const selected = new Set(selectedPeriods);
  const data = trend.map((t) => ({
    label: monthLabel(t.period, false),
    period: t.period,
    actual: t.hasData ? Number(t.actualUtil.toFixed(1)) : null,
    plan: t.hasPlan ? Number(t.planUtil.toFixed(1)) : null,
    target: t.hasPlan ? Number(t.targetUtil.toFixed(1)) : null,
  }));
  const vals = data.flatMap((d) => [d.actual, d.plan, d.target]).filter((v) => v != null);
  const lo = vals.length ? Math.floor(Math.min(...vals) - 2) : 60;
  const hi = vals.length ? Math.ceil(Math.max(...vals) + 2) : 100;
  const first = data.find((d) => selected.has(d.period));
  const last = [...data].reverse().find((d) => selected.has(d.period));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-bold text-gray-900">Utilization by month — {fyLabel}</h3>
      <p className="text-xs text-gray-500 mt-1">
        Productive ÷ available hours. The plan is spread evenly, so it is flat unless an upload changes a month.
        The shaded months are the ones in the figures above; months without actuals yet show the plan only.
      </p>
      <div className="h-64 mt-4" role="img" aria-label={`Monthly utilization for ${fyLabel}: actual compared with plan and target`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="#f3f4f6" vertical={false} />
            {first && last && (
              <ReferenceArea x1={first.label} x2={last.label} fill="#eff6ff" fillOpacity={0.8} />
            )}
            <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 12 }} tickLine={false} />
            <YAxis domain={[lo, hi]} stroke="#9ca3af" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} tickLine={false} width={48} />
            <Tooltip formatter={(v, name) => [`${v}%`, name]} labelStyle={{ fontWeight: 600 }} />
            <Line type="linear" dataKey="target" name="Target" stroke="#6b7280" strokeDasharray="2 5" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="linear" dataKey="plan" name="Plan" stroke="#7c3aed" strokeDasharray="8 6" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="actual" name="Actual" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1.5"><span className="w-5 h-[3px] bg-blue-600" />Actual</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-violet-600" />Plan</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t-2 border-dotted border-gray-500" />Target</span>
      </div>
    </div>
  );
}
