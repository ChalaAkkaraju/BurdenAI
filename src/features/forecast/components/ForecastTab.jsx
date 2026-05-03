// ForecastTab.jsx
// Top-level forecast view. Pulls baseline from AppContext (current period
// kpis), manages multiple scenarios, and renders the panels.

import React, { useMemo } from "react";
import { DollarSign, TrendingUp, Users, Calendar, AlertCircle, Download, Printer } from "lucide-react";
import DriversPanel from "./DriversPanel.jsx";
import WaterfallChart from "./WaterfallChart.jsx";
import ScenarioTabs from "./ScenarioTabs.jsx";
import ScenarioComparison from "./ScenarioComparison.jsx";
import MultiYearChart from "./MultiYearChart.jsx";
import CountryBreakdown from "./CountryBreakdown.jsx";
import AOPUploader from "./AOPUploader.jsx";
import CountryDriverOverrides from "./CountryDriverOverrides.jsx";
import SensitivityChart from "./SensitivityChart.jsx";
import SnapshotsPanel from "./SnapshotsPanel.jsx";
import { useScenarios } from "../hooks/useScenarios.js";
import { useSnapshots, buildSnapshot } from "../hooks/useSnapshots.js";
import { usePersistedState } from "../hooks/usePersistedState.js";
import { forecastPerCountry } from "../engine/forecastEngine.js";
import { runSensitivity } from "../engine/sensitivityAnalysis.js";
import { buildForecastCsv, buildForecastFilename } from "../engine/forecastExporter.js";
import { useApp } from "../../../context/AppContext.jsx";

