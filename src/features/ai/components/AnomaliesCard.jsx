// AnomaliesCard.jsx — "Unusual this month" on the Dashboard.
import React, { useState } from "react";
import { Radar } from "lucide-react";
import { SparkIcon } from "./Drawer.jsx";
import { monthLabel } from "../../planVsActual/engine/fiscal.js";
import { money, rate } from "../../planVsActual/format.js";
import { DEFAULT_CUTOFF } from "../engine/anomalies.js";

const fmt = (a, v) => (a.kind === "pct" ? `${v.toFixed(1)}%` : a.measure === "rate" ? rate(v) : money(v));

export function anomalySentence(a, countryName) {
  const dir = a.direction === "up" ? "higher" : "lower";
  return `${a.measureLabel} at ${a.departmentName}, ${countryName(a.countryCode)} (${a.costCenterId}) was ${fmt(a, a.value)} in ${monthLabel(a.period)}, ${dir} than the ${fmt(a, a.expected)} expected from its own history (${fmt(a, a.lastYear)} a year earlier).`;
}

export default function AnomaliesCard({ anomalies, period, cutoff = DEFAULT_CUTOFF, countryName, onExplain }) {
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? anomalies : anomalies.slice(0, 6);
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex w-10 h-10 rounded-lg bg-slate-900 items-center justify-center"><Radar size={20} className="text-amber-400" /></span>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Unusual this month</h2>
            <p className="text-xs text-gray-500">{monthLabel(period)} · spotted by statistics, no thresholds to set</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1">
          {anomalies.length} {anomalies.length === 1 ? "cost center measure" : "cost center measures"} flagged
        </span>
      </div>

      {anomalies.length === 0 ? (
        <p className="mt-5 text-sm text-gray-600">Nothing unusual — every cost center is within its normal range this month.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {list.map((a) => {
            const sentence = anomalySentence(a, countryName);
            return (
              <li key={`${a.costCenterId}-${a.measure}`} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${a.unfavourable ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"}`}>
                      {a.unfavourable ? "Unfavourable" : "Favourable"}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {a.measureLabel} {a.direction === "up" ? "higher" : "lower"} than normal
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{a.departmentName} · {countryName(a.countryCode)} · {a.costCenterId}</p>
                  <p className="text-sm text-gray-700 mt-2">
                    <span className="font-semibold tabular-nums">{fmt(a, a.value)}</span> vs about <span className="tabular-nums">{fmt(a, a.expected)}</span> expected
                    <span className="text-gray-500"> · {fmt(a, a.lastYear)} a year ago</span>
                  </p>
                </div>
                {onExplain && (
                  <button type="button" onClick={() => onExplain(a, sentence)} aria-label={`Explain ${a.departmentName} ${a.countryCode} ${a.measureLabel}`}
                    className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-800 bg-amber-50 hover:bg-amber-100 border border-amber-200">
                    <SparkIcon size={11} className="text-amber-500" /> Explain
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {anomalies.length > 6 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-3 text-sm font-semibold text-slate-700 hover:text-slate-950">
          {showAll ? "Show fewer" : `Show all ${anomalies.length}`}
        </button>
      )}
      <p className="mt-4 text-xs text-gray-500 leading-relaxed">
        How it works: each cost center’s burden rate, cost per FTE and utilization are compared with its own last 12 months and the same
        month last year. A month is flagged when it sits well outside that cost center’s normal range (a robust z-score of {cutoff} or more).
        Seasonal changes such as the January pay rise are expected, not flagged. Runs inside the app — no outside service.
      </p>
    </section>
  );
}
