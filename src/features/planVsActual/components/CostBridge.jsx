// CostBridge.jsx — Plan cost → volume effect → rate effect → Actual cost,
// as a left-to-right card flow (same style as the Forecast bridge).

import React from "react";
import { ArrowRight } from "lucide-react";
import { money, rate, tone } from "../format.js";

function Anchor({ label, value, sub, cur, dark }) {
  return (
    <div className={`flex-1 min-w-[150px] rounded-lg p-4 text-center ${dark ? "bg-slate-800 text-white" : "bg-indigo-600 text-white"}`}>
      <div className="text-xs font-medium uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-xl font-bold mt-1">{money(value, cur)}</div>
      <div className="text-xs opacity-80 mt-1">{sub}</div>
    </div>
  );
}

function Step({ label, value, explain, cur }) {
  const addsCost = value > 0;
  return (
    <div className="flex-1 min-w-[170px] rounded-lg p-4 border border-gray-200 bg-white">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`text-xl font-bold mt-1 ${tone(!addsCost)}`}>{money(value, cur, { signed: true })}</div>
      <div className="text-xs text-gray-500 mt-1 leading-snug">{explain}</div>
    </div>
  );
}

const Arrow = () => (
  <div className="flex items-center justify-center text-gray-300 shrink-0 px-0.5" aria-hidden="true">
    <ArrowRight size={18} />
  </div>
);

export default function CostBridge({ s, cur }) {
  const hoursDelta = s.actual.productive - s.plan.productive;
  const rateDelta = s.actualRate - s.planRate;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Plan cost → Actual cost</h3>
          <p className="text-xs text-gray-500 mt-1">
            Volume = (actual − plan hours) × plan rate · Rate = (actual − plan rate) × actual hours
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Cost variance</div>
          <div className={`text-lg font-bold ${tone(s.costVariance <= 0)}`}>{money(s.costVariance, cur, { signed: true })}</div>
        </div>
      </div>
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        <Anchor label="Plan cost" value={s.plan.cost} sub={`at ${rate(s.planRate, cur)}`} cur={cur} dark />
        <Arrow />
        <Step
          label="Volume effect"
          value={s.volume}
          cur={cur}
          explain={`${hoursDelta >= 0 ? "+" : "−"}${Math.abs(Math.round(hoursDelta)).toLocaleString()} productive hours vs plan`}
        />
        <Arrow />
        <Step
          label="Rate effect"
          value={s.rateEffect}
          cur={cur}
          explain={`Actual rate ${rate(s.actualRate, cur)} (${rateDelta >= 0 ? "+" : "−"}${rate(Math.abs(rateDelta), cur)} vs plan)`}
        />
        <Arrow />
        <Anchor label="Actual cost" value={s.actual.cost} sub={`at ${rate(s.actualRate, cur)}`} cur={cur} />
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-600" />Adds to cost</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />Reduces cost</span>
      </div>
    </div>
  );
}
