// variance.js
// Plan-vs-actual measures, calculated per cost center per month and then summed.
//
//   plan rate      = plan cost ÷ plan productive hours
//   utilization    = productive hours ÷ available hours
//   cost variance  = actual cost − plan cost
//     = volume effect  (actual hrs − plan hrs) × plan rate
//     + rate effect    actual cost − actual hrs × plan rate   [= (actual rate − plan rate) × actual hrs]
//   absorption     = actual hrs × plan rate − actual cost      (= −rate effect)
//                    positive → over-absorbed, negative → under-absorbed
//
// Because each line satisfies volume + rate = cost variance exactly, any sum
// of lines (a country, a department, the whole company) reconciles too.

export const DEFAULT_TARGET_PCT = 85;

export function resolveTargetPct(targets, costCenterId) {
  const v = targets?.byCostCenter?.[costCenterId];
  if (typeof v === "number" && isFinite(v)) return v;
  const d = targets?.defaultPct;
  return typeof d === "number" && isFinite(d) ? d : DEFAULT_TARGET_PCT;
}

const ZERO = { fte: 0, headcount: 0, available: 0, productive: 0, cost: 0 };

export function buildLine(plan, actual, targetPct) {
  const p = plan || ZERO;
  const a = actual || ZERO;
  const planRate = p.productive > 0 ? p.cost / p.productive : 0;
  const rateEffect = a.cost - a.productive * planRate;
  return {
    plan: { fte: p.fte, headcount: p.headcount, available: p.available, productive: p.productive, cost: p.cost },
    actual: { fte: a.fte, headcount: a.headcount, available: a.available, productive: a.productive, cost: a.cost },
    targetPct,
    volume: (a.productive - p.productive) * planRate,
    rateEffect,
    absorption: -rateEffect,
    costVariance: a.cost - p.cost,
  };
}

// Lines for every cost center × month in `periods`, after filters.
export function buildLines({ plan, actualsByKey, periods, targets, filter = () => true }) {
  const lines = [];
  const ccs = new Map();
  for (const rec of plan.values()) ccs.set(rec.costCenterId, rec);
  for (const a of actualsByKey.values()) if (!ccs.has(a.costCenterId)) ccs.set(a.costCenterId, a);

  for (const info of ccs.values()) {
    if (!filter(info)) continue;
    const targetPct = resolveTargetPct(targets, info.costCenterId);
    for (const period of periods) {
      const key = `${info.costCenterId}|${period}`;
      const p = plan.get(key);
      const a = actualsByKey.get(key);
      if (!p && !a) continue;
      lines.push({
        key,
        period,
        costCenterId: info.costCenterId,
        costCenterName: info.costCenterName,
        departmentId: info.departmentId,
        departmentName: info.departmentName,
        vertical: info.vertical,
        countryCode: info.countryCode,
        source: p?.source ?? "No plan",
        hasActual: !!a,
        ...buildLine(p, a, targetPct),
      });
    }
  }
  return lines;
}

// Sums lines. FTE / headcount are averaged over the months covered.
export function summarize(lines) {
  const s = {
    plan: { fte: 0, headcount: 0, available: 0, productive: 0, cost: 0 },
    actual: { fte: 0, headcount: 0, available: 0, productive: 0, cost: 0 },
    volume: 0, rateEffect: 0, absorption: 0, costVariance: 0,
    targetWeighted: 0, lineCount: lines.length,
  };
  const months = new Set();
  for (const l of lines) {
    months.add(l.period);
    for (const k of ["fte", "headcount", "available", "productive", "cost"]) {
      s.plan[k] += l.plan[k];
      s.actual[k] += l.actual[k];
    }
    s.volume += l.volume;
    s.rateEffect += l.rateEffect;
    s.absorption += l.absorption;
    s.costVariance += l.costVariance;
    s.targetWeighted += l.targetPct * l.actual.available;
  }
  const n = months.size || 1;
  s.months = months.size;
  s.plan.fte /= n; s.plan.headcount /= n;
  s.actual.fte /= n; s.actual.headcount /= n;
  s.planUtil = s.plan.available > 0 ? s.plan.productive / s.plan.available : 0;
  s.actualUtil = s.actual.available > 0 ? s.actual.productive / s.actual.available : 0;
  s.targetUtil = s.actual.available > 0 ? s.targetWeighted / s.actual.available / 100 : 0;
  s.planRate = s.plan.productive > 0 ? s.plan.cost / s.plan.productive : 0;
  s.actualRate = s.actual.productive > 0 ? s.actual.cost / s.actual.productive : 0;
  s.gapToTargetPts = (s.actualUtil - s.targetUtil) * 100;
  s.gapToPlanPts = (s.actualUtil - s.planUtil) * 100;
  s.absorptionPct = s.plan.cost > 0 ? s.absorption / s.plan.cost : 0;
  return s;
}

export function groupBy(lines, keyFn) {
  const m = new Map();
  for (const l of lines) {
    const k = keyFn(l);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(l);
  }
  return m;
}

export const DEFAULT_FLAG_RULES = { gapPts: 5, absorptionPct: 0.03 };

// A summary needs review when utilization is more than `gapPts` below target,
// or absorption is beyond ±`absorptionPct` of plan cost.
export function needsReview(summary, rules = DEFAULT_FLAG_RULES) {
  return summary.gapToTargetPts <= -rules.gapPts || Math.abs(summary.absorptionPct) >= rules.absorptionPct;
}

// Monthly utilization series for the trend chart.
export function monthlyTrend(lines, periods) {
  const byPeriod = groupBy(lines, (l) => l.period);
  return periods.map((period) => {
    const ls = byPeriod.get(period) || [];
    const s = summarize(ls);
    // Target is weighted by actual hours; before actuals exist, weight by plan hours.
    const tgtW = ls.reduce((a, l) => a + l.targetPct * l.plan.available, 0);
    const targetPlanWeighted = s.plan.available > 0 ? tgtW / s.plan.available : 0;
    const hasData = ls.some((l) => l.hasActual);
    return {
      period,
      planUtil: s.planUtil * 100,
      actualUtil: hasData ? s.actualUtil * 100 : null,
      targetUtil: hasData ? s.targetUtil * 100 : targetPlanWeighted,
      hasData,
      hasPlan: ls.length > 0,
    };
  });
}
