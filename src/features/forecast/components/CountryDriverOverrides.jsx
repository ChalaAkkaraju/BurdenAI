// CountryDriverOverrides.jsx
// Advanced panel for setting per-country inflation and productivity overrides.
// Empty input = inherit scenario default. Any value = country-specific override.
//
// AOP headcount overrides come from the AOP uploader (separate concern), so
// this panel only exposes inflation + productivity per country.

import React, { useState } from "react";
import { Sliders, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";

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
  const [expanded, setExpanded] = useState(false);

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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
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
                Per-country driver overrides
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
                Advanced
              </span>
              {overrideCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                  {overrideCount} active
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 text-left">
              {overrideCount === 0
                ? "Override inflation, productivity, or FX change per country. Empty = inherit scenario default."
                : `${inflationOverrides} inflation, ${productivityOverrides} productivity, ${fxOverrides} FX overridden`}
            </p>
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          Scenario default: {scenarioDrivers.inflationPct}% inflation · {scenarioDrivers.productivityPct}% productivity
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
                  const inputBase = "w-20 px-2 py-1 text-sm font-mono text-right border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200";
                  const inputOverride = "border-purple-300 bg-purple-50 text-purple-900 font-semibold";
                  const inputDefault  = "border-gray-200 bg-white text-gray-900";
                  return (
                    <tr key={cb.countryCode} className="border-b border-gray-100 hover:bg-gray-50">
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 italic">
            Overrides apply to the country contribution view. Other panels (KPIs, waterfall, multi-year, comparison) use the scenario's global drivers.
          </p>
        </div>
      )}
    </div>
  );
}
