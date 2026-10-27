// plan.js
// Builds the plan for a fiscal year, per cost center per month.
//
// Every plan starts from the PRIOR fiscal year's actuals for each cost center
// (annual totals), then applies factors:
//   plan FTE / headcount / hours = prior × headcount factor
//   plan productive hours        = plan available × plan utilization
//   plan burden cost             = prior cost × headcount factor × rate factor
//   plan rate                    = plan cost ÷ plan productive hours
// The annual plan is then spread EVENLY across the 12 months.
//
// Sources:
//   - "sample":   a built-in budget — per-cost-center headcount change (−6%..+8%),
//                 a small utilization stretch, and 3% cost inflation.
//   - "snapshot": a saved Forecast snapshot scenario — its headcount and total-cost
//                 growth applied uniformly, so the split across countries and cost
//                 centers follows last year's actual hours.
//   - uploads:    plan CSV rows override individual cost centers / months.

import { fiscalMonths } from "./fiscal.js";
import { between } from "./hash.js";

export const SAMPLE_INFLATION = 0.03;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Sum a fiscal year of actuals per cost center.
export function annualByCostCenter(actuals, fy) {
  const months = new Set(fiscalMonths(fy));
  const map = new Map();
  for (const a of actuals) {
    if (!months.has(a.period)) continue;
    let t = map.get(a.costCenterId);
    if (!t) {
      t = {
        costCenterId: a.costCenterId,
        costCenterName: a.costCenterName,
        departmentId: a.departmentId,
        departmentName: a.departmentName,
        vertical: a.vertical,
        countryCode: a.countryCode,
        paid: 0, available: 0, productive: 0, cost: 0, fteMonths: 0, headcountMonths: 0, months: 0,
      };
      map.set(a.costCenterId, t);
    }
    t.paid += a.paid;
    t.available += a.available;
    t.productive += a.productive;
    t.cost += a.cost;
    t.fteMonths += a.fte;
    t.headcountMonths += a.headcount;
    t.months += 1;
  }
  for (const t of map.values()) {
    t.fte = t.months ? t.fteMonths / t.months : 0;
    t.headcount = t.months ? t.headcountMonths / t.months : 0;
  }
  return map;
}

// Factors from a Forecast snapshot scenario. Returns null when the snapshot
// does not carry enough numbers to build a plan.
export function snapshotFactors(snapshot, scenarioId) {
  if (!snapshot || !snapshot.baseline) return null;
  const sc = (snapshot.scenarios || []).find((s) => s.id === (scenarioId || snapshot.activeScenarioId))
    || (snapshot.scenarios || [])[0];
  const { totalBurden, headcount } = snapshot.baseline;
  if (!sc || !(totalBurden > 0) || !(headcount > 0) || !(sc.forecastedTotal > 0) || !(sc.forecastedHeadcount > 0)) {
    return null;
  }
  const hcFactor = sc.forecastedHeadcount / headcount;
  const costGrowth = sc.forecastedTotal / totalBurden;
  return {
    scenarioId: sc.id,
    scenarioName: sc.name,
    hcFactor,
    rateFactor: costGrowth / hcFactor,
    costGrowth,
  };
}

// Builds the plan map: key "costCenterId|period" → plan record.
export function derivePlan({ priorAnnual, fy, source, factors }) {
  const months = fiscalMonths(fy);
  const plan = new Map();
  for (const p of priorAnnual.values()) {
    let hc;
    let utilStretch;
    let rateFactor;
    let label;
    if (source === "snapshot") {
      hc = factors.hcFactor;
      utilStretch = 0;
      rateFactor = factors.rateFactor;
      label = "From snapshot";
    } else {
      hc = 1 + between(`plan-hc|${p.costCenterId}|${fy}`, -0.06, 0.08);
      utilStretch = between(`plan-util|${p.costCenterId}|${fy}`, -0.01, 0.025);
      rateFactor = 1 + SAMPLE_INFLATION;
      label = "Sample plan";
    }
    const priorUtil = p.available > 0 ? p.productive / p.available : 0;
    const util = clamp(priorUtil + utilStretch, 0, 0.98);
    const annual = {
      fte: p.fte * hc,
      headcount: p.headcount * hc,
      paid: p.paid * hc,
      available: p.available * hc,
      cost: p.cost * hc * rateFactor,
    };
    annual.productive = annual.available * util;
    for (const period of months) {
      plan.set(`${p.costCenterId}|${period}`, {
        costCenterId: p.costCenterId,
        costCenterName: p.costCenterName,
        departmentId: p.departmentId,
        departmentName: p.departmentName,
        vertical: p.vertical,
        countryCode: p.countryCode,
        period,
        source: label,
        fte: annual.fte,
        headcount: annual.headcount,
        paid: annual.paid / 12,
        available: annual.available / 12,
        productive: annual.productive / 12,
        cost: annual.cost / 12,
      });
    }
  }
  return plan;
}

// Applies uploaded plan rows on top of a plan map. A row's Period is either
// "YYYY-MM" (one month) or "FY2026" (a full year, spread evenly). Blank number
// fields keep the derived value. Returns { plan, applied, skipped }.
export function applyUploads(plan, rows, fy) {
  const months = fiscalMonths(fy);
  const monthSet = new Set(months);
  const next = new Map(plan);
  let applied = 0;
  const skipped = [];
  const touched = new Set();

  for (const row of rows || []) {
    const isYear = /^FY\d{4}$/i.test(row.period);
    let targets;
    if (isYear) {
      if (Number(row.period.slice(2)) !== fy) continue; // another year — not for this plan
      targets = months;
    } else if (monthSet.has(row.period)) {
      targets = [row.period];
    } else {
      continue; // outside this fiscal year
    }
    const anyKey = `${row.costCenter}|${months[0]}`;
    if (!plan.has(anyKey)) {
      skipped.push({ ...row, reason: "Unknown cost center" });
      continue;
    }
    const div = isYear ? 12 : 1;
    for (const period of targets) {
      const key = `${row.costCenter}|${period}`;
      const base = next.get(key);
      const rec = { ...base, source: "Uploaded" };
      if (row.headcount != null) rec.headcount = row.headcount;
      if (row.fte != null) rec.fte = row.fte;
      if (row.available != null) rec.available = row.available / div;
      if (row.productive != null) rec.productive = row.productive / div;
      if (row.cost != null) rec.cost = row.cost / div;
      // Keep productive ≤ available if only one of them was uploaded.
      if (rec.productive > rec.available) rec.productive = rec.available;
      next.set(key, rec);
    }
    touched.add(row.costCenter);
    applied += 1;
  }
  return { plan: next, applied, skipped, costCentersOverridden: touched.size };
}
