// ForecastAccuracyTab.jsx — how good are the forecasts?
//  1. Backtest: each scenario's current drivers run from the actuals 12 months
//     before each anchor month, compared with what actually happened.
//  2. Saved snapshots: scored once their forecast month has actuals.

import React, { useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Camera, Info } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useSnapshots } from "../forecast/hooks/useSnapshots.js";
import { DEFAULT_SCENARIOS } from "../forecast/hooks/useScenarios.js";
import { money, rate } from "../planVsActual/format.js";
import { backtest, scorecard, snapshotAccuracy, periodLabel } from "./engine.js";
import { exportSheets, FMT, stamp } from "./exportXlsx.js";

const SCENARIO_COLORS = ["#7c3aed", "#ea580c", "#0d9488", "#2563eb", "#db2777"];

function loadScenarios() {
  try {
    const saved = JSON.parse(localStorage.getItem("burdenai_forecast_scenarios") || "null");
    if (Array.isArray(saved) && saved.length) return saved;
  } catch { /* fall back */ }
  return DEFAULT_SCENARIOS;
}

const errText = (e) => (e == null ? "—" : `${e >= 0 ? "+" : "−"}${Math.abs(e * 100).toFixed(1)}%`);
const errClass = (e) => (e == null ? "text-gray-400" : Math.abs(e) <= 0.03 ? "text-blue-700" : Math.abs(e) <= 0.08 ? "text-amber-700" : "text-orange-700");

