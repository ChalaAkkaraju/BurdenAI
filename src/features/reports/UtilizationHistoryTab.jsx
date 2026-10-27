// UtilizationHistoryTab.jsx — utilization and over/under absorption by country
// across every fiscal year, so trends are visible beyond one year.

import React, { useEffect, useMemo, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useApp } from "../../context/AppContext";
import { usePersistedState } from "../forecast/hooks/usePersistedState.js";
import { buildActuals } from "../planVsActual/engine/actuals.js";
import { sampleTargets } from "../planVsActual/engine/targets.js";
import { monthLabel } from "../planVsActual/engine/fiscal.js";
import { money, pct, pts, tone } from "../planVsActual/format.js";
import { countries as COUNTRY_LIST } from "../../data/orgHierarchy.js";
import { utilizationHistory } from "./engine.js";
import { exportSheets, FMT, stamp } from "./exportXlsx.js";

const COUNTRY_NAME = Object.fromEntries(COUNTRY_LIST.map((c) => [c.code, c.name]));

function gapCell(gapPts) {
  if (gapPts == null || !isFinite(gapPts)) return "bg-gray-50 text-gray-400";
  if (gapPts <= -5) return "bg-orange-100 text-orange-900";
  if (gapPts < -2) return "bg-orange-50 text-orange-800";
  if (gapPts < 0) return "bg-amber-50 text-amber-800";
  return "bg-blue-50 text-blue-800";
}

