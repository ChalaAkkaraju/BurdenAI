// TargetsDialog.jsx — edit utilization targets per cost center, the company
// default, or load them from CSV.

import React, { useMemo, useState } from "react";
import { Download, Upload, AlertCircle, RotateCcw } from "lucide-react";
import Modal from "./Modal.jsx";
import { parseTargetsCsv, buildTargetsCsv, downloadText } from "../engine/csv.js";

export default function TargetsDialog({ targets, costCenters, sample, onSave, onClose }) {
  const [defaultPct, setDefaultPct] = useState(targets.defaultPct ?? 85);
  const [values, setValues] = useState(() => {
    const v = {};
    for (const c of costCenters) v[c.costCenterId] = targets.byCostCenter?.[c.costCenterId] ?? "";
    return v;
  });
  const [source, setSource] = useState(targets.source || "Edited");
  const [errors, setErrors] = useState([]);
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return costCenters.filter((c) => !q || `${c.costCenterId} ${c.departmentName} ${c.countryName}`.toLowerCase().includes(q));
  }, [costCenters, query]);

  const setOne = (id, v) => {
    setValues((prev) => ({ ...prev, [id]: v }));
    setSource("Edited");
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const r = parseTargetsCsv(String(reader.result || ""));
      setErrors(r.errors);
      setValues((prev) => {
        const next = { ...prev };
        for (const [cc, pct] of Object.entries(r.byCostCenter)) if (cc in next) next[cc] = pct;
        return next;
      });
      setSource(`Uploaded ${f.name}`);
    };
    reader.readAsText(f);
  };

  const resetSample = () => {
    const v = {};
    for (const c of costCenters) v[c.costCenterId] = sample.byCostCenter?.[c.costCenterId] ?? "";
    setValues(v);
    setDefaultPct(sample.defaultPct);
    setSource(sample.source);
    setErrors([]);
  };

  const invalid = Object.values(values).some((v) => v !== "" && (Number(v) <= 0 || Number(v) > 100))
    || !(Number(defaultPct) > 0 && Number(defaultPct) <= 100);

  const save = () => {
    // Keep targets for cost centers outside this user's view; replace the ones shown.
    const byCostCenter = { ...(targets.byCostCenter || {}) };
    for (const [cc, v] of Object.entries(values)) {
      if (v === "" || v == null) delete byCostCenter[cc];
      else byCostCenter[cc] = Number(v);
    }
    onSave({ defaultPct: Number(defaultPct), byCostCenter, source });
  };

  return (
    <Modal
      title="Utilization targets"
      subtitle="Set a target for each cost center. Blank uses the company default."
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button type="button" disabled={invalid} onClick={save}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300">
            Save targets
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Company default
          <span className="inline-flex items-center gap-1 text-sm font-normal text-gray-900 normal-case tracking-normal">
            <input type="number" min={1} max={100} value={defaultPct}
              onChange={(e) => { setDefaultPct(e.target.value); setSource("Edited"); }}
              className="w-20 px-2 py-1.5 border border-gray-300 rounded-md text-sm" /> %
          </span>
        </label>
        <div className="flex flex-wrap gap-2 ml-auto">
          <button type="button" onClick={resetSample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">
            <RotateCcw size={14} /> Reset to sample targets
          </button>
          <button type="button"
            onClick={() => downloadText(buildTargetsCsv(costCenters.map((c) => c.costCenterId), (cc) => (values[cc] === "" ? defaultPct : values[cc])), "utilization-targets.csv")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">
            <Download size={14} /> Download CSV
          </button>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium cursor-pointer">
            <Upload size={14} /> Upload CSV
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
          </label>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          <div className="flex items-center gap-2 font-semibold"><AlertCircle size={16} /> Some rows were not used</div>
          <ul className="mt-1 list-disc pl-6">{errors.slice(0, 6).map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a cost center, department or country"
        aria-label="Find a cost center" className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg text-sm" />

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="text-left px-3 py-2">Cost center</th>
              <th className="text-left px-3 py-2">Department</th>
              <th className="text-left px-3 py-2">Country</th>
              <th className="text-right px-3 py-2 w-32">Target %</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.costCenterId} className="border-t border-gray-100">
                <td className="px-3 py-1.5 font-mono text-xs">{c.costCenterId}</td>
                <td className="px-3 py-1.5">{c.departmentName}</td>
                <td className="px-3 py-1.5">{c.countryName}</td>
                <td className="px-3 py-1.5 text-right">
                  <input type="number" min={1} max={100} value={values[c.costCenterId]} placeholder={String(defaultPct)}
                    aria-label={`Target for ${c.costCenterId}`}
                    onChange={(e) => setOne(c.costCenterId, e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm text-right" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
