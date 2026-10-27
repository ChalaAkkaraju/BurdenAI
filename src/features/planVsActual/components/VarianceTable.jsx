// VarianceTable.jsx — country rows that open to their cost centers.

import React, { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { money, pct, pts, num, tone } from "../format.js";

const GRID =
  "grid grid-cols-[minmax(190px,2fr)_104px_minmax(86px,1fr)_repeat(4,minmax(58px,0.8fr))_repeat(3,minmax(80px,1fr))_64px] gap-2 items-center";

function Cells({ s, cur }) {
  return (
    <>
      <span className="text-right tabular-nums whitespace-nowrap">{num(s.plan.fte, 1)} → {num(s.actual.fte, 1)}</span>
      <span className="text-right tabular-nums">{pct(s.planUtil)}</span>
      <span className="text-right tabular-nums font-semibold">{pct(s.actualUtil)}</span>
      <span className="text-right tabular-nums text-gray-600">{pct(s.targetUtil, 0)}</span>
      <span className={`text-right tabular-nums font-semibold ${tone(s.gapToTargetPts >= 0)}`}>{pts(s.gapToTargetPts)}</span>
      <span className="text-right tabular-nums">{money(s.volume, cur, { signed: true })}</span>
      <span className="text-right tabular-nums">{money(s.rateEffect, cur, { signed: true })}</span>
      <span className={`text-right tabular-nums font-semibold ${tone(s.absorption >= 0)}`}>{money(s.absorption, cur, { signed: true })}</span>
    </>
  );
}

const SOURCE_STYLE = {
  Uploaded: "bg-blue-100 text-blue-800",
  "From snapshot": "bg-gray-100 text-gray-700",
  "Sample plan": "bg-violet-50 text-violet-800",
  Mixed: "bg-amber-50 text-amber-800",
  "No plan": "bg-red-50 text-red-700",
};

export default function VarianceTable({ countries, total, totalCur, flagRules, onFlagGapChange, defaultOpen }) {
  const [open, setOpen] = useState(() => new Set(defaultOpen ? [defaultOpen] : []));
  const toggle = (code) =>
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });
  const flagged = countries.reduce((a, c) => a + c.flagCount, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Variance by country and cost center</h3>
          <p className="text-xs text-gray-500 mt-1">
            Click a country to see its cost centers. Each department has one cost center. All amounts in USD unless the currency is set to Local.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
          <label className="inline-flex items-center gap-2">
            Review when below target by
            <input
              type="number"
              min={1}
              max={20}
              value={flagRules.gapPts}
              onChange={(e) => onFlagGapChange(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm"
            />
            pts, or absorption beyond ±{Math.round(flagRules.absorptionPct * 100)}%
          </label>
          <span className="inline-flex items-center gap-1.5 font-semibold text-orange-800">
            <AlertTriangle size={14} /> {flagged} to review
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[980px] text-sm">
          <div className={`${GRID} px-3 py-2.5 bg-gray-50 rounded-lg text-[11px] font-semibold uppercase tracking-wider text-gray-500`}>
            <span>Country / cost center</span>
            <span>Plan source</span>
            <span className="text-right">FTE P → A</span>
            <span className="text-right">Util plan</span>
            <span className="text-right">Util act.</span>
            <span className="text-right">Target</span>
            <span className="text-right">Vs target</span>
            <span className="text-right">Volume</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Absorption</span>
            <span className="text-center">Flag</span>
          </div>

          {countries.map((c) => {
            const isOpen = open.has(c.code);
            return (
              <div key={c.code} className="border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => toggle(c.code)}
                  aria-expanded={isOpen}
                  className={`${GRID} w-full px-3 py-3 text-left hover:bg-gray-50`}
                >
                  <span className="flex items-start gap-2 text-gray-900">
                    {isOpen ? <ChevronDown size={16} className="text-gray-500 mt-0.5 shrink-0" /> : <ChevronRight size={16} className="text-gray-500 mt-0.5 shrink-0" />}
                    <span>
                      <span className="block font-semibold">{c.name}</span>
                      <span className="block text-xs text-gray-500">{c.ccs.length} cost centers{c.cur.code !== "USD" ? ` · ${c.cur.code}` : ""}</span>
                    </span>
                  </span>
                  <span className="text-xs text-gray-600">{c.sourceSummary}</span>
                  <Cells s={c.s} cur={c.cur} />
                  <span className="text-center">
                    {c.flagCount > 0 && (
                      <span title={`${c.flagCount} cost centers to review`} className="text-[11px] font-semibold text-orange-800 bg-orange-100 px-2 py-0.5 rounded-full">{c.flagCount}</span>
                    )}
                  </span>
                </button>
                {isOpen &&
                  c.ccs.map((r) => (
                    <div key={r.id} className={`${GRID} px-3 py-2.5 bg-gray-50/60 border-t border-gray-100`}>
                      <span className="pl-6">
                        <span className="block text-gray-900">{r.departmentName}</span>
                        <span className="block text-xs text-gray-500">{r.id} · {r.vertical}</span>
                      </span>
                      <span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${SOURCE_STYLE[r.source] || SOURCE_STYLE.Mixed}`}>{r.source}</span>
                      </span>
                      <Cells s={r.s} cur={c.cur} />
                      <span className="text-center">
                        {r.flag && <span className="text-[11px] font-semibold text-orange-800 bg-orange-100 px-2 py-0.5 rounded-full">Review</span>}
                      </span>
                    </div>
                  ))}
              </div>
            );
          })}

          {total && (
            <div className={`${GRID} px-3 py-3 font-bold text-gray-900`}>
              <span>Total{totalCur.code !== "USD" ? ` (${totalCur.code})` : ""}</span>
              <span />
              <Cells s={total} cur={totalCur} />
              <span />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
