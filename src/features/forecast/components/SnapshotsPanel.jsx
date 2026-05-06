// SnapshotsPanel.jsx
// Lists saved forecast snapshots and provides save / download / delete controls.
// Snapshots are immutable records of the forecast state at save time, useful
// for board-approved forecasts that need to be referenced later even after
// underlying data has moved.

import React, { useState } from "react";
import { Archive, Plus, Download, Trash2, ChevronDown, ChevronRight, Calendar, User, Eye, RotateCcw, FileText } from "lucide-react";
import { downloadForecastXlsx } from "../engine/forecastXlsxExporter.js";

const formatUSD = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
};

const formatRelativeTime = (iso) => {
  if (!iso) return "";
  const then = new Date(iso);
  const diffMs = Date.now() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return then.toLocaleDateString();
};

// Reshape snapshot scenarios so the xlsx exporter sees the same `result`
// shape as a live forecast (totals stored flat on each scenario in the
// snapshot, but exporter expects scenario.result.forecastedTotal etc.).
function downloadSnapshotXlsx(snapshot) {
  const scenarios = snapshot.scenarios.map((s) => ({
    ...s,
    result: {
      forecastedTotal: s.forecastedTotal,
      forecastedRate: s.forecastedRate,
      forecastedHeadcount: s.forecastedHeadcount,
    },
  }));
  const activeScenario = scenarios.find((s) => s.id === snapshot.activeScenarioId) || scenarios[0];
  downloadForecastXlsx(
    {
      scenarios,
      activeScenario,
      baseline: snapshot.baseline,
      baselineLabel: snapshot.baselineLabel || "snapshot baseline",
      forecastYear: snapshot.forecastYear,
      horizonYears: snapshot.horizonYears,
      manualOverrides: snapshot.manualOverrides,
      generatedAt: snapshot.createdAt,
    },
    `burdenai-forecast-snapshot-${snapshot.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${(snapshot.createdAt || new Date().toISOString()).slice(0, 10)}.xlsx`,
  );
}

