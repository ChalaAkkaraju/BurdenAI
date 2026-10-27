// askCatalog.js
// The fixed lookups "Ask Burden AI" can use. The model only chooses one of
// these and its arguments; the lookup itself runs in Burden AI's own
// calculations (askTools.js), inside the user's country access.

export const ASK_TOOLS = [
  {
    name: "variance",
    description: "Plan vs actual for the current fiscal year to date: utilization vs plan and target, burden cost, burden rate, volume and rate effects, over/under absorption. For the whole company, one country, one department, or one cost center.",
  },
  {
    name: "rank",
    description: "Rank cost centers on a plan-vs-actual measure, fiscal year to date: absorption, gap_to_target (utilization points vs target), cost_variance, utilization, or burden_rate. Use for 'which', 'top', 'worst', 'best', 'most', 'least' questions.",
  },
  {
    name: "burden_trend",
    description: "Monthly burden cost, headcount and burden rate (cost per paid hour) for the last N months, for the company or one country. Use for trend, history, 'how has it changed' questions.",
  },
  {
    name: "burden_by_country",
    description: "Latest month burden cost, headcount and burden rate by country, with change vs the same month last year.",
  },
  {
    name: "forecast",
    description: "Next year's burden cost forecast: the driver scenarios (Base, High inflation, Conservative) and the learned trend forecast with its range.",
  },
  {
    name: "anomalies",
    description: "Cost centers with unusual burden rate, cost per FTE or utilization in the latest month compared with their own history.",
  },
  {
    name: "none",
    description: "The question cannot be answered from these lookups (for example it asks about individual employees, pay, or something outside burden cost, utilization and forecasts).",
  },
];

// "Pick agent" in Ask Burden AI: each agent may use only its own lookups.
// "auto" is the orchestrator: it reads the question and routes it to the
// specialist agent whose job it is; that agent then picks its own lookup.
export const AGENTS = [
  { id: "auto", label: "Auto (orchestrator)", tools: null },
  { id: "utilization", label: "Utilization agent", tools: ["variance", "rank"], job: "plan vs actual, utilization, targets, absorption, cost variance by cost center, department or country" },
  { id: "burden", label: "Burden cost agent", tools: ["burden_trend", "burden_by_country"], job: "actual burden cost, burden rate and headcount: trends over months and comparisons by country" },
  { id: "forecast", label: "Forecast agent", tools: ["forecast"], job: "next year's forecast: driver scenarios and the learned trend forecast" },
  { id: "anomalies", label: "Anomaly agent", tools: ["anomalies"], job: "unusual months: cost centers outside their normal range" },
];

export function agentOfTool(tool) {
  return AGENTS.find((a) => a.tools && a.tools.includes(tool))?.id || null;
}

export function allowedTools(ctx) {
  const list = Array.isArray(ctx?.tools) && ctx.tools.length ? ctx.tools : null;
  return list ? ASK_TOOLS.filter((t) => list.includes(t.name) || t.name === "none") : ASK_TOOLS;
}

export const RANK_METRICS = ["absorption", "gap_to_target", "cost_variance", "utilization", "burden_rate"];

export const PLAN_SCHEMA = {
  type: "object",
  properties: {
    agent: { type: "string", enum: [...AGENTS.filter((a) => a.tools).map((a) => a.id), "none"], description: "The specialist agent the orchestrator routes the question to" },
    tool: { type: "string", enum: ASK_TOOLS.map((t) => t.name) },
    country: { type: ["string", "null"], description: "Country code from the allowed list, or null for all" },
    department: { type: ["string", "null"], description: "Department name from the allowed list, or null" },
    costCenter: { type: ["string", "null"], description: "Cost center id from the allowed list, or null" },
    metric: { type: ["string", "null"], enum: [...RANK_METRICS, null] },
    order: { type: ["string", "null"], enum: ["worst", "best", null] },
    limit: { type: ["integer", "null"] },
    months: { type: ["integer", "null"] },
  },
  required: ["agent", "tool", "country", "department", "costCenter", "metric", "order", "limit", "months"],
};

// A simple keyword router, used by the test model and as a fallback when the
// real model's choice cannot be read.
export function keywordPlan(question, ctx) {
  const q = String(question || "").toLowerCase();
  const country = (ctx?.countries || []).find((c) => q.includes(c.name.toLowerCase()) || new RegExp(`\\b${c.code.toLowerCase()}\\b`).test(q));
  const department = (ctx?.departments || []).find((d) => q.includes(d.toLowerCase()));
  let tool = "variance";
  let metric = null;
  if (/forecast|next year|projection|scenario/.test(q)) tool = "forecast";
  else if (/unusual|anomal|odd|strange|spike/.test(q)) tool = "anomalies";
  else if (/trend|history|over time|changed|last \d+ months|monthly/.test(q)) tool = "burden_trend";
  else if (/by country|each country|countries/.test(q) && !country) tool = "burden_by_country";
  else if (/which|top|worst|best|most|least|highest|lowest|rank/.test(q)) tool = "rank";
  if (tool === "rank") {
    if (/utili[sz]ation|below target|gap/.test(q)) metric = "gap_to_target";
    else if (/rate/.test(q)) metric = "burden_rate";
    else if (/cost variance|over budget|overspen/.test(q)) metric = "cost_variance";
    else metric = "absorption";
  }
  const only = Array.isArray(ctx?.tools) && ctx.tools.length ? ctx.tools : null;
  if (only && !only.includes(tool)) {
    tool = only.includes("rank") && /which|top|worst|best|most|least|highest|lowest|rank/.test(q) ? "rank" : only[0];
    if (tool === "rank" && !metric) metric = "absorption";
  }
  const order = /best|least|lowest|over-absorbed|favourable|favorable/.test(q) ? "best" : "worst";
  return { tool, country: country?.code || null, department: department || null, costCenter: null, metric, order, limit: 5, months: 12 };
}

// Keeps the model's choice inside the allowed values; anything else becomes null.
export function sanitizePlan(raw, ctx) {
  const p = raw && typeof raw === "object" ? raw : {};
  const allowed = allowedTools(ctx);
  let tool = allowed.some((t) => t.name === p.tool) ? p.tool : "none";
  // A picked agent with a single lookup always uses it.
  if (tool === "none" && allowed.length === 2 && p.tool && p.tool !== "none") tool = allowed[0].name;
  const countryCodes = (ctx?.countries || []).map((c) => c.code);
  const findCountry = (v) => {
    if (!v) return null;
    const s = String(v).trim().toLowerCase();
    const hit = (ctx?.countries || []).find((c) => c.code.toLowerCase() === s || c.name.toLowerCase() === s);
    return hit ? hit.code : null;
  };
  const dept = p.department && (ctx?.departments || []).find((d) => d.toLowerCase() === String(p.department).toLowerCase());
  const cc = p.costCenter && (ctx?.costCenters || []).find((c) => c.id.toLowerCase() === String(p.costCenter).toLowerCase());
  const clampInt = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Math.round(Number(v)))) : d);
  return {
    agent: agentOfTool(tool),
    tool,
    country: countryCodes.length ? findCountry(p.country) : null,
    department: dept || null,
    costCenter: cc ? cc.id : null,
    metric: RANK_METRICS.includes(p.metric) ? p.metric : "absorption",
    order: p.order === "best" ? "best" : "worst",
    limit: clampInt(p.limit, 1, 10, 5),
    months: clampInt(p.months, 3, 24, 12),
  };
}
