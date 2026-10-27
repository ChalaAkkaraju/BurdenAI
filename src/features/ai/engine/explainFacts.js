// explainFacts.js
// Turns a Plan vs Actual summary (from variance.js `summarize`) into the
// figures an explanation may use. The same figures are:
//   - shown under the explanation as the source of truth,
//   - sent to the model as the only numbers it may quote,
//   - used for the number check, and
//   - used to write a plain explanation when AI is off or its text fails the check.
// Only totals are used — never employee names or pay.

import { money, rate, pct, pts, num, signedNum } from "../../planVsActual/format.js";

const pctChange = (a, b) => (b ? (a - b) / b : 0);
const signedPct = (f, d = 1) => `${f >= 0 ? "+" : "−"}${Math.abs(f * 100).toFixed(d)}%`;

export function buildExplainFacts({ s, name, scope, periodLabel, cur }) {
  const p = s.plan;
  const a = s.actual;
  const fteDiff = a.fte - p.fte;
  const availChg = pctChange(a.available, p.available);
  const prodChg = pctChange(a.productive, p.productive);
  const costChg = pctChange(a.cost, p.cost);
  const rateChg = pctChange(s.actualRate, s.planRate);
  const under = s.absorption < 0;

  // What absorption would have been at the target, on today's available hours.
  let whatIf = null;
  if (s.gapToTargetPts < 0 && s.targetUtil > 0 && s.planRate > 0) {
    const prodAtTarget = a.available * s.targetUtil;
    whatIf = { absorption: prodAtTarget * s.planRate - a.cost, productive: prodAtTarget };
  }

  const F = {
    planFte: num(p.fte, 1), actualFte: num(a.fte, 1), fteDiff: signedNum(fteDiff, 1), fteDiffPct: signedPct(pctChange(a.fte, p.fte)),
    planAvail: num(p.available, 0), actualAvail: num(a.available, 0), availChg: signedPct(availChg),
    planProd: num(p.productive, 0), actualProd: num(a.productive, 0), prodChg: signedPct(prodChg),
    planUtil: pct(s.planUtil), actualUtil: pct(s.actualUtil), targetUtil: pct(s.targetUtil, 1),
    gapPlan: pts(s.gapToPlanPts), gapTarget: pts(s.gapToTargetPts),
    planCost: money(p.cost, cur), actualCost: money(a.cost, cur), costChg: signedPct(costChg),
    planRate: rate(s.planRate, cur), actualRate: rate(s.actualRate, cur), rateChg: signedPct(rateChg),
    volume: money(s.volume, cur, { signed: true }), rateEffect: money(s.rateEffect, cur, { signed: true }),
    costVariance: money(s.costVariance, cur, { signed: true }),
    absorption: money(s.absorption, cur, { signed: true }), absorptionAbs: money(Math.abs(s.absorption), cur),
    absorptionPct: signedPct(s.absorptionPct),
    whatIf: whatIf ? money(whatIf.absorption, cur, { signed: true }) : null,
  };

  const table = [
    { label: "FTE (average)", plan: F.planFte, actual: F.actualFte },
    { label: "Available hours", plan: F.planAvail, actual: F.actualAvail },
    { label: "Productive hours", plan: F.planProd, actual: F.actualProd },
    { label: "Utilization", plan: F.planUtil, actual: F.actualUtil },
    { label: "Utilization target", plan: F.targetUtil, actual: F.gapTarget },
    { label: "Burden cost", plan: F.planCost, actual: F.actualCost },
    { label: "Burden rate", plan: F.planRate, actual: F.actualRate },
    { label: "Volume effect", plan: "", actual: F.volume },
    { label: "Rate effect", plan: "", actual: F.rateEffect },
    { label: "Over / under absorption", plan: "", actual: `${F.absorption} (${F.absorptionPct} of plan)` },
  ];

  // Facts as "label: value" lines, the only figures the model may use.
  const facts = [
    `Subject: ${name} (${scope}), ${periodLabel}`,
    `Average FTE: plan ${F.planFte}, actual ${F.actualFte}, difference ${F.fteDiff} (${F.fteDiffPct})`,
    `Available hours: plan ${F.planAvail}, actual ${F.actualAvail} (${F.availChg})`,
    `Productive hours: plan ${F.planProd}, actual ${F.actualProd} (${F.prodChg})`,
    `Utilization: plan ${F.planUtil}, actual ${F.actualUtil}, target ${F.targetUtil}; ${F.gapPlan} vs plan, ${F.gapTarget} vs target`,
    `Burden cost: plan ${F.planCost}, actual ${F.actualCost} (${F.costChg})`,
    `Burden rate per productive hour: plan ${F.planRate}, actual ${F.actualRate} (${F.rateChg})`,
    `Cost variance (actual − plan): ${F.costVariance} = volume effect ${F.volume} + rate effect ${F.rateEffect}`,
    `Absorption: ${F.absorption} (${F.absorptionPct} of plan cost) — ${under ? "under-absorbed (actual rate above plan)" : "over-absorbed (actual rate below plan)"}`,
    whatIf ? `If utilization had been at the ${F.targetUtil} target on the actual available hours, absorption would have been ${F.whatIf}` : null,
  ].filter(Boolean);

  return { F, table, facts, under, whatIf, fallback: fallbackExplanation(F, { under, whatIf, s, fteDiff }) };
}

// A plain explanation written from the figures by rules — used when AI is off,
// unreachable, or its text fails the number check.
function fallbackExplanation(F, { under, whatIf, s, fteDiff }) {
  const headline = `${under ? "Under-absorbed" : "Over-absorbed"} by ${F.absorptionAbs} (${F.absorptionPct} of plan): the actual burden rate was ${F.actualRate} against ${F.planRate} planned.`;
  const points = [];
  if (Math.abs(fteDiff) >= 0.05) {
    points.push({
      title: fteDiff > 0 ? "Headcount ran ahead of plan." : "Headcount ran behind plan.",
      text: `${F.actualFte} FTE vs ${F.planFte} planned (${F.fteDiff}, ${F.fteDiffPct}), so available hours were ${F.actualAvail} vs ${F.planAvail} (${F.availChg}).`,
    });
  }
  points.push({
    title: s.gapToPlanPts < 0 ? "Utilization slipped." : "Utilization improved.",
    text: `${F.actualUtil} vs ${F.planUtil} planned (${F.gapPlan}) and ${F.gapTarget} against the ${F.targetUtil} target, so productive hours were ${F.actualProd} vs ${F.planProd} (${F.prodChg}).`,
  });
  points.push({
    title: "How it adds up.",
    text: `Cost was ${F.actualCost} vs ${F.planCost} plan. Volume ${F.volume} (the hour difference at plan rate) + rate ${F.rateEffect} = ${F.costVariance} cost variance. The rate part is the ${under ? "under" : "over"}-absorption.`,
  });
  const checks = [];
  if (fteDiff > 0.05) checks.push("Were the extra FTE planned hires that started early, or unplanned backfills?");
  if (fteDiff < -0.05) checks.push("Are open roles or delayed hires behind the lower headcount?");
  if (s.gapToTargetPts < 0) checks.push("Is training, onboarding or bench time pulling utilization below target?");
  if (whatIf) checks.push(`At the ${F.targetUtil} target on today's hours, absorption would be ${F.whatIf}.`);
  if (!checks.length) checks.push("Is the favourable rate expected to hold for the rest of the year?");
  return { headline, points, checks };
}
