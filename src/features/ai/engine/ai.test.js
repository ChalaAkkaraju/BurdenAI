import { describe, it, expect } from "vitest";
import { extractNumbers, checkNumbers } from "./numberCheck.js";
import { buildExplainFacts } from "./explainFacts.js";
import { detectAnomalies } from "./anomalies.js";
import { fitHoltWinters, learnedForecast, predict } from "./holtWinters.js";
import { keywordPlan, sanitizePlan } from "./askCatalog.js";
import { runAskTool } from "./askTools.js";
import { summarize, buildLine } from "../../planVsActual/engine/variance.js";
import { createAiHandler } from "../../../../server/ai/handler.js";

describe("number check", () => {
  it("reads money, percent, points and plain numbers", () => {
    const n = extractNumbers("Under by −$131.9K (−3.1% of plan), 35.4 FTE vs 33.3, −2.6 pts, 32,623 hours, $170.18/hr");
    expect(n.map((x) => x.canon)).toEqual(["131.9K", "3.1%", "35.4", "33.3", "2.6pts", "32623", "170.18"]);
  });
  it("ignores fiscal-year labels and accepts years and small counts", () => {
    expect(checkNumbers("In FY2027 to Sep 2026, 3 cost centers", ["nothing"]).ok).toBe(true);
  });
  it("accepts figures from the facts and rejects new ones", () => {
    const facts = ["Absorption: −$131.9K (−3.1% of plan cost)", "Utilization 80.9%, gap −2.6 pts"];
    expect(checkNumbers("Under-absorbed by $131.9K, 3.1% of plan; utilization 80.9% (2.6 pts down)", facts).ok).toBe(true);
    const bad = checkNumbers("Under-absorbed by about $132K, or 80.9%", facts);
    expect(bad.ok).toBe(false);
    expect(bad.bad).toEqual(["$132K"]);
  });
});

const line = (p, a) => buildLine(p, a, 82);
const S = summarize([{ period: "2026-04", ...line(
  { fte: 33.3, headcount: 34, available: 30770, productive: 25688, cost: 4_243_000 },
  { fte: 35.4, headcount: 36, available: 32623, productive: 26402, cost: 4_493_000 },
) }]);

describe("explanation facts", () => {
  it("builds a fallback explanation whose numbers all come from the facts", () => {
    const ex = buildExplainFacts({ s: S, name: "Product & Design", scope: "United States", periodLabel: "FY2027 YTD" });
    expect(ex.under).toBe(true);
    const text = [ex.fallback.headline, ...ex.fallback.points.map((p) => `${p.title} ${p.text}`), ...ex.fallback.checks].join("\n");
    expect(checkNumbers(text, ex.facts)).toEqual({ ok: true, bad: [] });
    expect(ex.whatIf).not.toBeNull();
  });
});

function series(n, f) {
  return Array.from({ length: n }, (_, i) => f(i));
}