export default function ForecastAccuracyTab({ onExportReady, onNavigate }) {
  const { periodData, periods } = useApp();
  const { snapshots } = useSnapshots();
  const scenarios = useMemo(loadScenarios, []);
  const asOf = periods[periods.length - 1];

  const rows = useMemo(() => backtest({ periodData, scenarios, asOfPeriod: asOf, years: 4 }), [periodData, scenarios, asOf]);
  const scores = useMemo(() => scorecard(rows), [rows]);
  const snapRows = useMemo(() => snapshotAccuracy({ snapshots, periodData }), [snapshots, periodData]);

  const anchors = [...new Set(rows.map((r) => r.actualPeriod))].sort();
  const chartData = anchors.map((p) => {
    const d = { label: periodLabel(p) };
    const rs = rows.filter((r) => r.actualPeriod === p);
    d.Actual = Math.round(rs[0].actualCost);
    for (const r of rs) d[r.scenarioName] = Math.round(r.forecastCost);
    return d;
  });

  useEffect(() => {
    onExportReady?.(() => {
      const bt = [["Forecast made from", "Compared with", "Scenario", "Forecast cost", "Actual cost", "Cost error",
        "Forecast rate", "Actual rate", "Rate error", "Forecast headcount", "Actual headcount"],
        ...rows.map((r) => [periodLabel(r.baselinePeriod), periodLabel(r.actualPeriod), r.scenarioName, r.forecastCost, r.actualCost,
          r.costErrPct, r.forecastRate, r.actualRate, r.rateErrPct, r.forecastHeadcount, r.actualHeadcount])];
      const sc = [["Scenario", "Tests", "Cost — mean absolute error", "Cost — average bias", "Rate — mean absolute error"],
        ...scores.map((s) => [s.scenarioName, s.tests, s.costMape, s.costBias, s.rateMape])];
      const sn = [["Snapshot", "Saved", "Scenario", "Active", "Baseline month", "Due month", "Status", "Forecast cost", "Actual cost", "Cost error", "Forecast rate", "Actual rate", "Rate error"],
        ...snapRows.map((r) => [r.snapshotName, r.createdAt?.slice(0, 10), r.scenarioName, r.isActive ? "Yes" : "",
          r.baselinePeriod ? periodLabel(r.baselinePeriod) : "", r.duePeriod ? periodLabel(r.duePeriod) : "", r.status,
          r.forecastCost, r.actualCost, r.costErrPct, r.forecastRate, r.actualRate, r.rateErrPct])];
      exportSheets(`burdenai-forecast-accuracy-${stamp()}.xlsx`, [
        { name: "Scorecard", rows: sc, formats: { 2: FMT.pct, 3: FMT.pct, 4: FMT.pct }, widths: [20, 8, 26, 22, 26] },
        { name: "Backtest", rows: bt, formats: { 3: FMT.usd, 4: FMT.usd, 5: FMT.pct, 6: FMT.rate, 7: FMT.rate, 8: FMT.pct, 9: FMT.int, 10: FMT.int } },
        { name: "Saved snapshots", rows: sn, formats: { 7: FMT.usd, 8: FMT.usd, 9: FMT.pct, 10: FMT.rate, 11: FMT.rate, 12: FMT.pct } },
      ]);
      return "Forecast accuracy";
    });
  }, [rows, scores, snapRows, onExportReady]);

  const best = scores[0];

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg border border-gray-200 flex items-start gap-2 text-sm text-gray-600">
        <Info size={16} className="mt-0.5 shrink-0 text-gray-400" />
        <p>
          <strong className="text-gray-800">Backtest:</strong> each scenario's current drivers are run from the actuals 12 months
          before each month below — the same calculation as the Forecast page — and compared with what actually happened.
          Saved snapshots are scored the same way once their forecast month has actuals.
        </p>
      </div>

      {/* Scorecard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scores.map((s, i) => (
          <div key={s.scenarioId} className={`bg-white p-5 rounded-lg border ${i === 0 ? "border-blue-300 ring-1 ring-blue-200" : "border-gray-200"}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">{s.scenarioName}</span>
              {i === 0 && <span className="text-[11px] font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">Most accurate</span>}
            </div>
            <div className="text-3xl font-bold text-gray-900 mt-2">{(s.costMape * 100).toFixed(1)}%</div>
            <div className="text-xs text-gray-500">average miss on burden cost · {s.tests} tests</div>
            <div className="text-xs text-gray-700 mt-2">
              Bias {errText(s.costBias)} ({s.costBias >= 0 ? "tends to over-forecast" : "tends to under-forecast"}) · Rate miss {(s.rateMape * 100).toFixed(1)}%
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Forecast vs actual burden cost</h2>
        <p className="text-xs text-gray-500 mt-1">Monthly burden cost: what each scenario forecast a year earlier, against the actual.</p>
        <div className="h-80 mt-4" role="img" aria-label="Forecast versus actual burden cost by scenario">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 8, left: 8, bottom: 0 }} barGap={2}>
              <CartesianGrid stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} domain={[(min) => Math.floor((min * 0.9) / 100000) * 100000, (max) => Math.ceil((max * 1.03) / 100000) * 100000]} tickFormatter={(v) => money(v, undefined, { decimals: 1 })} width={70} />
              <Tooltip formatter={(v, n) => [money(v), n]} itemStyle={{ color: "#111827" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: "#374151" }}>{v}</span>} />
              <Bar dataKey="Actual" fill="#1e293b" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              {scenarios.map((s, i) => (
                <Bar key={s.id} dataKey={s.name} fill={SCENARIO_COLORS[i % SCENARIO_COLORS.length]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {best && (
          <p className="text-sm text-gray-700 mt-2">
            <strong>{best.scenarioName}</strong> has been closest on average, missing by {(best.costMape * 100).toFixed(1)}%.
            The sample workforce is flat year to year, so each scenario misses in the direction of the headcount change it assumes (growth over-forecasts, cuts under-forecast).
          </p>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Backtest detail</h2>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 bg-gray-50">
                <th className="text-left px-3 py-2.5">Forecast made from</th>
                <th className="text-left px-3 py-2.5">Compared with</th>
                <th className="text-left px-3 py-2.5">Scenario</th>
                <th className="text-right px-3 py-2.5">Forecast cost</th>
                <th className="text-right px-3 py-2.5">Actual cost</th>
                <th className="text-right px-3 py-2.5">Error</th>
                <th className="text-right px-3 py-2.5">Forecast rate</th>
                <th className="text-right px-3 py-2.5">Actual rate</th>
                <th className="text-right px-3 py-2.5">Error</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].sort((a, b) => b.actualPeriod.localeCompare(a.actualPeriod)).map((r) => (
                <tr key={`${r.actualPeriod}-${r.scenarioId}`} className="border-t border-gray-100">
                  <td className="px-3 py-2">{periodLabel(r.baselinePeriod)}</td>
                  <td className="px-3 py-2">{periodLabel(r.actualPeriod)}</td>
                  <td className="px-3 py-2">{r.scenarioName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(r.forecastCost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(r.actualCost)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${errClass(r.costErrPct)}`}>{errText(r.costErrPct)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rate(r.forecastRate)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rate(r.actualRate)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${errClass(r.rateErrPct)}`}>{errText(r.rateErrPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">Error = (forecast − actual) ÷ actual. Blue within ±3%, amber within ±8%, orange beyond.</p>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-violet-600" />
          <h2 className="text-lg font-semibold text-gray-900">Saved snapshots</h2>
        </div>
        {snapRows.length === 0 ? (
          <div className="mt-3 text-sm text-gray-600">
            No Forecast snapshots saved yet. Save one on the Forecast page — it will appear here straight away and be scored
            once its forecast month (12 months after its baseline) has actuals.
            {onNavigate && (
              <button type="button" onClick={() => onNavigate("forecast")} className="ml-2 font-semibold text-violet-700 hover:text-violet-900">
                Go to Forecast →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 bg-gray-50">
                  <th className="text-left px-3 py-2.5">Snapshot</th>
                  <th className="text-left px-3 py-2.5">Scenario</th>
                  <th className="text-left px-3 py-2.5">Baseline</th>
                  <th className="text-left px-3 py-2.5">Due</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                  <th className="text-right px-3 py-2.5">Forecast cost</th>
                  <th className="text-right px-3 py-2.5">Actual cost</th>
                  <th className="text-right px-3 py-2.5">Error</th>
                </tr>
              </thead>
              <tbody>
                {snapRows.map((r) => (
                  <tr key={`${r.snapshotId}-${r.scenarioName}`} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <span className="block text-gray-900">{r.snapshotName}</span>
                      <span className="block text-xs text-gray-500">saved {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}</span>
                    </td>
                    <td className="px-3 py-2">{r.scenarioName}{r.isActive ? " (active)" : ""}</td>
                    <td className="px-3 py-2">{r.baselinePeriod ? periodLabel(r.baselinePeriod) : "—"}</td>
                    <td className="px-3 py-2">{r.duePeriod ? periodLabel(r.duePeriod) : "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.status === "Scored" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700"}`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(r.forecastCost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.actualCost != null ? money(r.actualCost) : "—"}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${errClass(r.costErrPct)}`}>{errText(r.costErrPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
