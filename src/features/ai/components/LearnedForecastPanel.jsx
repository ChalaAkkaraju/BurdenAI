// LearnedForecastPanel.jsx — the learned forecast on the Forecast page.
// A seasonal trend model fitted on monthly burden cost, shown next to the
// driver scenarios, with its 80% range and how well it has done in backtests.

import React, { useMemo, useState } from "react";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot, ReferenceLine } from "recharts";
import { SparkIcon } from "./Drawer.jsx";
import { useApp } from "../../../context/AppContext";
import { learnedFromPeriods } from "../engine/forecastSummary.js";
import { backtest, learnedBacktest, scorecard, LEARNED_ID } from "../../reports/engine.js";
import { monthLabel } from "../../planVsActual/engine/fiscal.js";
import { money } from "../../planVsActual/format.js";

const SCEN_COLORS = ["#7c3aed", "#ea580c", "#0d9488", "#2563eb", "#db2777"];

export default function LearnedForecastPanel({ scenarios }) {
  const { periodData, selectedPeriod } = useApp();
  const [showScen, setShowScen] = useState(true);
  const lf = useMemo(() => learnedFromPeriods(periodData, selectedPeriod, 12), [periodData, selectedPeriod]);

  const scores = useMemo(() => {
    const asOf = periodData[periodData.length - 1]?.period;
    if (!asOf) return [];
    return scorecard([
      ...backtest({ periodData, scenarios, asOfPeriod: asOf, years: 4 }),
      ...learnedBacktest({ periodData, asOfPeriod: asOf, years: 4 }),
    ]);
  }, [periodData, scenarios]);

  if (!lf) {
    return (
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-sm text-gray-600">
        The learned forecast needs at least 26 months of history before the baseline month.
      </div>
    );
  }

  const hist = lf.history.slice(-24);
  const target = lf.periods[11];
  const data = [
    ...hist.map((p, i) => ({
      label: monthLabel(p.period),
      actual: Math.round(p.totalCostToCompany),
      // Connect the forecast line to the last actual month.
      learned: i === hist.length - 1 ? Math.round(p.totalCostToCompany) : null,
      band: i === hist.length - 1 ? [Math.round(p.totalCostToCompany), Math.round(p.totalCostToCompany)] : null,
    })),
    ...lf.periods.map((p, i) => ({
      label: monthLabel(p),
      learned: Math.round(lf.path[i]),
      band: [Math.round(lf.range[i].low), Math.round(lf.range[i].high)],
    })),
  ];
  const learnedScore = scores.find((s) => s.scenarioId === LEARNED_ID);
  const baseScore = scores.find((s) => s.scenarioId === "base");
  const end = lf.path[11];
  const all = data.flatMap((d) => [d.actual, d.learned, ...(d.band || [])]).filter((v) => v != null);
  if (showScen) for (const s of scenarios) all.push(s.result.forecastedTotal);
  const lo = Math.min(...all) * 0.97;
  const hi = Math.max(...all) * 1.02;

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-700 mb-1">
            <SparkIcon size={12} /> Learned forecast
          </div>
          <h2 className="text-lg font-semibold text-gray-900">What the history alone says</h2>
          <p className="text-xs text-gray-500 mt-1">A fourth view next to the driver scenarios, fitted on monthly burden cost up to {monthLabel(selectedPeriod)}.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={showScen} onChange={(e) => setShowScen(e.target.checked)} className="rounded border-gray-300" />
          Show driver scenarios
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 mt-4">
        <div className="h-72" role="img" aria-label={`Monthly burden cost history and learned forecast to ${monthLabel(target)}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 11 }} interval={5} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} domain={[lo, hi]} tickFormatter={(v) => money(v, undefined, { decimals: 1 })} width={64} />
              <Tooltip
                formatter={(v, n) => (Array.isArray(v) ? [`${money(v[0])} – ${money(v[1])}`, n] : [money(v), n])}
                itemStyle={{ color: "#111827" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: "#374151" }}>{v}</span>} />
              <ReferenceLine x={monthLabel(selectedPeriod)} stroke="#cbd5e1" strokeDasharray="3 3" label={{ value: "today", fontSize: 10, fill: "#64748b", position: "insideTopRight" }} />
              <Area dataKey="band" name="80% range" stroke="none" fill="#ddd6fe" fillOpacity={0.7} isAnimationActive={false} connectNulls />
              <Line dataKey="actual" name="Actual" stroke="#1e293b" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="learned" name="Learned forecast" stroke="#7c3aed" strokeWidth={2.5} strokeDasharray="5 3" dot={false} isAnimationActive={false} connectNulls />
              {showScen && scenarios.map((s, i) => (
                <ReferenceDot key={s.id} x={monthLabel(target)} y={s.result.forecastedTotal} r={5}
                  fill={SCEN_COLORS[i % SCEN_COLORS.length]} stroke="#fff" strokeWidth={1.5} ifOverflow="extendDomain" />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">
            <div className="text-xs font-medium text-violet-800">Learned · {monthLabel(target)}</div>
            <div className="text-3xl font-bold text-violet-900 mt-1">{money(end)}</div>
            <div className="text-xs text-violet-800 mt-0.5">80% range {money(lf.range[11].low)} – {money(lf.range[11].high)}</div>
          </div>
          {showScen && (
            <ul className="space-y-1.5 text-sm">
              {scenarios.map((s, i) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-gray-700">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: SCEN_COLORS[i % SCEN_COLORS.length] }} />{s.name}
                  </span>
                  <span className="font-medium tabular-nums text-gray-900">{money(s.result.forecastedTotal)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-gray-500">Backtest miss</div>
              <div className="font-bold text-gray-900">{learnedScore ? `${(learnedScore.costMape * 100).toFixed(1)}%` : "—"}</div>
              {baseScore && <div className="text-xs text-gray-500">vs Base {(baseScore.costMape * 100).toFixed(1)}%</div>}
            </div>
            <div>
              <div className="text-xs text-gray-500">Fitted on</div>
              <div className="font-bold text-gray-900">{lf.fittedOn} months</div>
              <div className="text-xs text-gray-500">trend + yearly pattern</div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-4 leading-relaxed">
        How it works: a seasonal trend model (Holt-Winters) is fitted on monthly burden cost for the whole company, using only data up to
        the baseline month. It knows nothing about planned hires or inflation — it shows where the history points, so a big gap to a driver
        scenario is worth a look. It is scored in Reports › Forecast Accuracy next to the driver scenarios. It runs inside the app; no outside service.
      </p>
    </div>
  );
}
