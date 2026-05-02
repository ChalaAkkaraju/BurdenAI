// ForecastTab.jsx
// Top-level forecast view. Pulls baseline from AppContext (current period
// kpis), manages multiple scenarios, and renders the panels.

import React, { useMemo } from "react";
import { DollarSign, TrendingUp, Users, Calendar, AlertCircle } from "lucide-react";
import DriversPanel from "./DriversPanel.jsx";
import WaterfallChart from "./WaterfallChart.jsx";
import ScenarioTabs from "./ScenarioTabs.jsx";
import ScenarioComparison from "./ScenarioComparison.jsx";
import { useScenarios } from "../hooks/useScenarios.js";
import { useApp } from "../../../context/AppContext.jsx";

const FALLBACK_BASELINE = {
  totalBurden: 6_400_000,
  headcount: 456,
  productiveHours: 83_000,
};

const formatUSD = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
};

const formatRate = (n) => `$${n.toFixed(2)}/hr`;
const formatNumber = (n) => n.toLocaleString();

function parsePeriod(period) {
  if (!period || typeof period !== "string") return { year: null, monthName: "" };
  const [y, m] = period.split("-");
  const year = parseInt(y, 10);
  const monthIdx = parseInt(m, 10) - 1;
  const months = ["January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"];
  return { year, monthName: months[monthIdx] || "" };
}

function KPICard({ title, baseline, forecast, formatter, icon: Icon, color, baselineLabel }) {
  const delta = forecast - baseline;
  const pct = baseline === 0 ? 0 : (delta / baseline) * 100;
  const isUp = delta >= 0;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-gray-600 font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {formatter(forecast)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            from {formatter(baseline)} ({baselineLabel})
          </p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <span
          className={`text-sm font-medium ${
            isUp ? "text-red-600" : "text-emerald-600"
          }`}
        >
          {isUp ? "+" : ""}
          {pct.toFixed(1)}% vs current
        </span>
      </div>
    </div>
  );
}

export default function ForecastTab() {
  const { kpis, selectedPeriod } = useApp();

  const { baseline, isFromContext } = useMemo(() => {
    if (kpis && kpis.totalCTC > 0 && kpis.totalHours > 0) {
      return {
        baseline: {
          totalBurden: kpis.totalCTC,
          headcount: kpis.activeEmployees,
          productiveHours: kpis.totalHours,
        },
        isFromContext: true,
      };
    }
    return { baseline: FALLBACK_BASELINE, isFromContext: false };
  }, [kpis]);

  const {
    scenarios,
    activeId,
    setActiveId,
    active,
    updateDriver,
    resetScenario,
    resetAllScenarios,
  } = useScenarios(baseline);

  const { year: baselineYear, monthName } = parsePeriod(selectedPeriod);
  const forecastYear = (baselineYear || 2026) + 1;
  const baselineLabel = isFromContext
    ? `${monthName} ${baselineYear} actual`
    : "reference period";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
            <Calendar size={12} />
            Forecast · {forecastYear}
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Forecasted burden cost
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Compare scenarios and see how each driver mix shapes next-year
            burden from {baselineLabel}.
          </p>
        </div>
        {!isFromContext && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
            <AlertCircle size={14} />
            Using fallback baseline — no data in current period
          </div>
        )}
      </div>

      {/* Scenario tabs */}
      <ScenarioTabs
        scenarios={scenarios}
        activeId={activeId}
        onSelect={setActiveId}
        onResetAll={resetAllScenarios}
      />

      {/* Active scenario header strip */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
            Editing
          </span>
          <span className="ml-2 text-base font-bold text-gray-900">{active.name}</span>
          <span className="ml-2 text-sm text-gray-600">— {active.description}</span>
        </div>
      </div>

      {/* KPI row (active scenario) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Forecasted total burden"
          baseline={baseline.totalBurden}
          forecast={active.result.forecastedTotal}
          formatter={formatUSD}
          icon={DollarSign}
          color="bg-blue-500"
          baselineLabel={baselineLabel}
        />
        <KPICard
          title="Forecasted burden rate"
          baseline={baseline.totalBurden / baseline.productiveHours}
          forecast={active.result.forecastedRate}
          formatter={formatRate}
          icon={TrendingUp}
          color="bg-amber-500"
          baselineLabel={baselineLabel}
        />
        <KPICard
          title="Forecasted headcount"
          baseline={baseline.headcount}
          forecast={active.result.forecastedHeadcount}
          formatter={formatNumber}
          icon={Users}
          color="bg-emerald-500"
          baselineLabel={baselineLabel}
        />
      </div>

      {/* Drivers + waterfall (active scenario) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <DriversPanel
            drivers={active.drivers}
            onChange={(key, value) => updateDriver(active.id, key, value)}
            onReset={() => resetScenario(active.id)}
          />
        </div>
        <div className="lg:col-span-2">
          <WaterfallChart waterfall={active.result.waterfall} />
        </div>
      </div>

      {/* Comparison table (all scenarios) */}
      <ScenarioComparison
        scenarios={scenarios}
        baseline={baseline}
        activeId={activeId}
      />

      {/* Footnote */}
      <p className="text-xs text-gray-400 italic">
        MVP forecast — scenarios persist locally per browser. Per-country
        drivers, multi-year compounding, and AOP file ingest are next.
      </p>
    </div>
  );
}