describe("anomalies", () => {
  const periods = series(40, (i) => {
    const d = new Date(Date.UTC(2023, i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const mk = (cost) => periods.map((p, i) => ({
    costCenterId: "CC1", departmentName: "Ops", countryCode: "US", period: p,
    cost: cost(i, p), fte: 10, productive: 1500 + (i % 3), available: 1800,
  }));
  it("does not flag a steady series with a yearly January step", () => {
    const rows = mk((i, p) => 100000 * (1 + 0.03 * Math.floor(i / 12)) * (p.endsWith("-01") ? 1 : 1) + (i % 5) * 50);
    expect(detectAnomalies({ actuals: rows, period: periods[39] })).toEqual([]);
  });
  it("flags a sudden jump in cost", () => {
    const rows = mk((i) => 100000 * (1 + 0.002 * i) * (i === 39 ? 1.2 : 1) + (i % 5) * 50);
    const found = detectAnomalies({ actuals: rows, period: periods[39] });
    expect(found.map((a) => a.measure)).toContain("rate");
    expect(found[0].direction).toBe("up");
    expect(found[0].unfavourable).toBe(true);
  });
});

describe("learned forecast (Holt-Winters)", () => {
  const seasonal = (i) => (1000 + 5 * i) * (1 + 0.1 * Math.sin((2 * Math.PI * i) / 12));
  it("recovers a clean trend + seasonal series", () => {
    const y = series(60, seasonal);
    const m = fitHoltWinters(y);
    const f = predict(m, 12);
    for (let k = 0; k < 12; k++) expect(Math.abs(f[k] / seasonal(60 + k) - 1)).toBeLessThan(0.02);
  });
  it("gives a range around the forecast and needs enough history", () => {
    const lf = learnedForecast(series(60, (i) => seasonal(i) * (1 + ((i * 7) % 5 - 2) / 200)), 12);
    expect(lf.range[11].low).toBeLessThan(lf.path[11]);
    expect(lf.range[11].high).toBeGreaterThan(lf.path[11]);
    expect(learnedForecast(series(20, seasonal))).toBeNull();
  });
});

describe("ask lookups", () => {
  const ctx = {
    countries: [{ code: "US", name: "United States" }, { code: "DE", name: "Germany" }],
    departments: ["Logistics", "R&D Lab"],
    costCenters: [{ id: "CC-1", departmentName: "Logistics", countryCode: "US" }],
  };
  it("keyword routing picks sensible lookups", () => {
    expect(keywordPlan("Which cost centers are most under-absorbed?", ctx).tool).toBe("rank");
    expect(keywordPlan("How has burden cost changed over the last 12 months in Germany?", ctx)).toMatchObject({ tool: "burden_trend", country: "DE" });
    expect(keywordPlan("What does next year's forecast look like?", ctx).tool).toBe("forecast");
    expect(keywordPlan("Anything unusual this month?", ctx).tool).toBe("anomalies");
  });
  it("sanitizes the model's choice to allowed values", () => {
    const p = sanitizePlan({ tool: "rank", country: "France", department: "logistics", metric: "nonsense", limit: 99 }, ctx);
    expect(p).toMatchObject({ tool: "rank", country: null, department: "Logistics", metric: "absorption", limit: 10 });
    expect(sanitizePlan({ tool: "drop_tables" }, ctx).tool).toBe("none");
  });
  it("rank lookup returns facts with the table's figures", () => {
    const mkCc = (id, abs) => ({ id, departmentName: id, countryCode: "US", s: { ...S, absorption: abs } });
    const r = runAskTool({ tool: "rank", metric: "absorption", order: "worst", limit: 2 }, {
      ytd: { fy: 2027, through: "2026-09", costCenters: [mkCc("A", -5000), mkCc("B", -90000), mkCc("C", 1000)] },
      countryName: (c) => c, allLabel: "all countries",
    });
    expect(r.rows.map((x) => x[1])).toEqual(["B (B)", "A (A)"]);
    expect(checkNumbers(r.rows.flat().join(" "), r.facts).ok).toBe(true);
  });
});

// The server endpoint with the test model.
function callHandler(handler, method, url, body) {
  return new Promise((resolve) => {
    const listeners = {};
    const req = {
      method, url, originalUrl: url,
      on: (ev, fn) => { listeners[ev] = fn; },
      destroy: () => {},
    };
    const res = {
      statusCode: 200, headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(s) { resolve({ status: this.statusCode, body: JSON.parse(s) }); },
    };
    handler(req, res, () => resolve({ status: "next" }));
    setTimeout(() => {
      if (body) listeners.data?.(Buffer.from(JSON.stringify(body)));
      listeners.end?.();
    }, 0);
  });
}

describe("AI server endpoint (test model)", () => {
  const facts = buildExplainFacts({ s: S, name: "Product & Design", scope: "US", periodLabel: "FY2027 YTD" }).facts;
  it("reports status and returns a checked explanation", async () => {
    const h = createAiHandler({ AI_PROVIDER: "mock" });
    const st = await callHandler(h, "GET", "/api/ai/status");
    expect(st.body).toMatchObject({ enabled: true, reachable: true, provider: "mock" });
    const r = await callHandler(h, "POST", "/api/ai/explain", { facts });
    expect(r.body.ok).toBe(true);
    expect(r.body.answer.points.length).toBeGreaterThanOrEqual(2);
  });
  it("rejects an answer with a made-up number", async () => {
    const h = createAiHandler({ AI_PROVIDER: "mock", AI_MOCK_BAD: "1" });
    const r = await callHandler(h, "POST", "/api/ai/explain", { facts });
    expect(r.body).toMatchObject({ ok: false, reason: "check", bad: ["$999.9K"] });
  });
  it("enforces the daily limit and passes other paths through", async () => {
    const h = createAiHandler({ AI_PROVIDER: "mock", AI_DAILY_LIMIT: "1" });
    expect((await callHandler(h, "POST", "/api/ai/explain", { facts })).status).toBe(200);
    expect((await callHandler(h, "POST", "/api/ai/explain", { facts })).status).toBe(429);
    expect((await callHandler(h, "GET", "/index.html")).status).toBe("next");
  });
  it("tells you when Ollama is not running", async () => {
    const h = createAiHandler({ AI_PROVIDER: "local", OLLAMA_URL: "http://127.0.0.1:9" });
    const st = await callHandler(h, "GET", "/api/ai/status");
    expect(st.body.reachable).toBe(false);
    expect(st.body.error).toMatch(/Ollama is not running/);
  });
});

describe("orchestrator and agents", () => {
  const ctx = { countries: [{ code: "US", name: "United States" }], departments: ["Logistics"], costCenters: [] };
  it("routes to the agent that owns the chosen lookup", () => {
    expect(sanitizePlan({ agent: "burden", tool: "rank" }, ctx).agent).toBe("utilization");
    expect(sanitizePlan(keywordPlan("Anything unusual this month?", ctx), ctx).agent).toBe("anomalies");
  });
  it("a picked agent only uses its own lookups", () => {
    const c = { ...ctx, tools: ["burden_trend", "burden_by_country"] };
    expect(sanitizePlan({ tool: "rank" }, c).tool).toBe("none");
    expect(sanitizePlan(keywordPlan("Which cost centers are worst?", c), c).tool).toBe("burden_trend");
    const f = { ...ctx, tools: ["forecast"] };
    expect(sanitizePlan({ tool: "variance" }, f).tool).toBe("forecast");
  });
});

describe("Claude request (mocked API)", () => {
  it("sends structured-output JSON schema and reads the text answer", async () => {
    const { strictSchema, callModel, readConfig } = await import("../../../../server/ai/providers.js");
    const { EXPLAIN_SCHEMA } = await import("../../../../server/ai/prompts.js");
    const strict = strictSchema(EXPLAIN_SCHEMA);
    expect(strict.additionalProperties).toBe(false);
    expect(strict.properties.points.items.additionalProperties).toBe(false);
    expect(strict.properties.points.maxItems).toBeUndefined();
    expect(strict.properties.points.minItems).toBe(1);

    // Claude rule: no enum on a type array, so nullable enums become anyOf.
    const { PLAN_SCHEMA } = await import("./askCatalog.js");
    const plan = strictSchema(PLAN_SCHEMA);
    const walk = (n) => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== "object") return;
      expect(Array.isArray(n.type)).toBe(false);
      if (n.enum && n.type) for (const v of n.enum) expect(typeof v).toBe(n.type);
      Object.values(n).forEach(walk);
    };
    walk(plan);
    expect(plan.properties.metric.anyOf).toEqual([{ type: "string", enum: ["absorption", "gap_to_target", "cost_variance", "utilization", "burden_rate"] }, { type: "null" }]);
    expect(plan.properties.limit.anyOf).toEqual([{ type: "integer" }, { type: "null" }]);
    expect(plan.additionalProperties).toBe(false);

    const calls = [];
    const orig = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
      return { ok: true, json: async () => ({ content: [{ type: "thinking", thinking: "…" }, { type: "text", text: '{"answer":"ok"}' }] }) };
    };
    try {
      const cfg = readConfig({ ANTHROPIC_API_KEY: "test-key" });
      expect(cfg.provider).toBe("anthropic");
      const out = await callModel(cfg, { system: "s", user: "u", schema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] } });
      expect(out).toEqual({ answer: "ok" });
      const b = calls[0].body;
      expect(b.model).toBe("claude-sonnet-5-5");
      expect(b.output_config.format.type).toBe("json_schema");
      expect(b.tool_choice).toBeUndefined();
      expect(b.temperature).toBeUndefined();
      expect(calls[0].headers["x-api-key"]).toBe("test-key");
    } finally {
      globalThis.fetch = orig;
    }
  });
  it("passes Claude's error message through", async () => {
    const { callModel, readConfig } = await import("../../../../server/ai/providers.js");
    const orig = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 400, text: async () => JSON.stringify({ error: { message: "bad schema" } }) });
    try {
      await expect(callModel(readConfig({ ANTHROPIC_API_KEY: "k" }), { system: "s", user: "u", schema: { type: "object" } })).rejects.toThrow("Claude API error 400: bad schema");
    } finally {
      globalThis.fetch = orig;
    }
  });
});
