// HomeDashboard.jsx
// One view across the three modules: Burden Cost, Forecast, and Utilization
// (Plan vs Actual). Each card links to its module and only shows when the
// user has access to it. Numbers come from the same calculations the module
// pages use, so they always match.

import React, { useMemo } from 'react';
import {
  Coins, TrendingUp, Target, ArrowRight, AlertTriangle, LayoutDashboard,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { usePersistedState } from '../../features/forecast/hooks/usePersistedState.js';
import { useScenarios } from '../../features/forecast/hooks/useScenarios.js';
import { useSnapshots } from '../../features/forecast/hooks/useSnapshots.js';
import { usePlanVsActualSummary } from '../../features/planVsActual/hooks/usePlanVsActualSummary.js';
import { monthLabel } from '../../features/planVsActual/engine/fiscal.js';
import { money, pct, pts, rate, tone } from '../../features/planVsActual/format.js';
import { countries as COUNTRY_LIST } from '../../data/orgHierarchy.js';
import { useAi } from '../../features/ai/AiContext';
import { SparkIcon } from '../../features/ai/components/Drawer';
import { useAnomalies } from '../../features/ai/hooks/useAiData';
import { summarize } from '../../features/planVsActual/engine/variance.js';
import AnomaliesCard from '../../features/ai/components/AnomaliesCard';

const COUNTRY_NAME = Object.fromEntries(COUNTRY_LIST.map((c) => [c.code, c.name]));

const ACCENTS = {
  slate: { bar: 'bg-slate-400', tile: 'bg-slate-900', title: 'text-slate-900', link: 'text-slate-700 hover:text-slate-950' },
  violet: { bar: 'bg-violet-300', tile: 'bg-violet-600', title: 'text-violet-700', link: 'text-violet-700 hover:text-violet-900' },
  amber: { bar: 'bg-amber-300', tile: 'bg-amber-600', title: 'text-amber-700', link: 'text-amber-700 hover:text-amber-900' },
};

function ModuleCard({ accent, icon: Icon, name, context, onOpen, openLabel, children }) {
  const a = ACCENTS[accent];
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
      <div className={`h-1.5 ${a.bar}`} />
      <div className="p-6 flex flex-col gap-4 flex-1">
        <div className="flex items-center gap-3">
          <span className={`inline-flex w-10 h-10 rounded-lg ${a.tile} items-center justify-center`}>
            <Icon size={20} className="text-white" />
          </span>
          <div>
            <h2 className={`text-lg font-bold ${a.title}`}>{name}</h2>
            <p className="text-xs text-gray-500">{context}</p>
          </div>
        </div>
        <div className="flex-1">{children}</div>
        {onOpen && (
          <button type="button" onClick={onOpen} className={`self-start inline-flex items-center gap-1.5 text-sm font-semibold ${a.link}`}>
            {openLabel} <ArrowRight size={15} />
          </button>
        )}
      </div>
    </section>
  );
}

function Figure({ label, value, valueClass = 'text-gray-900', sub, subClass = 'text-gray-500', big }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className={`${big ? 'text-2xl 2xl:text-3xl' : 'text-xl'} font-bold whitespace-nowrap ${valueClass}`}>{value}</div>
      {sub && <div className={`text-xs mt-0.5 ${subClass}`}>{sub}</div>}
    </div>
  );
}

const FALLBACK_BASELINE = { totalBurden: 6_400_000, headcount: 456, productiveHours: 83_000 };