const HORIZON_OPTIONS = [
  { value: 1, label: "1 yr" },
  { value: 3, label: "3 yrs" },
  { value: 5, label: "5 yrs" },
];

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
  const { kpis, selectedPeriod, summaryByCountry, currentUser, addAuditEntry } = useApp();

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

  // Persisted user preferences — survive page refresh
  const [horizonYears, setHorizonYears] = usePersistedState("burdenai_forecast_horizon_years", 1);

  // Manual per-country driver overrides (inflation / productivity / FX). Persisted.
  // Shape: { US: { inflationPct: 4 }, IN: { inflationPct: 9, productivityPct: 5 }, ... }
  const [manualOverrides, setManualOverrides] = usePersistedState("burdenai_forecast_manual_overrides", {});

  const {
    scenarios,
    activeId,
    setActiveId,
    active,
    updateDriver,
    setScenarioAop,
    setScenarioNotes,
    resetScenario,
    resetAllScenarios,
  } = useScenarios(baseline, horizonYears);

  // Per-scenario AOP state — read from the active scenario (or null if none attached)
  const aopState = active.aopState || null;

  // Country-level baselines (for the per-country breakdown panel).
  // Falls back to empty if context isn't ready.
  const countryBaselines = useMemo(() => {
    if (!summaryByCountry || summaryByCountry.length === 0) return [];
    return summaryByCountry
      .filter((c) => c.totalCostToCompany > 0)
      .map((c) => ({
        countryCode: c.key,
        label: c.label,
        totalBurden: c.totalCostToCompany,
        headcount: c.employeeCount,
        productiveHours: c.totalHours,
      }));
  }, [summaryByCountry]);

  // Merge AOP (per-country headcount delta) with manual overrides
  // (per-country inflation / productivity). They never conflict by design —
  // AOP supplies aopHeadcountDeltaPct, manual supplies the other two.
  const mergedOverrides = useMemo(() => {
    const merged = {};
    const codes = new Set([
      ...Object.keys(aopState?.overrides || {}),
      ...Object.keys(manualOverrides || {}),
    ]);
    for (const code of codes) {
      merged[code] = {
        ...(manualOverrides?.[code] || {}),
        ...(aopState?.overrides?.[code] || {}),
      };
    }
    return merged;
  }, [aopState, manualOverrides]);

  // Forecast for active scenario, broken down by country.
  // Per-country overrides come from AOP upload + manual override panel.
  const countryForecast = useMemo(() => {
    if (countryBaselines.length === 0) return null;
    return forecastPerCountry({
      countryBaselines,
      drivers: active.drivers,
      countryDriverOverrides: mergedOverrides,
    });
  }, [countryBaselines, active.drivers, mergedOverrides]);

  const manualOverrideCount = Object.values(manualOverrides).reduce(
    (acc, ov) => acc + (ov?.inflationPct != null ? 1 : 0) + (ov?.productivityPct != null ? 1 : 0),
    0
  );

  // Sensitivity analysis on the active scenario — delta persisted as user preference
  const [sensitivityDelta, setSensitivityDelta] = usePersistedState("burdenai_forecast_sensitivity_delta", 2);
  const sensitivity = useMemo(
    () => runSensitivity({ baseline, drivers: active.drivers, deltaPct: sensitivityDelta }),
    [baseline, active.drivers, sensitivityDelta]
  );

  // Snapshots — frozen records of the forecast state
  const { snapshots, addSnapshot, deleteSnapshot } = useSnapshots();
  const handleSaveSnapshot = (name, description) => {
    const snap = buildSnapshot({
      name,
      description,
      baseline,
      baselineLabel,
      forecastYear,
      horizonYears,
      scenarios,
      activeScenarioId: activeId,
      manualOverrides,
      aopState,
      createdBy: currentUser?.name || currentUser?.email || "Anonymous",
    });
    addSnapshot(snap);
    if (addAuditEntry) {
      addAuditEntry({
        action: "Save Forecast Snapshot",
        target: name,
        details: `Frozen ${forecastYear}${horizonYears > 1 ? `–${forecastYear + horizonYears - 1}` : ""} forecast across ${scenarios.length} scenarios`,
        category: "Forecast",
      });
    }
  };

  const handleDeleteSnapshot = (id) => {
    const snap = snapshots.find((s) => s.id === id);
    deleteSnapshot(id);
    if (addAuditEntry && snap) {
      addAuditEntry({
        action: "Delete Forecast Snapshot",
        target: snap.name,
        details: `Removed snapshot saved ${snap.createdAt}`,
        category: "Forecast",
      });
    }
  };

  // Trigger a CSV download of the current forecast state.
  const handleExport = () => {
    const csv = buildForecastCsv({
      scenarios,
      activeScenario: active,
      countryForecast,
      baseline,
      baselineLabel,
      forecastYear,
      horizonYears,
    });
    const filename = buildForecastFilename({
      forecastYear,
      scenarioName: active.name,
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const { year: baselineYear, monthName } = parsePeriod(selectedPeriod);
  const forecastYear = (baselineYear || 2026) + 1;
  const baselineLabel = isFromContext
    ? `${monthName} ${baselineYear} actual`
    : "reference period";

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
            <Calendar size={12} />
            Forecast · {forecastYear}
            {horizonYears > 1 && ` – ${forecastYear + horizonYears - 1}`}
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Forecasted burden cost
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Compare scenarios and see how each driver mix shapes burden across{" "}
            the {horizonYears === 1 ? "next year" : `next ${horizonYears} years`} from {baselineLabel}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isFromContext && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
              <AlertCircle size={14} />
              Using fallback baseline
            </div>
          )}
          {/* Horizon picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Horizon
            </span>
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
              {HORIZON_OPTIONS.map((opt) => {
                const isActive = horizonYears === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setHorizonYears(opt.value)}
                    className={`px-3 py-1.5 text-sm rounded-md transition font-medium ${
                      isActive
                        ? "bg-blue-600 text-white shadow"
                        : "text-gray-700 hover:text-gray-900"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Export button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition"
            title="Export forecast as CSV"
          >
            <Download size={14} />
            Export CSV
          </button>
          {/* Print button — uses browser print dialog with print-specific CSS */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition no-print"
            title="Print or save as PDF — expand any sections you want to include first"
          >
            <Printer size={14} />
            Print
          </button>
        </div>
      </div>

      {/* Scenario tabs */}
      <ScenarioTabs
        scenarios={scenarios}
        activeId={activeId}
        onSelect={setActiveId}
        onResetAll={resetAllScenarios}
      />

      {/* Active scenario header strip + notes */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
              Editing
            </span>
            <span className="ml-2 text-base font-bold text-gray-900">{active.name}</span>
            <span className="ml-2 text-sm text-gray-600">— {active.description}</span>
          </div>
        </div>
        <textarea
          value={active.notes ?? ""}
          onChange={(e) => setScenarioNotes(activeId, e.target.value)}
          placeholder={`Notes for ${active.name} — rationale, board context, key assumptions… (saved with the scenario)`}
          rows={2}
          className="w-full px-3 py-2 text-sm bg-white border border-blue-200 rounded-md text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-y"
        />
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

      {/* Drivers full-width on top, waterfall full-width below */}
      <DriversPanel
        drivers={active.drivers}
        onChange={(key, value) => updateDriver(active.id, key, value)}
        onReset={() => resetScenario(active.id)}
      />
      <WaterfallChart waterfall={active.result.waterfall} />

      {/* Comparison table (all scenarios) */}
      <ScenarioComparison
        scenarios={scenarios}
        baseline={baseline}
        activeId={activeId}
      />

      {/* Sensitivity tornado for the active scenario */}
      <SensitivityChart
        sensitivity={sensitivity}
        deltaPct={sensitivityDelta}
        onDeltaChange={setSensitivityDelta}
      />

      {/* AOP plan upload — attaches to the active scenario */}
      {countryBaselines.length > 0 && (
        <AOPUploader
          countryBaselines={countryBaselines}
          aopState={aopState}
          onAopChange={(newAop) => {
            setScenarioAop(activeId, newAop);
            if (addAuditEntry) {
              if (newAop) {
                addAuditEntry({
                  action: "Upload Forecast AOP",
                  target: active.name,
                  details: `${newAop.rows?.length || 0} countries parsed from ${newAop.fileName}`,
                  category: "Forecast",
                });
              } else if (aopState) {
                addAuditEntry({
                  action: "Clear Forecast AOP",
                  target: active.name,
                  details: `Removed ${aopState.fileName}`,
                  category: "Forecast",
                });
              }
            }
          }}
          activeScenarioName={active.name}
        />
      )}

      {/* Per-country driver overrides (advanced) */}
      {countryBaselines.length > 0 && (
        <CountryDriverOverrides
          countryBaselines={countryBaselines}
          scenarioDrivers={active.drivers}
          manualOverrides={manualOverrides}
          onChange={setManualOverrides}
        />
      )}

      {/* Country breakdown for active scenario */}
      {countryForecast && (
        <CountryBreakdown
          activeScenario={active}
          countryForecast={countryForecast}
          aopActive={!!aopState}
          manualOverrideCount={manualOverrideCount}
        />
      )}

      {/* Multi-year trajectory (only when horizon > 1) */}
      {horizonYears > 1 && (
        <MultiYearChart
          scenarios={scenarios}
          baselineYear={baselineYear || 2026}
        />
      )}

      {/* Saved snapshots — frozen records for board approval / audit trail */}
      <SnapshotsPanel
        snapshots={snapshots}
        onSave={handleSaveSnapshot}
        onDelete={handleDeleteSnapshot}
      />

      {/* Footnote */}
      <p className="text-xs text-gray-400 italic">
        MVP forecast — scenarios persist locally per browser. Per-country
        drivers, multi-year compounding, and AOP file ingest are next.
      </p>
    </div>
  );
}
