// PlanVsActualTab.jsx
// Labor utilization and burden absorption: plan against actuals, by cost center.
//
// Plan = a derived plan (sample budget or a Forecast snapshot scenario) for the
// fiscal year, spread evenly across 12 months, with optional CSV overrides per
// cost center / month. Actuals = the app's cost records with hours split into
// holidays, leave and productive time (see engine/actuals.js).

import React, { useMemo, useState } from "react";
import { Target, Upload, Download, Crosshair, Info, AlertTriangle } from "lucide-react";
import { useApp } from "../../../context/AppContext";
import { usePersistedState } from "../../forecast/hooks/usePersistedState.js";
import { useSnapshots } from "../../forecast/hooks/useSnapshots.js";
import { getCurrencyInfo } from "../../../utils/currency.js";
import { countries as COUNTRY_LIST } from "../../../data/orgHierarchy.js";
import { fiscalMonths, plannableFiscalYears, availableMonths, monthLabel } from "../engine/fiscal.js";
import { buildActuals } from "../engine/actuals.js";
import { annualByCostCenter, derivePlan, snapshotFactors, applyUploads, SAMPLE_INFLATION } from "../engine/plan.js";
import { buildLines, summarize, groupBy, needsReview, monthlyTrend, DEFAULT_FLAG_RULES } from "../engine/variance.js";
import { sampleTargets } from "../engine/targets.js";
import { buildPlanTemplateCsv, downloadText } from "../engine/csv.js";
import { buildPlanVsActualWorkbook, downloadWorkbook } from "../engine/excelExport.js";
import { USD, money, pct, pts, num, signedNum, tone } from "../format.js";
import CostBridge from "./CostBridge.jsx";
import UtilizationTrend from "./UtilizationTrend.jsx";
import VarianceTable from "./VarianceTable.jsx";
import PlanUploadDialog from "./PlanUploadDialog.jsx";
import TargetsDialog from "./TargetsDialog.jsx";
import { useAi } from "../../ai/AiContext.jsx";

const COUNTRY_NAME = Object.fromEntries(COUNTRY_LIST.map((c) => [c.code, c.name]));
const SHORT_NAME = { US: "US", GB: "UK", DE: "Germany", IN: "India", JP: "Japan", BR: "Brazil", SG: "Singapore", AU: "Australia" };

function localCur(code) {
  const c = getCurrencyInfo(code);
  return { symbol: c.symbol, fx: c.fxFromUSD, code: c.currency };
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</span>
      <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition ${
              value === o.value ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"
            } disabled:text-gray-300 disabled:hover:bg-transparent`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, children, minWidth = "min-w-[160px]", disabled }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900 bg-white border border-gray-300 rounded-lg ${minWidth} disabled:bg-gray-50 disabled:text-gray-400`}
      >
        {children}
      </select>
    </label>
  );
}

function Kpi({ title, value, valueClass = "text-gray-900", lines }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <p className="text-sm text-gray-600 font-medium">{title}</p>
      <p className={`text-3xl font-bold mt-2 ${valueClass}`}>{value}</p>
      <div className="mt-2 space-y-0.5">
        {lines.map((l, i) => (
          <p key={i} className={`text-xs ${l.className || "text-gray-500"}`}>{l.text}</p>
        ))}
      </div>
    </div>
  );
}

const DEFAULT_SETTINGS = {
  fy: null,
  planKey: "sample",
  view: "ytd",
  month: null,
  country: "ALL",
  department: "ALL",
  currency: "USD",
  flagGapPts: DEFAULT_FLAG_RULES.gapPts,
};

