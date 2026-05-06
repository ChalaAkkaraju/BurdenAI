// CountryDriverOverrides.jsx
// First-class panel for per-country driver overrides (inflation, productivity,
// FX change). Empty input = inherit global default. Any value = country
// override that flows into the bridge, KPIs, scenario comparison — and locks
// the matching global slider so country-level work can't be overwritten.
//
// AOP headcount overrides come from the AOP uploader (separate concern), so
// this panel only exposes inflation / productivity / FX per country.

import React, { useState } from "react";
import { Sliders, ChevronDown, ChevronRight, RotateCcw, X, AlertCircle } from "lucide-react";

const COUNTRY_NAME = {
  US: "USA", IN: "India", GB: "UK", DE: "Germany",
  JP: "Japan", AU: "Australia", SG: "Singapore", BR: "Brazil",
  FR: "France", CA: "Canada", MX: "Mexico", PH: "Philippines",
};

// Reference defaults to make the panel useful out-of-the-box. User can apply
// these en masse via "Apply suggested rates" or just type their own.
const SUGGESTED_INFLATION = {
  US: 4.0, IN: 8.0, GB: 3.5, DE: 3.0, JP: 2.0,
  AU: 3.5, SG: 3.0, BR: 6.0, FR: 3.0, CA: 3.5,
};