export default function SnapshotsPanel({ snapshots, onSave, onDelete, onRestore }) {
  const [expanded, setExpanded] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [openSnapshotId, setOpenSnapshotId] = useState(null); // for view detail expansion

  const handleSave = () => {
    if (!draftName.trim()) return;
    onSave(draftName.trim(), draftDescription.trim());
    setDraftName("");
    setDraftDescription("");
    setShowSaveDialog(false);
    setExpanded(true);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 hover:opacity-80 transition"
        >
          {expanded ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
          <Archive size={18} className="text-indigo-600" />
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">
                Saved snapshots
              </h3>
              {snapshots.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                  {snapshots.length}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 text-left">
              Frozen records of the forecast at save time — board-approved versions, audit trail, point-in-time exports
            </p>
          </div>
        </button>

        <button
          onClick={() => setShowSaveDialog(!showSaveDialog)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
        >
          <Plus size={14} />
          Save snapshot
        </button>
      </div>

      {showSaveDialog && (
        <div className="mt-4 p-4 rounded-lg border border-indigo-200 bg-indigo-50">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Snapshot name *</label>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. FY27 Board-Approved Forecast"
                autoFocus
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Description (optional)</label>
              <input
                type="text"
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="e.g. Locked in April 2026 board meeting; Conservative scenario base case"
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={!draftName.trim()}
                className="px-4 py-1.5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Freeze & save
              </button>
              <button
                onClick={() => { setShowSaveDialog(false); setDraftName(""); setDraftDescription(""); }}
                className="px-4 py-1.5 rounded-md text-gray-600 hover:text-gray-900 text-sm font-medium transition"
              >
                Cancel
              </button>
              <span className="ml-auto text-xs text-gray-500 italic">
                Captures all scenarios, drivers, AOP, and overrides as they are now.
              </span>
            </div>
          </div>
        </div>
      )}

      {expanded && snapshots.length === 0 && !showSaveDialog && (
        <p className="mt-4 text-center text-sm text-gray-500 italic py-6">
          No snapshots yet. Save one to freeze the current forecast state.
        </p>
      )}

      {expanded && snapshots.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Saved</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Year</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Active scenario</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snap) => {
                const activeScenario = snap.scenarios.find((s) => s.id === snap.activeScenarioId) || snap.scenarios[0];
                const isOpen = openSnapshotId === snap.id;
                return (
                  <React.Fragment key={snap.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-2">
                      <div className="font-medium text-gray-900">{snap.name}</div>
                      {snap.description && (
                        <div className="text-xs text-gray-500 mt-0.5">{snap.description}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-gray-600 text-xs">
                      <div className="flex items-center gap-1">
                        <Calendar size={11} className="text-gray-400" />
                        {formatRelativeTime(snap.createdAt)}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <User size={11} className="text-gray-400" />
                        {snap.createdBy}
                      </div>
                    </td>
                    <td className="text-right py-2.5 px-2 font-mono text-gray-700">
                      {snap.forecastYear}
                      {snap.horizonYears > 1 && `+${snap.horizonYears - 1}`}
                    </td>
                    <td className="py-2.5 px-2 text-gray-700">
                      {activeScenario?.name || "—"}
                    </td>
                    <td className="text-right py-2.5 px-2 font-mono font-semibold text-gray-900">
                      {formatUSD(activeScenario?.forecastedTotal)}
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setOpenSnapshotId(isOpen ? null : snap.id)}
                          className={`p-1.5 rounded-md transition ${isOpen ? "text-indigo-600 bg-indigo-50" : "text-gray-500 hover:text-indigo-600 hover:bg-indigo-50"}`}
                          title={isOpen ? "Hide details" : "View frozen state"}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(
                              `Restore snapshot "${snap.name}"?\n\nThis will replace your current scenarios with the frozen state from ${formatRelativeTime(snap.createdAt)}.`
                            )) {
                              onRestore?.(snap);
                            }
                          }}
                          className="p-1.5 rounded-md text-gray-500 hover:text-amber-600 hover:bg-amber-50 transition"
                          title="Restore: replace current scenarios with this snapshot"
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          onClick={() => downloadSnapshotXlsx(snap)}
                          className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition"
                          title="Download as Excel"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(snap.id)}
                          className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition"
                          title="Delete snapshot"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-gray-100 bg-indigo-50/30">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="uppercase tracking-wider font-semibold text-indigo-700">Frozen state</span>
                            <span>·</span>
                            <span>Baseline {formatUSD(snap.baseline.totalBurden)} · {snap.baseline.headcount} HC · {snap.baseline.productiveHours.toLocaleString()} hrs</span>
                            <span>·</span>
                            <span>{snap.baselineLabel}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {snap.scenarios.map((s) => (
                              <div key={s.id} className={`rounded-md border p-2.5 text-xs ${s.id === snap.activeScenarioId ? "border-indigo-300 bg-white" : "border-gray-200 bg-white"}`}>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="font-semibold text-gray-900">{s.name}</span>
                                  {s.id === snap.activeScenarioId && (
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] uppercase tracking-wider font-semibold">Active</span>
                                  )}
                                  {s.aopState && (
                                    <FileText size={10} className="text-emerald-600" title={`AOP: ${s.aopState.fileName}`} />
                                  )}
                                </div>
                                <div className="font-mono text-gray-700 text-xs space-y-0.5">
                                  <div>Inflation: {s.drivers.inflationPct}% · Productivity: {s.drivers.productivityPct}% · AOP: {s.drivers.aopHeadcountDeltaPct >= 0 ? "+" : ""}{s.drivers.aopHeadcountDeltaPct}%</div>
                                  <div>Ramp: {s.drivers.hiringRamp ?? 1} · Hedge: {s.drivers.hedgeRatio ?? 0}</div>
                                  <div className="pt-1 mt-1 border-t border-gray-100">
                                    <span className="text-gray-500">Total:</span> <span className="font-bold text-gray-900">{formatUSD(s.forecastedTotal)}</span>
                                    {" · "}
                                    <span className="text-gray-500">Rate:</span> <span className="text-gray-900">${(s.forecastedRate ?? 0).toFixed(2)}/hr</span>
                                  </div>
                                </div>
                                {s.notes && (
                                  <div className="mt-2 pt-2 border-t border-gray-100 text-gray-600 italic">"{s.notes}"</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