export default function PlanVsActualTab() {
  const { costData, employeeMap, periods, currentUser, addAuditEntry } = useApp();
  const { snapshots } = useSnapshots();
  const ai = useAi();

  const [settings, setSettings] = usePersistedState("burdenai_pva_settings", DEFAULT_SETTINGS);
  const [uploads, setUploads] = usePersistedState("burdenai_pva_uploads", {});
  const [storedTargets, setStoredTargets] = usePersistedState("burdenai_pva_targets", null);
  const [dialog, setDialog] = useState(null); // 'upload' | 'targets'
  const set = (patch) => setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...patch }));

  // ---- Actuals (built once) ------------------------------------------------
  const actuals = useMemo(() => buildActuals({ costData, employeeMap }), [costData, employeeMap]);
  const actualsByKey = useMemo(() => new Map(actuals.map((a) => [a.key, a])), [actuals]);

  const allCostCenters = useMemo(() => {
    const m = new Map();
    for (const a of actuals) if (!m.has(a.costCenterId)) m.set(a.costCenterId, {
      costCenterId: a.costCenterId, departmentName: a.departmentName, vertical: a.vertical,
      countryCode: a.countryCode, countryName: COUNTRY_NAME[a.countryCode] || a.countryCode,
    });
    return [...m.values()].sort((x, y) => x.countryName.localeCompare(y.countryName) || x.costCenterId.localeCompare(y.costCenterId));
  }, [actuals]);

  // ---- Access scope ----------------------------------------------------------
  const allowed = currentUser?.allowedCountries || [];
  const allCountriesAllowed = allowed.includes("*");
  const inScope = (code) => allCountriesAllowed || allowed.includes(code);
  const scopedCostCenters = allCostCenters.filter((c) => inScope(c.countryCode));
  const countryCodes = [...new Set(scopedCostCenters.map((c) => c.countryCode))]
    .sort((a, b) => (COUNTRY_NAME[a] || a).localeCompare(COUNTRY_NAME[b] || b));
  const departments = [...new Set(scopedCostCenters.map((c) => c.departmentName))].sort();

  // ---- Settings resolved -------------------------------------------------------
  const fys = useMemo(() => plannableFiscalYears(periods), [periods]);
  const fy = fys.includes(settings.fy) ? settings.fy : fys[0];
  const months = useMemo(() => (fy ? fiscalMonths(fy) : []), [fy]);
  const actualMonths = useMemo(() => (fy ? availableMonths(fy, periods) : []), [fy, periods]);
  const isPartialYear = actualMonths.length < 12;
  const month = actualMonths.includes(settings.month) ? settings.month : actualMonths[actualMonths.length - 1];
  const requestedView = ["month", "ytd", "year"].includes(settings.view) ? settings.view : "ytd";
  const view = requestedView === "year" && isPartialYear ? "ytd" : requestedView;
  const country = settings.country === "ALL" || countryCodes.includes(settings.country) ? settings.country : "ALL";
  const department = settings.department === "ALL" || departments.includes(settings.department) ? settings.department : "ALL";
  const currency = settings.currency === "LOCAL" ? "LOCAL" : "USD";
  const flagRules = { ...DEFAULT_FLAG_RULES, gapPts: settings.flagGapPts || DEFAULT_FLAG_RULES.gapPts };

  const selectedPeriods = useMemo(() => {
    if (view === "month") return [month];
    if (view === "year") return actualMonths;
    return months.slice(0, months.indexOf(month) + 1);
  }, [view, month, months]);

  // ---- Targets ---------------------------------------------------------------
  const sample = useMemo(() => sampleTargets(allCostCenters), [allCostCenters]);
  const targets = storedTargets || sample;

  // ---- Plan --------------------------------------------------------------------
  const planOptions = useMemo(() => {
    const opts = [{ key: "sample", label: "Sample plan", source: "sample" }];
    for (const snap of snapshots || []) {
      for (const sc of snap.scenarios || []) {
        const factors = snapshotFactors(snap, sc.id);
        if (factors) opts.push({ key: `snap|${snap.id}|${sc.id}`, label: `Snapshot: ${snap.name} — ${sc.name}`, source: "snapshot", factors, snap });
      }
    }
    return opts;
  }, [snapshots]);
  const planOpt = planOptions.find((o) => o.key === settings.planKey) || planOptions[0];

  const priorAnnual = useMemo(() => (fy ? annualByCostCenter(actuals, fy - 1) : new Map()), [actuals, fy]);
  const basePlan = useMemo(
    () => (fy ? derivePlan({ priorAnnual, fy, source: planOpt.source, factors: planOpt.factors }) : new Map()),
    [priorAnnual, fy, planOpt],
  );
  const upload = fy ? uploads?.[fy] : null;
  const uploadResult = useMemo(
    () => (upload ? applyUploads(basePlan, upload.rows, fy) : { plan: basePlan, applied: 0, skipped: [], costCentersOverridden: 0 }),
    [basePlan, upload, fy],
  );
  const plan = uploadResult.plan;

  // ---- Lines ------------------------------------------------------------------------
  const filter = (info) =>
    inScope(info.countryCode) &&
    (country === "ALL" || info.countryCode === country) &&
    (department === "ALL" || info.departmentName === department);

  const yearLines = useMemo(
    () => buildLines({ plan, actualsByKey, periods: months, targets, filter }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, actualsByKey, months, targets, country, department, allowed.join(",")],
  );
  const selected = new Set(selectedPeriods);
  const lines = useMemo(() => yearLines.filter((l) => selected.has(l.period)), [yearLines, selectedPeriods]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = useMemo(() => summarize(lines), [lines]);
  const trend = useMemo(() => monthlyTrend(yearLines, months), [yearLines, months]);

  const totalCur = currency === "LOCAL" && country !== "ALL" ? localCur(country) : USD;

  const countryRows = useMemo(() => {
    const byCountry = groupBy(lines, (l) => l.countryCode);
    return [...byCountry.entries()]
      .map(([code, ls]) => {
        const ccs = [...groupBy(ls, (l) => l.costCenterId).entries()].map(([id, cls]) => {
          const s = summarize(cls);
          const sources = [...new Set(cls.map((l) => l.source))];
          return {
            id, s, flag: needsReview(s, flagRules),
            departmentName: cls[0].departmentName, vertical: cls[0].vertical,
            source: sources.length === 1 ? sources[0] : "Mixed",
          };
        }).sort((a, b) => Number(b.flag) - Number(a.flag) || a.departmentName.localeCompare(b.departmentName));
        const uploadedCount = ccs.filter((c) => c.source === "Uploaded" || c.source === "Mixed").length;
        const baseLabel = planOpt.source === "snapshot" ? "from snapshot" : "sample plan";
        return {
          code,
          name: COUNTRY_NAME[code] || code,
          cur: currency === "LOCAL" ? localCur(code) : USD,
          s: summarize(ls),
          ccs,
          flagCount: ccs.filter((c) => c.flag).length,
          sourceSummary: uploadedCount ? `${uploadedCount} of ${ccs.length} uploaded` : `All ${baseLabel}`,
        };
      })
      .sort((a, b) => b.s.actual.cost - a.s.actual.cost);
  }, [lines, currency, flagRules.gapPts, planOpt.source]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Labels -------------------------------------------------------------------------
  const periodLabel =
    view === "month" ? monthLabel(month)
      : view === "year" ? `FY${fy} full year (${monthLabel(months[0])} – ${monthLabel(months[11])})`
        : `FY${fy} year to date (${monthLabel(months[0])} – ${monthLabel(month)})`;
  const filterLabel = [
    country === "ALL" ? (allCountriesAllowed ? "All countries" : `Your countries (${countryCodes.join(", ")})`) : COUNTRY_NAME[country],
    department === "ALL" ? "all departments" : department,
  ].join(" · ");
  const planLabel = planOpt.source === "snapshot" ? planOpt.label.replace(/^Snapshot: /, "Snapshot ") : "Sample plan";

  // ---- Actions --------------------------------------------------------------------------
  const audit = (action, details) => {
    try {
      addAuditEntry?.({ action, target: `Plan vs Actual · FY${fy}`, details, category: "Plan vs Actual" });
    } catch { /* audit is best-effort */ }
  };

  const applyUpload = ({ fileName, rows }) => {
    const r = applyUploads(basePlan, rows, fy);
    setUploads((prev) => ({ ...prev, [fy]: { fileName, rows, uploadedAt: new Date().toISOString(), uploadedBy: currentUser?.name || currentUser?.email || "" } }));
    audit("Plan Uploaded", `${fileName}: ${r.applied} rows applied, ${r.costCentersOverridden} cost centers overridden${r.skipped.length ? `, ${r.skipped.length} rows skipped (unknown cost center)` : ""}`);
    setDialog(null);
  };
  const removeUpload = () => {
    const name = upload?.fileName;
    setUploads((prev) => { const n = { ...prev }; delete n[fy]; return n; });
    audit("Plan Upload Removed", `${name || "Upload"} removed; plan reverts to ${planLabel}`);
    setDialog(null);
  };
  const saveTargets = (next) => {
    setStoredTargets(next);
    audit("Utilization Targets Updated", `${Object.keys(next.byCostCenter || {}).length} cost-center targets, default ${next.defaultPct}% (${next.source})`);
    setDialog(null);
  };
  const exportExcel = () => {
    const costCenters = countryRows.flatMap((c) => c.ccs.map((r) => ({
      countryName: c.name, departmentName: r.departmentName, costCenterId: r.id, source: r.source, s: r.s, flag: r.flag,
      targetIsDefault: targets.byCostCenter?.[r.id] == null,
    })));
    const monthly = actualMonths.map((p) => ({ label: monthLabel(p), s: summarize(yearLines.filter((l) => l.period === p)) }));
    const wb = buildPlanVsActualWorkbook({
      meta: { fiscalYearLabel: `FY${fy}`, periodLabel, planLabel: `${planLabel}${upload ? ` + upload ${upload.fileName}` : ""}`, filterLabel },
      total, costCenters, monthly,
    });
    const filename = `burdenai-plan-vs-actual-FY${fy}-${view}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    downloadWorkbook(wb, filename);
    audit("Plan vs Actual Exported", `${filename} · ${periodLabel} · ${filterLabel}`);
  };

  if (!fy) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-gray-900">Plan vs Actual</h1>
        <p className="mt-2 text-gray-600">Needs two complete fiscal years of data (one to plan from, one to compare). None are loaded yet.</p>
      </div>
    );
  }

  const gapPlan = total.gapToPlanPts;
  const snapYearNote = planOpt.source === "snapshot" && planOpt.snap?.forecastYear && Number(planOpt.snap.forecastYear) !== fy
    ? `This snapshot was saved for ${planOpt.snap.forecastYear}; it is applied to FY${fy} here so it can be compared with actuals.`
    : null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            <Target size={14} /> Utilization
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Plan vs Actual</h1>
          <p className="text-sm text-gray-600 mt-1">Labor utilization and burden absorption — plan against actuals, by cost center.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setDialog("upload")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Upload size={14} /> Upload plan
          </button>
          <button type="button" onClick={() => setDialog("targets")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Crosshair size={14} /> Edit targets
          </button>
          <button type="button" onClick={exportExcel} disabled={lines.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white shadow-sm text-sm font-semibold hover:bg-blue-700 disabled:bg-gray-300">
            <Download size={14} /> Export to Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-end gap-x-5 gap-y-4">
        <SelectField label="Plan version" value={planOpt.key} onChange={(v) => set({ planKey: v })} minWidth="min-w-[260px] max-w-[360px]">
          {planOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </SelectField>
        <SelectField label="Fiscal year" value={fy} onChange={(v) => set({ fy: Number(v), month: null })} minWidth="min-w-[120px]">
          {fys.map((y) => <option key={y} value={y}>FY{y}{availableMonths(y, periods).length < 12 ? " (open)" : ""}</option>)}
        </SelectField>
        <Segmented label="View" value={view} onChange={(v) => set({ view: v })}
          options={[
            { value: "month", label: "Month" },
            { value: "ytd", label: "Year to date" },
            { value: "year", label: "Full year", disabled: isPartialYear, title: isPartialYear ? `FY${fy} is still open — actuals run to ${monthLabel(actualMonths[actualMonths.length - 1])}` : undefined },
          ]} />
        <SelectField label={view === "ytd" ? "Through" : "Month"} value={month} onChange={(v) => set({ month: v })} minWidth="min-w-[130px]" disabled={view === "year"}>
          {actualMonths.map((p) => <option key={p} value={p}>{monthLabel(p)}</option>)}
        </SelectField>
        <Segmented label="Country" value={country} onChange={(v) => set({ country: v })}
          options={[{ value: "ALL", label: "All" }, ...countryCodes.map((c) => ({ value: c, label: SHORT_NAME[c] || c }))]} />
        <SelectField label="Department" value={department} onChange={(v) => set({ department: v })} minWidth="min-w-[180px]">
          <option value="ALL">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </SelectField>
        <Segmented label="Currency" value={currency} onChange={(v) => set({ currency: v })}
          options={[{ value: "USD", label: "USD" }, { value: "LOCAL", label: "Local" }]} />
      </div>

      {/* Plan source strip */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-950 space-y-1.5">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>
            <strong className="font-semibold">Plan:</strong>{" "}
            {planOpt.source === "snapshot"
              ? `${planOpt.label.replace(/^Snapshot: /, "")} — headcount ×${planOpt.factors.hcFactor.toFixed(3)}, cost ×${planOpt.factors.costGrowth.toFixed(3)} on FY${fy - 1} actuals, split by last year's hours`
              : `FY${fy - 1} actuals per cost center, planned headcount changes and ${Math.round(SAMPLE_INFLATION * 100)}% cost inflation`}
            , spread evenly across 12 months
          </span>
          <span>
            <strong className="font-semibold">Upload:</strong>{" "}
            {upload ? `${upload.fileName} overrides ${uploadResult.costCentersOverridden} cost centers` : "none"}
          </span>
          <span>
            <strong className="font-semibold">Targets:</strong> {targets.source || "Edited"} · default {targets.defaultPct}%
          </span>
          <span><strong className="font-semibold">Showing:</strong> {periodLabel} · {filterLabel}</span>
        </div>
        {currency === "LOCAL" && country === "ALL" && (
          <p className="text-blue-800">Local currency: each country and cost center row is in its own currency; the totals, cards and bridge stay in USD. Pick one country to see everything in its currency.</p>
        )}
        {snapYearNote && <p className="text-blue-800">{snapYearNote}</p>}
        <p className="flex items-start gap-1.5 text-xs text-blue-800">
          <Info size={13} className="mt-0.5 shrink-0" />
          Actual hours are split into holidays, leave and productive time using sample patterns until a timesheet feed is connected.
        </p>
      </div>

      {lines.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-600">
          No cost centers match these filters.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi
              title="Utilization"
              value={pct(total.actualUtil)}
              lines={[
                { text: `Plan ${pct(total.planUtil)} · Target ${pct(total.targetUtil)}` },
                { text: `${pts(gapPlan)} vs plan · ${pts(total.gapToTargetPts)} vs target`, className: `font-semibold ${tone(total.gapToTargetPts >= 0)}` },
              ]}
            />
            <Kpi
              title="Over / under absorption"
              value={money(total.absorption, totalCur, { signed: true })}
              valueClass={tone(total.absorption >= 0)}
              lines={[
                { text: `${signedNum(total.absorptionPct * 100, 1)}% of plan burden cost` },
                {
                  text: total.absorption >= 0 ? "Over-absorbed — actual rate below plan" : "Under-absorbed — actual rate above plan",
                  className: `font-semibold ${tone(total.absorption >= 0)}`,
                },
              ]}
            />
            <Kpi
              title="Cost variance (actual − plan)"
              value={money(total.costVariance, totalCur, { signed: true })}
              valueClass={tone(total.costVariance <= 0)}
              lines={[
                { text: `Plan ${money(total.plan.cost, totalCur)} → Actual ${money(total.actual.cost, totalCur)}` },
                { text: `Volume ${money(total.volume, totalCur, { signed: true })} · Rate ${money(total.rateEffect, totalCur, { signed: true })}`, className: "text-gray-700" },
              ]}
            />
            <Kpi
              title="FTE (average)"
              value={num(total.actual.fte, 1)}
              lines={[
                { text: `Plan ${num(total.plan.fte, 1)} · Headcount ${num(total.actual.headcount, 0)} vs ${num(total.plan.headcount, 0)}` },
                { text: `${signedNum(total.actual.fte - total.plan.fte, 1)} FTE vs plan`, className: "font-semibold text-gray-700" },
              ]}
            />
          </div>

          {total.lineCount > 0 && countryRows.some((c) => c.flagCount > 0) && (
            <div className="flex items-center gap-2 text-sm text-orange-900 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
              <AlertTriangle size={16} />
              {countryRows.reduce((a, c) => a + c.flagCount, 0)} cost centers need review — more than {flagRules.gapPts} points below target, or absorption beyond ±{Math.round(flagRules.absorptionPct * 100)}% of plan.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <CostBridge s={total} cur={totalCur} />
            <UtilizationTrend trend={trend} selectedPeriods={selectedPeriods} fyLabel={`FY${fy}`} />
          </div>

          <VarianceTable
            countries={countryRows}
            total={total}
            totalCur={totalCur}
            flagRules={flagRules}
            onFlagGapChange={(v) => set({ flagGapPts: v })}
            defaultOpen={countryRows.length === 1 ? countryRows[0].code : null}
            onExplain={ai.visible ? (row) => ai.explain({
              name: row.kind === "costCenter" ? `${row.name}` : row.kind === "country" ? row.name : filterLabel,
              scope: row.kind === "costCenter" ? `${row.countryName} · ${row.id}` : row.kind === "country" ? "Country" : "Total",
              periodLabel,
              s: row.s,
              cur: row.cur,
            }) : null}
          />

          <p className="text-xs text-gray-500">
            Plan rate = plan burden cost ÷ plan productive hours. Volume effect = (actual − plan productive hours) × plan rate.
            Rate effect = actual cost − actual hours × plan rate. Absorption = actual hours × plan rate − actual cost (positive = over-absorbed).
            FTE and headcount are monthly averages.
          </p>
        </>
      )}

      {dialog === "upload" && (
        <PlanUploadDialog
          fy={fy}
          current={upload}
          preview={(rows) => applyUploads(basePlan, rows, fy)}
          onApply={applyUpload}
          onRemove={removeUpload}
          onDownloadTemplate={() => downloadText(
            buildPlanTemplateCsv(new Map([...plan].filter(([, p]) => inScope(p.countryCode))), fy),
            `plan-template-FY${fy}.csv`,
          )}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "targets" && (
        <TargetsDialog
          targets={targets}
          costCenters={scopedCostCenters}
          sample={sample}
          onSave={saveTargets}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