export default function CountryDriverOverrides({
  countryBaselines,
  scenarioDrivers,
  manualOverrides,
  onChange,
}) {
  const [expanded, setExpanded] = useState(false); // collapsed by default — keep page compact
  const [pendingClear, setPendingClear] = useState(null); // { countryCode, label, fields: [{ key, label, value }] }

  if (!countryBaselines || countryBaselines.length === 0) return null;

  const overrideCount = Object.keys(manualOverrides).reduce((acc, code) => {
    const ov = manualOverrides[code];
    return acc
      + (ov?.inflationPct    != null ? 1 : 0)
      + (ov?.productivityPct != null ? 1 : 0)
      + (ov?.fxChangePct     != null ? 1 : 0);
  }, 0);

  const inflationOverrides    = Object.values(manualOverrides).filter((o) => o?.inflationPct    != null).length;
  const productivityOverrides = Object.values(manualOverrides).filter((o) => o?.productivityPct != null).length;
  const fxOverrides           = Object.values(manualOverrides).filter((o) => o?.fxChangePct     != null).length;

  const updateField = (code, key, raw) => {
    const next = { ...manualOverrides };
    const trimmed = String(raw).trim();
    if (trimmed === "") {
      // Empty -> remove that override key
      if (next[code]) {
        const { [key]: _, ...rest } = next[code];
        if (Object.keys(rest).length === 0) {
          delete next[code];
        } else {
          next[code] = rest;
        }
      }
    } else {
      const num = parseFloat(trimmed);
      if (!Number.isFinite(num)) return; // ignore garbage
      next[code] = { ...(next[code] || {}), [key]: num };
    }
    onChange(next);
  };

  const applySuggested = () => {
    const next = { ...manualOverrides };
    for (const cb of countryBaselines) {
      const suggested = SUGGESTED_INFLATION[cb.countryCode];
      if (suggested != null) {
        next[cb.countryCode] = { ...(next[cb.countryCode] || {}), inflationPct: suggested };
      }
    }
    onChange(next);
  };

  const clearAll = () => onChange({});

  // Open the confirmation modal listing every override on a country row.
  const requestClearCountry = (countryCode) => {
    const ov = manualOverrides[countryCode] || {};
    const fields = [];
    if (ov.inflationPct != null)    fields.push({ key: "inflationPct",    label: "Inflation",    value: ov.inflationPct,    fallback: scenarioDrivers.inflationPct });
    if (ov.productivityPct != null) fields.push({ key: "productivityPct", label: "Productivity", value: ov.productivityPct, fallback: scenarioDrivers.productivityPct });
    if (ov.fxChangePct != null)     fields.push({ key: "fxChangePct",     label: "FX change",    value: ov.fxChangePct,     fallback: 0 });
    if (fields.length === 0) return;
    setPendingClear({ countryCode, label: COUNTRY_NAME[countryCode] || countryCode, fields });
  };

  const confirmClearCountry = () => {
    if (!pendingClear) return;
    const next = { ...manualOverrides };
    delete next[pendingClear.countryCode];
    onChange(next);
    setPendingClear(null);
  };

  return (
    <div id="country-overrides-panel" className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between hover:opacity-80 transition"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
          <Sliders size={18} className="text-purple-600" />
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">
                Country drivers
              </h3>
              {overrideCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200">
                  {overrideCount} override{overrideCount === 1 ? "" : "s"} · sliders locked
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 text-left">
              {overrideCount === 0
                ? "Override inflation, productivity, or FX change per country. Blank = inherit global default."
                : `${inflationOverrides} inflation · ${productivityOverrides} productivity · ${fxOverrides} FX — applied to bridge, KPIs, country breakdown.`}
            </p>
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          Global default: {scenarioDrivers.inflationPct}% inflation · {scenarioDrivers.productivityPct}% productivity
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={applySuggested}
              className="px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 transition"
            >
              Apply suggested inflation rates
            </button>
            <button
              onClick={clearAll}
              disabled={overrideCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <RotateCcw size={12} />
              Clear all overrides
            </button>
            <span className="ml-auto text-xs text-gray-400 italic">
              Tip: leave a field blank to inherit the scenario value
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Country</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Baseline</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Inflation %</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Productivity %</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">FX change %</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {countryBaselines.map((cb) => {
                  const ov = manualOverrides[cb.countryCode] || {};
                  const inflPlaceholder = `${scenarioDrivers.inflationPct}`;
                  const prodPlaceholder = `${scenarioDrivers.productivityPct}`;
                  const fxPlaceholder = `0`;
                  const inflVal = ov.inflationPct != null ? ov.inflationPct : "";
                  const prodVal = ov.productivityPct != null ? ov.productivityPct : "";
                  const fxVal   = ov.fxChangePct != null ? ov.fxChangePct : "";
                  const inflOverridden = ov.inflationPct != null;
                  const prodOverridden = ov.productivityPct != null;
                  const fxOverridden   = ov.fxChangePct != null;
                  const anyOverridden  = inflOverridden || prodOverridden || fxOverridden;
                  const inputBase = "w-20 px-2 py-1 text-sm font-mono text-right border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200";
                  const inputOverride = "border-purple-300 bg-purple-50 text-purple-900 font-semibold";
                  const inputDefault  = "border-gray-200 bg-white text-gray-900";
                  return (
                    <tr key={cb.countryCode} className={`border-b border-gray-100 ${anyOverridden ? "bg-purple-50/30" : "hover:bg-gray-50"}`}>
                      <td className="py-2 px-2 font-medium text-gray-900">
                        {COUNTRY_NAME[cb.countryCode] || cb.label}
                        <span className="ml-2 text-xs text-gray-400 font-mono">{cb.countryCode}</span>
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-gray-500 text-xs">
                        ${(cb.totalBurden / 1_000_000).toFixed(2)}M
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number" step="0.5" value={inflVal} placeholder={inflPlaceholder}
                            onChange={(e) => updateField(cb.countryCode, "inflationPct", e.target.value)}
                            className={`${inputBase} ${inflOverridden ? inputOverride : inputDefault}`}
                          />
                          <span className="text-xs text-gray-400">%</span>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number" step="0.5" value={prodVal} placeholder={prodPlaceholder}
                            onChange={(e) => updateField(cb.countryCode, "productivityPct", e.target.value)}
                            className={`${inputBase} ${prodOverridden ? inputOverride : inputDefault}`}
                          />
                          <span className="text-xs text-gray-400">%</span>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number" step="0.5" value={fxVal} placeholder={fxPlaceholder}
                            onChange={(e) => updateField(cb.countryCode, "fxChangePct", e.target.value)}
                            className={`${inputBase} ${fxOverridden ? inputOverride : inputDefault}`}
                          />
                          <span className="text-xs text-gray-400">%</span>
                        </div>
                      </td>
                      <td className="text-right py-2 px-2">
                        {anyOverridden ? (
                          <button
                            onClick={() => requestClearCountry(cb.countryCode)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition"
                            title="Clear this country's overrides — global defaults will apply"
                          >
                            <X size={11} />
                            Clear
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">default</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500">
            <span className="font-semibold">How this works:</span> per-country values flow into every panel (bridge, KPIs, country breakdown, scenario comparison). The matching global slider locks while a country has its own value, so country-level work can't be overwritten.
          </p>
        </div>
      )}

      {/* Confirmation modal — clearing a country override */}
      {pendingClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPendingClear(null)}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-full bg-amber-100">
                <AlertCircle size={18} className="text-amber-700" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">Clear {pendingClear.label} override{pendingClear.fields.length === 1 ? "" : "s"}?</h4>
                <p className="text-sm text-gray-600 mt-1">
                  {pendingClear.label} will return to the global default for {pendingClear.fields.length === 1 ? "this driver" : "these drivers"}:
                </p>
              </div>
            </div>
            <div className="space-y-1.5 mb-5 ml-12">
              {pendingClear.fields.map((f) => (
                <div key={f.key} className="flex items-baseline gap-2 text-sm">
                  <span className="font-medium text-gray-900 w-28">{f.label}</span>
                  <span className="font-mono font-semibold text-purple-700">{f.value}%</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-mono font-semibold text-gray-700">{f.fallback}%</span>
                  <span className="text-xs text-gray-500 italic">(global)</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingClear(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmClearCountry}
                className="px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
              >
                Clear override{pendingClear.fields.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
