// usePlanVsActualSummary.js
// Company-wide (within the user's country scope) Plan vs Actual summary for the
// dashboard. Uses the same saved plan version, uploads and targets as the
// Plan vs Actual page, for the fiscal year chosen there, year to date.

import { useMemo } from "react";
import { usePersistedState } from "../../forecast/hooks/usePersistedState.js";
import { useSnapshots } from "../../forecast/hooks/useSnapshots.js";
import { fiscalMonths, plannableFiscalYears, availableMonths } from "../engine/fiscal.js";
import { buildActuals } from "../engine/actuals.js";
import { annualByCostCenter, derivePlan, snapshotFactors, applyUploads } from "../engine/plan.js";
import { buildLines, summarize, groupBy, needsReview, DEFAULT_FLAG_RULES } from "../engine/variance.js";
import { sampleTargets } from "../engine/targets.js";

export function usePlanVsActualSummary({ costData, employeeMap, periods, allowedCountries }) {
  const [settings] = usePersistedState("burdenai_pva_settings", {});
  const [uploads] = usePersistedState("burdenai_pva_uploads", {});
  const [storedTargets] = usePersistedState("burdenai_pva_targets", null);
  const { snapshots } = useSnapshots();

  return useMemo(() => {
    const fys = plannableFiscalYears(periods);
    const fy = fys.includes(settings?.fy) ? settings.fy : fys[0];
    if (!fy) return null;
    const months = fiscalMonths(fy);
    const withActuals = availableMonths(fy, periods);
    const through = withActuals.includes(settings?.month) ? settings.month : withActuals[withActuals.length - 1];
    const periodsYtd = months.slice(0, months.indexOf(through) + 1);

    const actuals = buildActuals({ costData, employeeMap });
    const allCc = [];
    const seen = new Set();
    for (const a of actuals) if (!seen.has(a.costCenterId)) { seen.add(a.costCenterId); allCc.push(a); }
    const targets = storedTargets || sampleTargets(allCc);

    let source = "sample";
    let factors = null;
    let planName = "Sample plan";
    const key = settings?.planKey || "sample";
    if (key.startsWith("snap|")) {
      const [, snapId, scId] = key.split("|");
      const snap = (snapshots || []).find((s) => s.id === snapId);
      const f = snapshotFactors(snap, scId);
      if (f) { source = "snapshot"; factors = f; planName = `${snap.name} — ${f.scenarioName}`; }
    }
    let plan = derivePlan({ priorAnnual: annualByCostCenter(actuals, fy - 1), fy, source, factors });
    const upload = uploads?.[fy];
    if (upload) plan = applyUploads(plan, upload.rows, fy).plan;

    const all = !allowedCountries || allowedCountries.includes("*");
    const lines = buildLines({
      plan,
      actualsByKey: new Map(actuals.map((a) => [a.key, a])),
      periods: months,
      targets,
      filter: (i) => all || allowedCountries.includes(i.countryCode),
    });
    const ytdSet = new Set(periodsYtd);
    const ytd = lines.filter((l) => ytdSet.has(l.period));
    const total = summarize(ytd);
    const rules = { ...DEFAULT_FLAG_RULES, gapPts: settings?.flagGapPts || DEFAULT_FLAG_RULES.gapPts };
    const costCenters = [...groupBy(ytd, (l) => l.costCenterId).entries()].map(([id, ls]) => {
      const s = summarize(ls);
      return { id, s, flag: needsReview(s, rules), departmentName: ls[0].departmentName, countryCode: ls[0].countryCode };
    });
    const flagged = costCenters.filter((c) => c.flag).sort((a, b) => a.s.absorption - b.s.absorption);
    const monthly = months.map((p) => ({ period: p, inYtd: ytdSet.has(p), s: summarize(lines.filter((l) => l.period === p)) }));
    return { fy, through, total, flagged, costCenterCount: costCenters.length, monthly, planName, uploadName: upload?.fileName || null, rules };
  }, [costData, employeeMap, periods, allowedCountries, settings, uploads, storedTargets, snapshots]);
}
