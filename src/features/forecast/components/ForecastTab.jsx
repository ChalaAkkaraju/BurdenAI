// ForecastTab.jsx
// Top-level forecast view. Owns the baseline, drivers, and renders the panels.

import React from "react";
import { DollarSign, TrendingUp, Users, Calendar } from "lucide-react";
import DriversPanel from "./DriversPanel.jsx";
import WaterfallChart from "./WaterfallChart.jsx";
import { useForecast } from "../hooks/useForecast.js";

// MVP baseline — wire to AppContext / current-period data in next iteration.
// Numbers match the existing dashboard snapshot for consistency.
const BASELINE = {
  totalBurden: 6_400_000,
  headcount: 456,
  productiveHours: 83_000,
};

const FORECAST_YEAR = 2027;

const formatUSD = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
};

const formatRate = (n) => `$${n.toFixed(2)}/hr`;
const formatNumber = (n) => n.toLocaleString();

function KPICard({ title, baseline, forecast, formatter, icon: Icon, color }) {
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
            from {formatter(baseline)} ({FORECAST_YEAR - 1} actual)
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
  const { drivers, updateDriver, resetDrivers, result } = useForecast(BASELINE);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
            <Calendar size={12} />
            Forecast · {FORECAST_YEAR}
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Forecasted burden cost
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Project next-year burden based on inflation, productivity gains, and
            AOP volume.
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Forecasted total burden"
          baseline={BASELINE.totalBurden}
          forecast={result.forecastedTotal}
          formatter={formatUSD}
          icon={DollarSign}
          color="bg-blue-500"
        />
        <KPICard
          title="Forecasted burden rate"
          baseline={BASELINE.totalBurden / BASELINE.productiveHours}
          forecast={result.forecastedRate}
          formatter={formatRate}
          icon={TrendingUp}
          color="bg-amber-500"
        />
        <KPICard
          title="Forecasted headcount"
          baseline={BASELINE.headcount}
          forecast={result.forecastedHeadcount}
          formatter={formatNumber}
          icon={Users}
          color="bg-emerald-500"
        />
      </div>

      {/* Drivers + waterfall */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <DriversPanel
            drivers={drivers}
            onChange={updateDriver}
            onReset={resetDrivers}
          />
        </div>
        <div className="lg:col-span-2">
          <WaterfallChart waterfall={result.waterfall} />
        </div>
      </div>

      {/* Footnote */}
      <p className="text-xs text-gray-400 italic">
        MVP forecast — single-year, blended drivers, baseline pinned to{" "}
        {(BASELINE.totalBurden / 1_000_000).toFixed(1)}M reference period.
        Per-country drivers, multi-year compounding, and AOP file ingest are
        next.
      </p>
    </div>
  );
}
