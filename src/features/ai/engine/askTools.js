// askTools.js
// Runs the lookup chosen for an "Ask Burden AI" question, with Burden AI's own
// calculations, inside the user's country access. Each lookup returns:
//   title  – what was looked up
//   columns/rows – a small table shown with the answer
//   facts  – the figures sent to the model (the only numbers it may use)
//   how    – one line on how the figures were produced
// Only cost-center and country totals are used — never employee names or pay.

import { summarize } from "../../planVsActual/engine/variance.js";
import { monthLabel } from "../../planVsActual/engine/fiscal.js";
import { money, rate, pct, pts, num } from "../../planVsActual/format.js";
import { buildExplainFacts } from "./explainFacts.js";

const signedPct = (f, d = 1) => (f == null || !isFinite(f) ? "—" : `${f >= 0 ? "+" : "−"}${Math.abs(f * 100).toFixed(d)}%`);

function shift(period, months) {
  const [y, m] = String(period).split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function scopeName(args, ctx) {
  if (args.costCenter) {
    const cc = ctx.costCenters.find((c) => c.id === args.costCenter);
    return cc ? `${cc.departmentName}, ${ctx.countryName(cc.countryCode)} (${cc.id})` : args.costCenter;
  }
  const parts = [];
  if (args.department) parts.push(args.department);
  parts.push(args.country ? ctx.countryName(args.country) : ctx.allLabel);
  return parts.join(", ");
}

function variance(args, ctx) {
  const { ytd } = ctx;
  const lines = ytd.ytdLines.filter((l) =>
    (!args.costCenter || l.costCenterId === args.costCenter) &&
    (!args.country || l.countryCode === args.country) &&
    (!args.department || l.departmentName === args.department));
  const name = scopeName(args, ctx);
  const periodLabel = `FY${ytd.fy} year to date (${monthLabel(ytd.months[0])} – ${monthLabel(ytd.through)})`;
  if (!lines.length) return empty(`Plan vs actual — ${name}`, `No plan-vs-actual lines for ${name}.`);
  const s = summarize(lines);
  const ex = buildExplainFacts({ s, name, scope: "plan vs actual", periodLabel, cur: ctx.USD });
  return {
    title: `Plan vs actual — ${name}, ${periodLabel}`,
    columns: ["Measure", "Plan", "Actual"],
    rows: ex.table.map((r) => [r.label, r.plan, r.actual]),
    facts: ex.facts,
    how: `Plan vs Actual calculation for ${name}, ${periodLabel}, plan version "${ytd.planName}".`,
  };
}

const RANKERS = {
  absorption: { label: "Over / under absorption", value: (s) => s.absorption, fmt: (s) => money(s.absorption, undefined, { signed: true }), worstLow: true },
  gap_to_target: { label: "Utilization vs target", value: (s) => s.gapToTargetPts, fmt: (s) => pts(s.gapToTargetPts), worstLow: true },
  cost_variance: { label: "Cost variance", value: (s) => s.costVariance, fmt: (s) => money(s.costVariance, undefined, { signed: true }), worstLow: false },
  utilization: { label: "Utilization", value: (s) => s.actualUtil, fmt: (s) => pct(s.actualUtil), worstLow: true },
  burden_rate: { label: "Burden rate", value: (s) => s.actualRate, fmt: (s) => rate(s.actualRate), worstLow: false },
};

function rank(args, ctx) {
  const r = RANKERS[args.metric] || RANKERS.absorption;
  const pool = ctx.ytd.costCenters.filter((c) =>
    (!args.country || c.countryCode === args.country) && (!args.department || c.departmentName === args.department));
  const asc = (args.order === "worst") === r.worstLow;
  const sorted = [...pool].sort((a, b) => (asc ? r.value(a.s) - r.value(b.s) : r.value(b.s) - r.value(a.s))).slice(0, args.limit);
  const where = args.country ? ctx.countryName(args.country) : ctx.allLabel;
  const title = `${args.order === "worst" ? "Weakest" : "Strongest"} cost centers by ${r.label.toLowerCase()} — ${where}${args.department ? `, ${args.department}` : ""}, FY${ctx.ytd.fy} to ${monthLabel(ctx.ytd.through)}`;
  if (!sorted.length) return empty(title, "No cost centers match.");
  return {
    title,
    columns: ["#", "Cost center", "Country", r.label, ...(args.metric === "utilization" ? [] : ["Utilization"]), ...(args.metric === "absorption" ? [] : ["Absorption"])],
    rows: sorted.map((c, i) => [String(i + 1), `${c.departmentName} (${c.id})`, ctx.countryName(c.countryCode), r.fmt(c.s),
      ...(args.metric === "utilization" ? [] : [pct(c.s.actualUtil)]),
      ...(args.metric === "absorption" ? [] : [money(c.s.absorption, undefined, { signed: true })])]),
    facts: [
      `Ranking: ${title}; ${sorted.length} shown of ${pool.length} cost centers`,
      ...sorted.map((c, i) => `#${i + 1} ${c.departmentName} in ${ctx.countryName(c.countryCode)} (${c.id}): ${r.label.toLowerCase()} ${r.fmt(c.s)}; utilization ${pct(c.s.actualUtil)} vs target ${pct(c.s.targetUtil)} (${pts(c.s.gapToTargetPts)}); absorption ${money(c.s.absorption, undefined, { signed: true })}`),
    ],
    how: `Every cost center in scope ranked on ${r.label.toLowerCase()} from the Plan vs Actual calculation.`,
  };
}

function monthlyTotals(ctx, country) {
  const by = new Map();
  for (const a of ctx.actuals) {
    if (!ctx.inScope(a.countryCode) || (country && a.countryCode !== country)) continue;
    const g = by.get(a.period) || { period: a.period, cost: 0, paid: 0, headcount: 0 };
    g.cost += a.cost; g.paid += a.paid; g.headcount += a.headcount;
    by.set(a.period, g);
  }
  return by;
}

function burdenTrend(args, ctx) {
  const by = monthlyTotals(ctx, args.country);
  const periods = [...by.keys()].sort().slice(-args.months);
  const where = args.country ? ctx.countryName(args.country) : ctx.allLabel;
  if (!periods.length) return empty(`Burden cost trend — ${where}`, "No data.");
  const first = by.get(periods[0]);
  const last = by.get(periods[periods.length - 1]);
  const rows = periods.map((p) => { const g = by.get(p); return [monthLabel(p), money(g.cost), num(g.headcount), rate(g.cost / g.paid)]; });
  return {
    title: `Burden cost trend — ${where}, ${monthLabel(periods[0])} to ${monthLabel(periods[periods.length - 1])}`,
    columns: ["Month", "Burden cost", "Headcount", "Burden rate"],
    rows,
    facts: [
      `Burden cost: ${money(first.cost)} in ${monthLabel(periods[0])}, ${money(last.cost)} in ${monthLabel(periods[periods.length - 1])} (${signedPct(last.cost / first.cost - 1)})`,
      `Headcount: ${num(first.headcount)} then ${num(last.headcount)}`,
      `Burden rate per paid hour: ${rate(first.cost / first.paid)} then ${rate(last.cost / last.paid)} (${signedPct((last.cost / last.paid) / (first.cost / first.paid) - 1)})`,
      ...rows.map((r) => `${r[0]}: cost ${r[1]}, headcount ${r[2]}, rate ${r[3]}`),
    ],
    how: `Monthly totals of the cost records for ${where}. Burden rate = burden cost ÷ paid hours.`,
  };
}

function burdenByCountry(args, ctx) {
  const latest = ctx.latestMonth;
  const prior = shift(latest, -12);
  const by = new Map();
  for (const a of ctx.actuals) {
    if (!ctx.inScope(a.countryCode) || (a.period !== latest && a.period !== prior)) continue;
    const g = by.get(a.countryCode) || { now: { cost: 0, paid: 0, hc: 0 }, before: { cost: 0, paid: 0, hc: 0 } };
    const t = a.period === latest ? g.now : g.before;
    t.cost += a.cost; t.paid += a.paid; t.hc += a.headcount;
    by.set(a.countryCode, g);
  }
  const list = [...by.entries()].filter(([, g]) => g.now.cost > 0).sort((x, y) => y[1].now.cost - x[1].now.cost);
  const total = list.reduce((s, [, g]) => s + g.now.cost, 0);
  return {
    title: `Burden cost by country — ${monthLabel(latest)}`,
    columns: ["Country", "Burden cost", "vs " + monthLabel(prior), "Headcount", "Burden rate"],
    rows: list.map(([c, g]) => [ctx.countryName(c), money(g.now.cost), g.before.cost ? signedPct(g.now.cost / g.before.cost - 1) : "—", num(g.now.hc), rate(g.now.cost / g.now.paid)]),
    facts: [
      `Total burden cost in ${monthLabel(latest)}: ${money(total)} across ${list.length} countries`,
      ...list.map(([c, g]) => `${ctx.countryName(c)}: ${money(g.now.cost)} (${g.before.cost ? signedPct(g.now.cost / g.before.cost - 1) : "no prior year"} vs ${monthLabel(prior)}), headcount ${num(g.now.hc)}, burden rate ${rate(g.now.cost / g.now.paid)}, ${pct(g.now.cost / total)} of total`),
    ],
    how: `Cost records for ${monthLabel(latest)} and ${monthLabel(prior)}, totalled by country.`,
  };
}

function forecastTool(args, ctx) {
  const f = ctx.getForecast ? ctx.getForecast() : ctx.forecast;
  if (!f) return empty("Forecast", "The forecast covers every country, so Ask can only answer it for users with access to all countries.");
  const rows = f.scenarios.map((s) => [s.name, money(s.total), signedPct(s.total / f.baselineTotal - 1), rate(s.rate)]);
  if (f.learned) rows.push(["Learned trend model", money(f.learned.total), signedPct(f.learned.total / f.baselineTotal - 1), `range ${money(f.learned.low)} – ${money(f.learned.high)}`]);
  return {
    title: `Burden cost forecast for ${f.targetLabel} (monthly, company-wide)`,
    columns: ["Scenario", "Forecast burden cost", `vs ${f.baselineLabel}`, "Rate / range"],
    rows,
    facts: [
      `Baseline: ${money(f.baselineTotal)} burden cost in ${f.baselineLabel}`,
      ...f.scenarios.map((s) => `${s.name} scenario for ${f.targetLabel}: ${money(s.total)} (${signedPct(s.total / f.baselineTotal - 1)}), burden rate ${rate(s.rate)}`),
      ...(f.learned ? [`Learned trend model for ${f.targetLabel}: ${money(f.learned.total)}, 80% range ${money(f.learned.low)} – ${money(f.learned.high)}, fitted on ${f.learned.months} months of history`] : []),
    ],
    how: "Driver scenarios from the Forecast page; learned forecast from a seasonal trend model fitted on monthly history.",
  };
}

function anomaliesTool(args, ctx) {
  const list = (ctx.anomalies || []).filter((a) => !args.country || a.countryCode === args.country);
  const title = `Unusual this month — ${monthLabel(ctx.latestMonth)}`;
  if (!list.length) {
    return { title, columns: ["Result"], rows: [["Nothing unusual"]], facts: [`No cost center has an unusual burden rate, cost per FTE or utilization in ${monthLabel(ctx.latestMonth)}`], how: "Each cost center compared with its own history." };
  }
  const fmt = (a, v) => (a.kind === "pct" ? `${v.toFixed(1)}%` : a.measure === "rate" ? rate(v) : money(v));
  return {
    title,
    columns: ["Cost center", "Country", "Measure", "This month", "Expected"],
    rows: list.slice(0, 8).map((a) => [`${a.departmentName} (${a.costCenterId})`, ctx.countryName(a.countryCode), a.measureLabel, fmt(a, a.value), fmt(a, a.expected)]),
    facts: list.slice(0, 8).map((a) => `${a.departmentName} in ${ctx.countryName(a.countryCode)} (${a.costCenterId}): ${a.measureLabel.toLowerCase()} ${fmt(a, a.value)} vs about ${fmt(a, a.expected)} expected from its own history (${a.direction === "up" ? "higher" : "lower"} than normal${a.unfavourable ? ", unfavourable" : ", favourable"})`),
    how: "Each cost center's burden rate, cost per FTE and utilization compared with its own last 12 months and the same month last year.",
  };
}

function empty(title, msg) {
  return { title, columns: ["Result"], rows: [[msg]], facts: [msg], how: "" };
}

export function runAskTool(plan, ctx) {
  switch (plan.tool) {
    case "variance": return variance(plan, ctx);
    case "rank": return rank(plan, ctx);
    case "burden_trend": return burdenTrend(plan, ctx);
    case "burden_by_country": return burdenByCountry(plan, ctx);
    case "forecast": return forecastTool(plan, ctx);
    case "anomalies": return anomaliesTool(plan, ctx);
    default: return null;
  }
}

