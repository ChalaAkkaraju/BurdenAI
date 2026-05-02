// AOPUploader.jsx
// Drag-drop CSV upload for the Annual Operating Plan. On parse:
//   - Shows a preview table with parsed rows and computed delta vs baseline
//   - Surfaces parse errors and matching warnings
//   - Provides "Apply to country breakdown" / "Clear" controls
//
// Stays out of scenario state for MVP — single global AOP, used by the country
// breakdown when present. Per-scenario AOP attachment is a future enhancement.

import React, { useRef, useState } from "react";
import { Upload, FileText, X, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { parseAOPCsv, computeAOPOverrides } from "../engine/aopParser.js";

const SAMPLE_CSV = `country,planned_headcount
US,220
IN,200
GB,42
DE,80
JP,28
AU,18
SG,15
BR,30`;

function downloadSample() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "burdenai-aop-sample.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const formatPct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

export default function AOPUploader({ countryBaselines, aopState, onAopChange, activeScenarioName }) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseErrors, setParseErrors] = useState([]);
  const [matchWarnings, setMatchWarnings] = useState([]);

  function handleFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseErrors(["Only .csv files are supported in this version"]);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const { rows, errors } = parseAOPCsv(text);
      setParseErrors(errors);
      if (errors.length > 0 || rows.length === 0) {
        setMatchWarnings([]);
        return;
      }
      const { overrides, warnings } = computeAOPOverrides(rows, countryBaselines);
      setMatchWarnings(warnings);
      onAopChange({
        fileName: file.name,
        rows,
        overrides,
      });
    };
    reader.onerror = () => setParseErrors(["Failed to read file"]);
    reader.readAsText(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }

  function onPick(e) {
    const file = e.target.files?.[0];
    handleFile(file);
    e.target.value = ""; // allow re-selecting same file
  }

  function clearAop() {
    setParseErrors([]);
    setMatchWarnings([]);
    onAopChange(null);
  }

  // Build preview rows with baseline + delta info for display
  const previewRows = aopState
    ? aopState.rows.map((r) => {
        const cb = countryBaselines.find((c) => c.countryCode === r.countryCode);
        const baseline = cb?.headcount ?? null;
        const delta = baseline ? ((r.plannedHeadcount - baseline) / baseline) * 100 : null;
        return { ...r, baseline, delta };
      })
    : [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900">AOP plan upload</h3>
            {activeScenarioName && (
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                Attaches to: {activeScenarioName}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Upload a CSV with planned headcount per country. The AOP attaches to
            the active scenario, so each scenario can have its own plan.
          </p>
        </div>
        <button
          onClick={downloadSample}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          <Download size={14} />
          Sample CSV
        </button>
      </div>

      {!aopState && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition ${
            dragOver
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
          }`}
        >
          <Upload size={28} className="text-gray-400 mb-2" />
          <p className="text-sm text-gray-700 font-medium">
            Drop your AOP CSV here, or click to browse
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Expected columns: <span className="font-mono">country</span>,{" "}
            <span className="font-mono">planned_headcount</span>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onPick}
          />
        </div>
      )}

      {aopState && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <FileText size={14} className="text-emerald-700" />
            <span className="text-sm text-emerald-900 font-medium flex-1">
              {aopState.fileName}
            </span>
            <span className="text-xs text-emerald-700">
              {aopState.rows.length} {aopState.rows.length === 1 ? "country" : "countries"} parsed
            </span>
            <button
              onClick={clearAop}
              className="text-emerald-700 hover:text-emerald-900 transition"
              title="Clear AOP"
            >
              <X size={14} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Country</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Baseline HC</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">AOP HC</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Implied delta</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.countryCode} className="border-b border-gray-100">
                    <td className="py-2 px-2 font-medium text-gray-900">{r.countryCode}</td>
                    <td className="text-right py-2 px-2 font-mono text-gray-600">
                      {r.baseline != null ? r.baseline.toLocaleString() : "—"}
                    </td>
                    <td className="text-right py-2 px-2 font-mono font-semibold text-gray-900">
                      {r.plannedHeadcount.toLocaleString()}
                    </td>
                    <td className={`text-right py-2 px-2 font-mono ${
                      r.delta == null ? "text-gray-400" : r.delta >= 0 ? "text-red-600" : "text-emerald-600"
                    }`}>
                      {r.delta != null ? formatPct(r.delta) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {parseErrors.length > 0 && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-red-600" />
            <span className="text-sm font-semibold text-red-800">Parse errors</span>
          </div>
          <ul className="text-xs text-red-700 list-disc ml-6 space-y-0.5">
            {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {matchWarnings.length > 0 && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">Warnings</span>
          </div>
          <ul className="text-xs text-amber-800 list-disc ml-6 space-y-0.5">
            {matchWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