export default function UtilizationHistoryTab({ onExportReady }) {
  const { costData, employeeMap, periods, currentUser } = useApp();
  const [uploads] = usePersistedState("burdenai_pva_uploads", {});
  const [storedTargets] = usePersistedState("burdenai_pva_targets", null);
  const [country, setCountry] = useState("ALL");

  const allowed = currentUser?.allowedCountries || [];
  const inScope = (c) => allowed.includes("*") || allowed.includes(c);

  const actuals = useMemo(() => buildActuals({ costData, employeeMap }), [costData, employeeMap]);
  const targets = useMemo(() => storedTargets || sampleTargets(dedupeCc(actuals)), [storedTargets, actuals]);
  const history = useMemo(
    () => utilizationHistory({ actuals, periods, targets, uploads, inScope }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actuals, periods, targets, uploads, allowed.join(",")],
  );

  const countries = useMemo(() => {
    const set = new Set();
    for (const y of history) for (const c of y.byCountry.keys()) set.add(c);
    return [...set].sort((a, b) => (COUNTRY_NAME[a] || a).localeCompare(COUNTRY_NAME[b] || b));
  }, [history]);

  const yearLabel = (y) => `FY${y.fy}${y.partial ? " YTD" : ""}`;
  const pick = (y) => (country === "ALL" ? y.total : y.byCountry.get(country));

  const chartData = history.map((y) => {
    const s = pick(y);
    return s ? {
      label: yearLabel(y),
      actual: Number((s.actualUtil * 100).toFixed(1)),
      plan: Number((s.planUtil * 100).toFixed(1)),
      target: Number((s.targetUtil * 100).toFixed(1)),
      absorption: Math.round(s.absorption),
    } : { label: yearLabel(y) };
  });

  // Export
  useEffect(() => {
    onExportReady?.(() => {
      const util = [["Country", ...history.map(yearLabel)]];
      const gap = [["Country", ...history.map(yearLabel)]];
      const abs = [["Country", ...history.map(yearLabel)]];
      const rowsFor = (name, get) => {
        util.push([name, ...history.map((y) => get(y)?.actualUtil ?? null)]);
        gap.push([name, ...history.map((y) => (get(y) ? Math.round(get(y).gapToTargetPts * 10) / 10 : null))]);
        abs.push([name, ...history.map((y) => get(y)?.absorption ?? null)]);
      };
      for (const c of countries) rowsFor(COUNTRY_NAME[c] || c, (y) => y.byCountry.get(c));
      rowsFor("Total", (y) => y.total);
      const pctFmt = Object.fromEntries(history.map((_, i) => [i + 1, FMT.pct]));
      const usdFmt = Object.fromEntries(history.map((_, i) => [i + 1, FMT.usd]));
      const oneFmt = Object.fromEntries(history.map((_, i) => [i + 1, FMT.one]));
      const notes = [["Burden AI — Utilization & Absorption by fiscal year"], [],
        ["Plan", "Sample plan for each year (prior-year actuals, planned headcount changes, 3% inflation), plus any uploaded plan for that year"],
        ["Targets", storedTargets ? storedTargets.source || "Edited" : "Sample targets"],
        ["Open year", history.filter((y) => y.partial).map((y) => `FY${y.fy} through ${monthLabel(y.months[y.months.length - 1])}`).join(", ") || "none"],
        ["Absorption", "actual productive hours × plan rate − actual burden cost (positive = over-absorbed), USD"]];
      exportSheets(`burdenai-utilization-history-${stamp()}.xlsx`, [
        { name: "Utilization actual", rows: util, formats: pctFmt, widths: [22, ...history.map(() => 14)] },
        { name: "Gap to target (pts)", rows: gap, formats: oneFmt, widths: [22, ...history.map(() => 14)] },
        { name: "Absorption (USD)", rows: abs, formats: usdFmt, widths: [22, ...history.map(() => 14)] },
        { name: "Notes", rows: notes, widths: [14, 110] },
      ]);
      return "Utilization & Absorption";
    });
  }, [history, countries, storedTargets, onExportReady]);

  const latest = history[history.length - 1];
  const prior = history[history.length - 2];
  const ls = latest && pick(latest);
  const ps = prior && pick(prior);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-wrap items-end justify-between gap-4">
        <div className="text-sm text-gray-600 max-w-3xl">
          Utilization (productive ÷ available hours) and over/under absorption for every fiscal year, against the
          sample plan for that year and your saved targets. The open year is year to date.
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Country
          <select value={country} onChange={(e) => setCountry(e.target.value)}
            className="px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900 border border-gray-300 rounded-lg bg-white min-w-[180px]">
            <option value="ALL">All countries</option>
            {countries.map((c) => <option key={c} value={c}>{COUNTRY_NAME[c] || c}</option>)}
          </select>
        </label>
      </div>

      {ls && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600">Utilization · {yearLabel(latest)}</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{pct(ls.actualUtil)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {ps ? `${pts((ls.actualUtil - ps.actualUtil) * 100)} vs ${yearLabel(prior)}` : ""} · target {pct(ls.targetUtil)}
            </div>
          </div>
          <div className="bg-white p-5 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600">Absorption · {yearLabel(latest)}</div>
            <div className={`text-3xl font-bold mt-1 ${tone(ls.absorption >= 0)}`}>{money(ls.absorption, undefined, { signed: true })}</div>
            <div className="text-xs text-gray-500 mt-1">{(ls.absorptionPct * 100).toFixed(1)}% of plan burden cost</div>
          </div>
          <div className="bg-white p-5 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600">Years below target</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">
              {history.filter((y) => (pick(y)?.gapToTargetPts ?? 0) < 0).length} of {history.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">{country === "ALL" ? "All countries" : COUNTRY_NAME[country]}</div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Utilization and absorption by fiscal year</h2>
        <p className="text-xs text-gray-500 mt-1">Bars: over/under absorption (left axis). Lines: utilization actual, plan and target (right axis).</p>
        <div className="h-80 mt-4" role="img" aria-label="Utilization and absorption by fiscal year">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="abs" stroke="#9ca3af" tick={{ fontSize: 12 }} tickFormatter={(v) => money(v, undefined, { decimals: 1 })} width={70} />
              <YAxis yAxisId="util" orientation="right" stroke="#9ca3af" tick={{ fontSize: 12 }} domain={["dataMin - 3", "dataMax + 3"]} tickFormatter={(v) => `${Math.round(v)}%`} width={44} />
              <ReferenceLine yAxisId="abs" y={0} stroke="#9ca3af" />
              <Tooltip formatter={(v, n) => (n === "Absorption" ? [money(v, undefined, { signed: true }), n] : [`${v}%`, n])} itemStyle={{ color: "#111827" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: "#374151" }}>{v}</span>} />
              <Bar yAxisId="abs" dataKey="absorption" name="Absorption" fill="#fdba74" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Line yAxisId="util" dataKey="actual" name="Utilization actual" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} isAnimationActive={false} />
              <Line yAxisId="util" dataKey="plan" name="Plan" stroke="#7c3aed" strokeDasharray="8 6" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line yAxisId="util" dataKey="target" name="Target" stroke="#6b7280" strokeDasharray="2 5" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">By country and year</h2>
        <p className="text-xs text-gray-500 mt-1">Each cell: actual utilization, gap to target, and absorption. Orange = below target, blue = at or above.</p>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 bg-gray-50">
                <th className="text-left px-3 py-2.5 rounded-l-lg">Country</th>
                {history.map((y) => <th key={y.fy} className="text-center px-3 py-2.5">{yearLabel(y)}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...countries.map((c) => ({ key: c, name: COUNTRY_NAME[c] || c, get: (y) => y.byCountry.get(c) })),
                { key: "TOTAL", name: "Total", get: (y) => y.total }].map((row) => (
                <tr key={row.key} className={`border-t border-gray-100 ${row.key === "TOTAL" ? "font-semibold" : ""}`}>
                  <td className="px-3 py-2 text-gray-900">{row.name}</td>
                  {history.map((y) => {
                    const s = row.get(y);
                    return (
                      <td key={y.fy} className="px-2 py-1.5">
                        {s ? (
                          <div className={`rounded-md px-2 py-1.5 text-center ${gapCell(s.gapToTargetPts)}`}>
                            <div className="font-semibold">{pct(s.actualUtil)}</div>
                            <div className="text-[11px]">{pts(s.gapToTargetPts)} · {money(s.absorption, undefined, { signed: true })}</div>
                          </div>
                        ) : <div className="text-center text-gray-300">—</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Plan for each year: prior-year actuals with planned headcount changes and 3% inflation, plus any uploaded plan for that year
          (saved Forecast snapshots apply to one year and are shown on the Plan vs Actual page). Amounts in USD.
        </p>
      </div>
    </div>
  );
}

function dedupeCc(actuals) {
  const seen = new Map();
  for (const a of actuals) if (!seen.has(a.costCenterId)) seen.set(a.costCenterId, a);
  return [...seen.values()];
}
