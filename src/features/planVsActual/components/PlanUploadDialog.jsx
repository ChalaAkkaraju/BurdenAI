// PlanUploadDialog.jsx — upload a cost-center plan CSV that overrides the
// derived plan for the selected fiscal year.

import React, { useState } from "react";
import { Download, Upload, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import Modal from "./Modal.jsx";
import { parsePlanCsv, PLAN_COLUMNS } from "../engine/csv.js";

export default function PlanUploadDialog({ fy, current, preview, onApply, onRemove, onDownloadTemplate, onClose }) {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = parsePlanCsv(String(reader.result || ""));
      setFile(f.name);
      setParsed({ ...result, check: result.rows.length ? preview(result.rows) : null });
    };
    reader.readAsText(f);
  };

  const canApply = parsed && parsed.rows.length > 0 && parsed.check && parsed.check.applied > 0;

  return (
    <Modal
      title={`Upload plan — FY${fy}`}
      subtitle="Rows in the file replace the derived plan for those cost centers and months. Everything else keeps the derived plan."
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button
            type="button"
            disabled={!canApply}
            onClick={() => onApply({ fileName: file, rows: parsed.rows })}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Apply upload
          </button>
        </>
      }
    >
      {current && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-900">
          <span>
            In use: <strong>{current.fileName}</strong> · {current.rows.length} rows · uploaded {new Date(current.uploadedAt).toLocaleString()}
            {current.uploadedBy ? ` by ${current.uploadedBy}` : ""}
          </span>
          <button type="button" onClick={onRemove} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-800 hover:text-blue-950">
            <Trash2 size={14} /> Remove upload
          </button>
        </div>
      )}

      <ol className="space-y-4 text-sm text-gray-700">
        <li>
          <div className="font-semibold text-gray-900">1. Start from the template</div>
          <p className="mt-1">It holds the current plan as one FY{fy} row per cost center. Edit the numbers you want to change and delete the rest.</p>
          <button type="button" onClick={onDownloadTemplate}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50">
            <Download size={14} /> Download template
          </button>
        </li>
        <li>
          <div className="font-semibold text-gray-900">2. Choose your file</div>
          <p className="mt-1">
            Columns: <span className="font-mono text-xs">{PLAN_COLUMNS.join(", ")}</span>. Period is a month (<span className="font-mono text-xs">2025-07</span>) or
            the whole year (<span className="font-mono text-xs">FY{fy}</span>, spread evenly). Blank numbers keep the derived value.
          </p>
          <label className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium cursor-pointer">
            <Upload size={14} /> Choose CSV
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
          </label>
          {file && <span className="ml-3 text-gray-600">{file}</span>}
        </li>
      </ol>

      {parsed && (
        <div className="mt-4 space-y-2 text-sm">
          {parsed.rows.length > 0 && parsed.check && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>
                {parsed.check.applied} row{parsed.check.applied === 1 ? "" : "s"} will apply to FY{fy}, overriding {parsed.check.costCentersOverridden} cost center{parsed.check.costCentersOverridden === 1 ? "" : "s"}.
                {parsed.rows.length - parsed.check.applied - parsed.check.skipped.length > 0 &&
                  ` ${parsed.rows.length - parsed.check.applied - parsed.check.skipped.length} rows are for another year and are kept for that year.`}
              </span>
            </div>
          )}
          {parsed.check?.skipped?.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>
                {parsed.check.skipped.length === 1 ? "1 row names a cost center that is" : `${parsed.check.skipped.length} rows name cost centers that are`} not in the plan and will be ignored:{" "}
                {[...new Set(parsed.check.skipped.map((s) => s.costCenter))].slice(0, 6).join(", ")}
              </span>
            </div>
          )}
          {parsed.errors.length > 0 && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800">
              <div className="flex items-center gap-2 font-semibold"><AlertCircle size={16} /> {parsed.errors.length} problem{parsed.errors.length === 1 ? "" : "s"} — these rows are not used</div>
              <ul className="mt-1 list-disc pl-6 space-y-0.5">
                {parsed.errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}
                {parsed.errors.length > 8 && <li>…and {parsed.errors.length - 8} more</li>}
              </ul>
            </div>
          )}
          {parsed.rows.length > 0 && parsed.check && parsed.check.applied === 0 && (
            <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
              No rows in this file are for FY{fy}. Check the Period column.
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