export default function HomeDashboard({ onNavigate }) {
  const {
    kpis, periodData, selectedPeriod, summaryByCountry, costData, employeeMap, periods, currentUser, hasAccess,
  } = useApp();

  // ---- Burden Cost -----------------------------------------------------------
  const last12 = useMemo(() => {
    const idx = periodData.findIndex((p) => p.period === selectedPeriod);
    const end = idx >= 0 ? idx + 1 : periodData.length;
    return periodData.slice(Math.max(0, end - 12), end).map((p) => ({ period: p.period, cost: p.totalCostToCompany, rate: p.avgBurdenRate }));
  }, [periodData, selectedPeriod]);
  const yearAgo = useMemo(() => {
    const [y, m] = String(selectedPeriod).split('-');
    const target = `${Number(y) - 1}-${m}`;
    const p = periodData.find((x) => x.period === target);
    return p ? { period: target, cost: p.totalCostToCompany } : null;
  }, [periodData, selectedPeriod]);
  const costChangeYoY = yearAgo && yearAgo.cost > 0 ? (kpis.totalCTC - yearAgo.cost) / yearAgo.cost : null;

  // ---- Forecast (same inputs as the Forecast page) ---------------------------------
  const baseline = useMemo(
    () => (kpis && kpis.totalCTC > 0 && kpis.totalHours > 0
      ? { totalBurden: kpis.totalCTC, headcount: kpis.activeEmployees, productiveHours: kpis.totalHours }
      : FALLBACK_BASELINE),
    [kpis],
  );
  const countryBaselines = useMemo(
    () => (summaryByCountry || []).filter((c) => c.totalCostToCompany > 0).map((c) => ({
      countryCode: c.key, label: c.label, totalBurden: c.totalCostToCompany, headcount: c.employeeCount, productiveHours: c.totalHours,
    })),
    [summaryByCountry],
  );
  const [horizonYears] = usePersistedState('burdenai_forecast_horizon_years', 1);
  const [manualOverrides] = usePersistedState('burdenai_forecast_manual_overrides', {});
  const { scenarios } = useScenarios(baseline, horizonYears, countryBaselines, manualOverrides);
  const { snapshots } = useSnapshots();
  const base = scenarios[0];
  const fcTotals = scenarios.map((s) => s.result.forecastedTotal);
  const fcChange = base && baseline.totalBurden ? base.result.forecastedTotal / baseline.totalBurden - 1 : 0;
  const baseRate = baseline.totalBurden / baseline.productiveHours;
  const latestSnap = (snapshots || [])[0];

  // ---- Utilization (Plan vs Actual) ---------------------------------------------------
  const pva = usePlanVsActualSummary({ costData, employeeMap, periods, allowedCountries: currentUser?.allowedCountries });
  const pvaChart = useMemo(
    () => (pva ? pva.monthly.map((m) => ({
      label: monthLabel(m.period, false),
      plan: Math.round(m.s.plan.cost),
      actual: m.inYtd ? Math.round(m.s.actual.cost) : null,
      utilization: m.inYtd ? Number((m.s.actualUtil * 100).toFixed(1)) : null,
    })) : []),
    [pva],
  );

  const ai = useAi();
  const latestPeriod = periods[periods.length - 1];
  const anomalies = useAnomalies(latestPeriod, ai.settings?.anomalyCutoff);
  const ytdLabel = pva ? `FY${pva.fy} year to date (${monthLabel(pva.months[0])} – ${monthLabel(pva.through)})` : '';
  const explainCc = (c) => ai.explain({
    name: c.departmentName,
    scope: `${COUNTRY_NAME[c.countryCode] || c.countryCode} · ${c.id}`,
    periodLabel: ytdLabel,
    s: c.s,
  });
  const explainAnomaly = (a, sentence) => {
    const lines = (pva?.lines || []).filter((l) => l.costCenterId === a.costCenterId && l.period === a.period);
    if (!lines.length) return;
    ai.explain({
      name: a.departmentName,
      scope: `${COUNTRY_NAME[a.countryCode] || a.countryCode} · ${a.costCenterId}`,
      periodLabel: monthLabel(a.period),
      s: summarize(lines),
      extraFacts: [`Unusual this month: ${sentence}`],
    });
  };

  const can = (id) => hasAccess(id);
  const go = (id) => () => onNavigate && onNavigate(id);
  const showFc = can('forecast');
  const showPva = can('planvsactual') && pva;
  const cols = 1 + (showFc ? 1 : 0) + (showPva ? 1 : 0);

  return (
    <div className="p-8 bg-gray-50 min-h-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            <LayoutDashboard size={14} /> Overview
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm">Burden cost, where it is heading, and how well the hours were used — in one view.</p>
        </div>
        <div className="flex items-center gap-3 bg-white border border-blue-200 rounded-xl px-5 py-3 shadow-sm">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Current period</p>
            <p className="text-lg font-bold text-blue-700">{selectedPeriod}</p>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${cols === 3 ? 'xl:grid-cols-3' : cols === 2 ? 'lg:grid-cols-2' : ''}`}>
        {/* Burden Cost */}
        <ModuleCard
          accent="slate" icon={Coins} name="Burden Cost" context={`Period ${selectedPeriod}`}
          onOpen={can('burdencost') ? go('burdencost') : null} openLabel="Open Burden Cost"
        >
          <div className="grid grid-cols-2 gap-4">
            <Figure big label="Total burden cost" value={money(kpis.totalCTC)}
              sub={costChangeYoY != null ? `${costChangeYoY >= 0 ? '+' : '−'}${Math.abs(costChangeYoY * 100).toFixed(1)}% vs ${monthLabel(yearAgo.period)}` : null} />
            <Figure big label="Average burden rate" value={rate(kpis.avgBurdenRate)}
              sub={kpis.burdenRateChange != null ? `${kpis.burdenRateChange >= 0 ? '+' : '−'}$${Math.abs(kpis.burdenRateChange).toFixed(2)} vs prior period` : null}
              subClass={kpis.burdenRateChange != null ? tone(kpis.burdenRateChange <= 0) : undefined} />
            <Figure label="Burden multiplier" value={`${kpis.burdenMultiplier.toFixed(2)}×`} sub="benefits + overhead ÷ direct" />
            <Figure label="Active employees" value={kpis.activeEmployees.toLocaleString()} sub={`${Math.round(kpis.totalHours).toLocaleString()} paid hours`} />
          </div>
          <div className="h-16 mt-4" role="img" aria-label="Total burden cost, last 12 periods">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last12} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <Tooltip formatter={(v) => [money(v), 'Burden cost']} labelFormatter={(l, p) => p?.[0]?.payload?.period || ''} />
                <YAxis hide domain={[(min) => min * 0.97, (max) => max * 1.02]} />
                <Area type="monotone" dataKey="cost" stroke="#334155" fill="#e2e8f0" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500">Last 12 periods</p>
        </ModuleCard>

        {/* Forecast */}
        {showFc && base && (
          <ModuleCard
            accent="violet" icon={TrendingUp} name="Forecast" context={`${base.name} scenario · baseline ${selectedPeriod}`}
            onOpen={go('forecast')} openLabel="Open Forecast"
          >
            <div className="grid grid-cols-2 gap-4">
              <Figure big label="Forecast burden cost" value={money(base.result.forecastedTotal)} valueClass="text-violet-800"
                sub={`${fcChange >= 0 ? '+' : '−'}${Math.abs(fcChange * 100).toFixed(1)}% vs baseline`} />
              <Figure big label="Forecast burden rate" value={rate(base.result.forecastedRate)}
                sub={`from ${rate(baseRate)} today`} />
              <Figure label="Forecast headcount" value={Math.round(base.result.forecastedHeadcount).toLocaleString()} sub={`from ${baseline.headcount.toLocaleString()} today`} />
              <Figure label="Scenario range" value={`${money(Math.min(...fcTotals))} – ${money(Math.max(...fcTotals))}`} sub={`${scenarios.length} scenarios`} />
            </div>
            <div className="mt-4 space-y-1.5">
              {scenarios.map((s) => {
                const max = Math.max(...fcTotals);
                return (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <span className="w-28 truncate text-gray-600">{s.name}</span>
                    <span className="flex-1 h-2 rounded-full bg-violet-50 overflow-hidden">
                      <span className="block h-full bg-violet-500 rounded-full" style={{ width: `${(s.result.forecastedTotal / max) * 100}%` }} />
                    </span>
                    <span className="w-16 text-right font-medium text-gray-800">{money(s.result.forecastedTotal)}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {latestSnap ? `Latest snapshot: ${latestSnap.name} (${new Date(latestSnap.createdAt).toLocaleDateString()})` : 'No snapshot saved yet'}
            </p>
          </ModuleCard>
        )}

        {/* Utilization */}
        {showPva && (
          <ModuleCard
            accent="amber" icon={Target} name="Utilization" context={`Plan vs Actual · FY${pva.fy} to ${monthLabel(pva.through)}`}
            onOpen={go('planvsactual')} openLabel="Open Plan vs Actual"
          >
            <div className="grid grid-cols-2 gap-4">
              <Figure big label="Utilization" value={pct(pva.total.actualUtil)}
                sub={`Plan ${pct(pva.total.planUtil)} · Target ${pct(pva.total.targetUtil)}`} />
              <Figure big label="Over / under absorption" value={money(pva.total.absorption, undefined, { signed: true })}
                valueClass={tone(pva.total.absorption >= 0)}
                sub={pva.total.absorption >= 0 ? 'Over-absorbed' : 'Under-absorbed'} subClass={tone(pva.total.absorption >= 0)} />
              <Figure label="Cost variance" value={money(pva.total.costVariance, undefined, { signed: true })}
                valueClass={tone(pva.total.costVariance <= 0)}
                sub={`Volume ${money(pva.total.volume, undefined, { signed: true })} · Rate ${money(pva.total.rateEffect, undefined, { signed: true })}`} />
              <Figure label="Cost centers to review" value={`${pva.flagged.length} of ${pva.costCenterCount}`}
                valueClass={pva.flagged.length ? 'text-orange-700' : 'text-gray-900'} sub={`${pts(pva.total.gapToTargetPts)} vs target overall`} />
            </div>
            <p className="text-xs text-gray-500 mt-4">Plan: {pva.planName}{pva.uploadName ? ` + ${pva.uploadName}` : ''}</p>
          </ModuleCard>
        )}
      </div>

      {showPva && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <section className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900">Burden cost — plan vs actual, FY{pva.fy}</h2>
            <p className="text-xs text-gray-500 mt-1">Monthly burden cost against the plan, with actual utilization (right axis).</p>
            <div className="h-72 mt-4" role="img" aria-label={`Monthly burden cost plan versus actual for FY${pva.fy}`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pvaChart} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 12 }} tickLine={false} />
                  <YAxis yAxisId="cost" stroke="#9ca3af" tick={{ fontSize: 12 }} tickFormatter={(v) => money(v, undefined, { decimals: 1 })} width={64} />
                  <YAxis yAxisId="util" orientation="right" stroke="#9ca3af" tick={{ fontSize: 12 }} domain={[60, 100]} tickFormatter={(v) => `${v}%`} width={44} />
                  <Tooltip formatter={(v, n) => (n === 'Utilization' ? [`${v}%`, n] : [money(v), n])} itemStyle={{ color: '#111827' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span style={{ color: '#374151' }}>{value}</span>} />
                  <Bar yAxisId="cost" dataKey="plan" name="Plan cost" fill="#c4b5fd" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar yAxisId="cost" dataKey="actual" name="Actual cost" fill="#4f46e5" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Line yAxisId="util" dataKey="utilization" name="Utilization" stroke="#d97706" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-orange-600" />
              <h2 className="text-lg font-bold text-gray-900">Needs attention</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Cost centers more than {pva.rules.gapPts} pts below target or with absorption beyond ±{Math.round(pva.rules.absorptionPct * 100)}%, most under-absorbed first.
            </p>
            {pva.flagged.length === 0 ? (
              <p className="mt-6 text-sm text-gray-600">Nothing to review — every cost center is within its limits.</p>
            ) : (
              <ul className="mt-4 divide-y divide-gray-100 flex-1">
                {pva.flagged.slice(0, 6).map((c) => (
                  <li key={c.id} className="py-2.5 flex items-start justify-between gap-3 text-sm">
                    <span>
                      <span className="block font-medium text-gray-900">{c.departmentName}</span>
                      <span className="block text-xs text-gray-500">{COUNTRY_NAME[c.countryCode] || c.countryCode} · {c.id}</span>
                    </span>
                    <span className="flex items-start gap-2 shrink-0">
                      <span className="text-right">
                        <span className={`block font-semibold ${tone(c.s.absorption >= 0)}`}>{money(c.s.absorption, undefined, { signed: true })}</span>
                        <span className={`block text-xs ${tone(c.s.gapToTargetPts >= 0)}`}>{pts(c.s.gapToTargetPts)} vs target</span>
                      </span>
                      {ai.visible && (
                        <button type="button" onClick={() => explainCc(c)} aria-label={`Explain ${c.departmentName} ${c.countryCode}`} title="Explain this variance"
                          className="mt-0.5 p-1.5 rounded-lg text-slate-800 bg-amber-50 hover:bg-amber-100 border border-amber-200">
                          <SparkIcon size={12} className="text-amber-500" />
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {pva.flagged.length > 6 && (
              <p className="text-xs text-gray-500 mt-2">+{pva.flagged.length - 6} more</p>
            )}
            <button type="button" onClick={go('planvsactual')}
              className="mt-4 self-start inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-900">
              Review in Plan vs Actual <ArrowRight size={15} />
            </button>
          </section>
        </div>
      )}

      <AnomaliesCard
        anomalies={anomalies}
        period={latestPeriod}
        cutoff={ai.settings?.anomalyCutoff}
        countryName={(c) => COUNTRY_NAME[c] || c}
        onExplain={ai.visible && showPva && pva?.lines?.some((l) => l.period === latestPeriod) ? explainAnomaly : null}
      />
    </div>
  );
}
