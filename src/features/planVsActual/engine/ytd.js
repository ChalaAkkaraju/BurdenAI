// ytd.js
// Plan vs Actual for the saved plan version and fiscal year, year to date,
// within a country scope. Pure function shared by the dashboard summary and
// the AI features, so all of them use the same numbers as the Plan vs Actual page.

import { fiscalMonths, plannableFiscalYears, availableMonths } from "./fiscal.js";
import { annualByCostCenter, derivePlan, snapshotFactors, applyUploads } from "./plan.js";
import { buildLines, summarize, groupBy, needsReview, DEFAULT_FLAG_RULES } from "./variance.js";
import { sampleTargets } from "./targets.js";

export function computeYtd({ actuals, periods, settings, uploads, storedTargets, snapshots, allowedCountries }) {
  const fys = plannableFiscalYears(periods);
  const fy = fys.includes(settings?.fy) ? settings.fy : fys[0];
  if (!fy) return null;
  const months = fiscalMonths(fy);
  const withActuals = availableMonths(fy, periods);
  const through = withActuals.includes(settings?.month) ? settings.month : withActuals[withActuals.length - 1];
  const periodsYtd = months.slice(0, months.indexOf(through) + 1);

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
  const ytdLines = lines.filter((l) => ytdSet.has(l.period));
  const total = summarize(ytdLines);
  const rules = { ...DEFAULT_FLAG_RULES, gapPts: settings?.flagGapPts || DEFAULT_FLAG_RULES.gapPts };
  const costCenters = [...groupBy(ytdLines, (l) => l.costCenterId).entries()].map(([id, ls]) => {
    const s = summarize(ls);
    return { id, s, flag: needsReview(s, rules), departmentName: ls[0].departmentName, countryCode: ls[0].countryCode, vertical: ls[0].vertical };
  });
  const flagged = costCenters.filter((c) => c.flag).sort((a, b) => a.s.absorption - b.s.absorption);
  const monthly = months.map((p) => ({ period: p, inYtd: ytdSet.has(p), s: summarize(lines.filter((l) => l.period === p)) }));
  return {
    fy, through, months, periodsYtd, lines, ytdLines, total, costCenters, flagged,
    costCenterCount: costCenters.length, monthly, planName, uploadName: upload?.fileName || null, rules,
  };
}
