// ErpExportPanel.jsx
// "Send forecast to SAP" — Phase 1: file-based export, no backend.
//
// User flow:
//   1. Open the panel, see the country → SAP cost center mapping table.
//   2. Fill in any missing SAP cost center IDs (persisted to localStorage).
//   3. Click "Send to SAP". Dialog asks for controlling area, plan version,
//      fiscal year, currency, activity type.
//   4. Click Generate. App builds KP26-shaped rows, validates settings, and
//      downloads a CSV the user uploads via SAP's flexible-upload tool.
//
// No data leaves the browser. This is the safe "prove the mapping" step
// before Phase 2 wires up a real server-side push.

import React, { useState, useMemo } from "react";
import {
  Server, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, X, Download, ExternalLink,
} from "lucide-react";
import { usePersistedState } from "../hooks/usePersistedState.js";
import { buildKp26Rows, validateSettings } from "../erp/kp26Mapper.js";
import { downloadKp26Csv, buildKp26Filename, stripMeta } from "../erp/kp26Exporter.js";

const DEFAULT_SETTINGS = {
  controllingArea: "",
  planVersion: "",
  fiscalYear: "",
  activityType: "BURDEN",
  currency: "USD",
};

export default function ErpExportPanel({
  countryForecast,
  forecastYear,
  scenarioName,
  onAuditExport,
}) {
  const [expanded, setExpanded] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  // Persisted: per-country SAP cost-center mapping.
  const [mapping, setMapping] = usePersistedState("burdenai_kp26_mapping", {});

  // Persisted: last-used dialog values, with this year's fiscalYear default.
  const [settings, setSettings] = usePersistedState(
    "burdenai_kp26_settings",
    { ...DEFAULT_SETTINGS, fiscalYear: forecastYear ? String(forecastYear) : "" },
  );

  // Build a preview of rows — used both for the in-dialog preview and to
  // surface "missing mapping" warnings.
  const { rows, missing } = useMemo(
    () => buildKp26Rows({ countryForecast, mapping, settings }),
    [countryForecast, mapping, settings],
  );

  const totalCountries = countryForecast?.byCountry?.length || 0;
  const mappedCount = totalCountries - missing.length;

  const handleMappingChange = (countryCode, value) => {
    setMapping({ ...mapping, [countryCode]: value });
  };

  const handleSettingsChange = (field, value) => {
    setSettings({ ...settings, [field]: value });
  };

  const handleGenerate = () => {
    const errs = validateSettings(settings);
    if (errs.length > 0) {
      alert("Fix these before exporting:\n\n" + errs.join("\n"));
      return;
    }
    if (rows.length === 0) {
      alert("No mappable countries — fill in at least one SAP cost center first.");
      return;
    }
    const filename = buildKp26Filename({
      planVersion: settings.planVersion,
      fiscalYear: settings.fiscalYear,
      scenarioName,
    });
    downloadKp26Csv(stripMeta(rows), filename);
    setShowDialog(false);
    if (onAuditExport) {
      onAuditExport({
        format: "KP26",
        rowCount: rows.length,
        unmappedCount: missing.length,
        planVersion: settings.planVersion,
        fiscalYear: settings.fiscalYear,
        filename,
      });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      {/* Collapsible header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 hover:opacity-80 transition"
        >
          {expanded ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
          <Server size={18} className="text-indigo-600" />
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">Send to SAP (KP26)</h3>
              <span className="text-xs font-medium text-gray-500">
                {mappedCount}/{totalCountries} countries mapped
              </span>
              {missing.length > 0 && (
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  {missing.length} unmapped
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Phase 1 — generate a KP26 flexible-upload CSV for SAP S/4HANA. No data leaves the browser.
            </p>
          </div>
        </button>
        {expanded && (
          <button
            onClick={() => setShowDialog(true)}
            disabled={mappedCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
            title={mappedCount === 0 ? "Fill in at least one SAP cost center first" : "Generate KP26 CSV"}
          >
            <Download size={14} />
            Send to SAP
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Mapping table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Country → SAP cost center
              </h4>
              {missing.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700">
                  <AlertCircle size={12} />
                  Unmapped countries are excluded from the export
                </div>
              )}
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Country</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">SAP cost center</th>
                    <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Forecasted rate</th>
                    <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan hours</th>
                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(countryForecast?.byCountry || []).map((c) => {
                    const sapId = mapping[c.countryCode] || "";
                    const isMapped = sapId.trim() !== "";
                    const planHours = c.forecastedRate > 0
                      ? Math.round(c.forecastedTotal / c.forecastedRate)
                      : 0;
                    return (
                      <tr key={c.countryCode} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <div className="font-medium text-gray-900">{c.label}</div>
                          <div className="text-xs text-gray-500">{c.countryCode}</div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={sapId}
                            onChange={(e) => handleMappingChange(c.countryCode, e.target.value)}
                            placeholder="e.g., USCC10000"
                            className="w-40 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-sm text-gray-700">
                          ${c.forecastedRate?.toFixed(2) ?? "0.00"}/hr
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-sm text-gray-700">
                          {planHours.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {isMapped ? (
                            <CheckCircle2 size={16} className="text-emerald-600 inline" />
                          ) : (
                            <span className="text-xs text-amber-700">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Settings preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Last used settings
            </h4>
            <div className="grid grid-cols-5 gap-3 text-sm">
              <div>
                <div className="text-xs text-gray-500">Controlling area</div>
                <div className="font-mono font-semibold text-gray-900">{settings.controllingArea || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Plan version</div>
                <div className="font-mono font-semibold text-gray-900">{settings.planVersion || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Fiscal year</div>
                <div className="font-mono font-semibold text-gray-900">{settings.fiscalYear || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Activity type</div>
                <div className="font-mono font-semibold text-gray-900">{settings.activityType || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Currency</div>
                <div className="font-mono font-semibold text-gray-900">{settings.currency || "—"}</div>
              </div>
            </div>
          </div>

          {/* Help text */}
          <div className="text-xs text-gray-500 leading-relaxed">
            <strong className="text-gray-700">How to use the file in SAP:</strong> open S/4HANA, run transaction
            <span className="font-mono mx-1">KP26</span> → Edit menu → Upload File. Pick the downloaded CSV.
            SAP will validate against your real cost centers and activity types before posting to plan version{" "}
            <span className="font-mono">{settings.planVersion || "<plan version>"}</span>.
          </div>
        </div>
      )}

      {/* Send-to-SAP dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Server size={20} className="text-indigo-600" />
                <h3 className="text-xl font-bold text-gray-900">Send forecast to SAP</h3>
              </div>
              <button onClick={() => setShowDialog(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Generates a KP26-shape CSV with {rows.length} row{rows.length === 1 ? "" : "s"} for{" "}
              <strong>{scenarioName}</strong>. Upload it to SAP via transaction{" "}
              <span className="font-mono">KP26</span> → Upload File.
            </p>

            <div className="space-y-3">
              <DialogField
                label="Controlling area"
                value={settings.controllingArea}
                onChange={(v) => handleSettingsChange("controllingArea", v)}
                placeholder="e.g. 1000"
              />
              <DialogField
                label="Plan version"
                value={settings.planVersion}
                onChange={(v) => handleSettingsChange("planVersion", v)}
                placeholder="e.g. P1"
              />
              <DialogField
                label="Fiscal year"
                value={settings.fiscalYear}
                onChange={(v) => handleSettingsChange("fiscalYear", v)}
                placeholder="e.g. 2027"
              />
              <DialogField
                label="Activity type"
                value={settings.activityType}
                onChange={(v) => handleSettingsChange("activityType", v)}
                placeholder="e.g. BURDEN"
              />
              <DialogField
                label="Currency"
                value={settings.currency}
                onChange={(v) => handleSettingsChange("currency", v.toUpperCase())}
                placeholder="USD"
                maxLength={3}
              />
            </div>

            {missing.length > 0 && (
              <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <div>
                  <strong>{missing.length} countries</strong> are not mapped to a SAP cost center and will be excluded:{" "}
                  {missing.map((m) => m.label || m.countryCode).join(", ")}.
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setShowDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                <Download size={14} />
                Generate CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DialogField({ label, value, onChange, placeholder, maxLength }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
      />
    </label>
  );
}
