// handler.js — the /api/ai endpoints, mounted into the Vite dev and preview
// servers (see vite.config.js), so `npm run dev` and Railway's `npm start`
// both serve them with no extra process.
//
//   GET  /api/ai/status        is AI on, which model, can it be reached
//   POST /api/ai/explain       { facts: string[] }                → explanation
//   POST /api/ai/ask/plan      { question, context }              → which lookup to run
//   POST /api/ai/ask/answer    { question, result: {title,facts} } → short answer
//
// Every number in a model's answer is checked against the facts it was given.
// A failed check is retried once; if it fails again the answer is not returned.

import { readConfig, modelLabel, callModel, ping } from "./providers.js";
import { EXPLAIN_SCHEMA, ANSWER_SCHEMA, explainMessages, planMessages, answerMessages } from "./prompts.js";
import { PLAN_SCHEMA, sanitizePlan, keywordPlan } from "../../src/features/ai/engine/askCatalog.js";
import { checkNumbers, allText } from "../../src/features/ai/engine/numberCheck.js";

const MAX_BODY = 100_000;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error("Request too large"), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); }
      catch { reject(Object.assign(new Error("Invalid JSON"), { status: 400 })); }
    });
    req.on("error", reject);
  });
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

const strList = (v, max, len) => Array.isArray(v) && v.length > 0 && v.length <= max && v.every((s) => typeof s === "string" && s.length <= len);

// Runs the model and checks its numbers; one retry with the offending numbers named.
async function checkedCall(cfg, { system, user, schema, mock }, allowedStrings) {
  let answer = await callModel(cfg, { system, user, schema, mock });
  let check = checkNumbers(allText(answer), allowedStrings);
  let attempts = 1;
  if (!check.ok) {
    attempts = 2;
    const retryUser = `${user}\n\nYour previous answer used numbers that are not in FACTS: ${check.bad.join(", ")}. Rewrite it using only numbers copied exactly from FACTS.`;
    answer = await callModel(cfg, { system, user: retryUser, schema, mock });
    check = checkNumbers(allText(answer), allowedStrings);
  }
  return { answer, check, attempts };
}

// Test model (AI_PROVIDER=mock): answers built straight from the facts, so
// the whole flow can be tested without a real model. AI_MOCK_BAD=1 makes it
// add a made-up number to test the number check.
function mockExplain(facts, bad) {
  const pick = (re) => facts.find((f) => re.test(f)) || facts[1] || facts[0];
  return () => ({
    headline: `${pick(/^Absorption/)}.${bad ? " That is about $999.9K a year." : ""}`,
    points: [
      { title: "Headcount and hours.", text: `${pick(/^Average FTE/)}. ${pick(/^Available hours/)}.` },
      { title: "Utilization.", text: `${pick(/^Utilization/)}.` },
      { title: "How it adds up.", text: `${pick(/^Cost variance/)}.` },
    ],
    checks: ["Were any hires earlier than planned?", "Is training or bench time pulling utilization down?"],
  });
}

export function createAiHandler(env = process.env) {
  const cfg = readConfig(env);
  const usage = { day: "", count: 0 };
  const log = (task, t0, ok, extra = "") =>
    console.log(`[ai] ${task} provider=${cfg.provider} ok=${ok} ms=${Date.now() - t0}${extra ? ` ${extra}` : ""}`);

  const overLimit = () => {
    const day = new Date().toISOString().slice(0, 10);
    if (usage.day !== day) { usage.day = day; usage.count = 0; }
    if (usage.count >= cfg.dailyLimit) return true;
    usage.count += 1;
    return false;
  };

  return async function aiHandler(req, res, next) {
    const url = (req.originalUrl || req.url || "").split("?")[0];
    if (!url.startsWith("/api/ai")) return next ? next() : send(res, 404, { error: "Not found" });
    const path = url.slice("/api/ai".length) || "/";
    const t0 = Date.now();

    try {
      if (req.method === "GET" && path === "/status") {
        const p = cfg.enabled ? await ping(cfg) : { ok: false, error: "AI is turned off on the server (AI_ENABLED=false)" };
        return send(res, 200, { enabled: cfg.enabled, provider: cfg.provider, model: modelLabel(cfg), reachable: p.ok, error: p.error || null, dailyLimit: cfg.dailyLimit, usedToday: usage.day === new Date().toISOString().slice(0, 10) ? usage.count : 0 });
      }
      if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
      if (!cfg.enabled) return send(res, 503, { error: "AI is turned off on the server" });
      const body = await readBody(req);
      if (overLimit()) return send(res, 429, { error: `The daily AI limit (${cfg.dailyLimit} requests) has been reached. It resets at midnight UTC.` });

      if (path === "/explain") {
        if (!strList(body.facts, 30, 500)) return send(res, 400, { error: "facts must be a list of short strings" });
        const { system, user } = explainMessages({ facts: body.facts });
        const r = await checkedCall(cfg, { system, user, schema: EXPLAIN_SCHEMA, mock: mockExplain(body.facts, env.AI_MOCK_BAD === "1") }, body.facts);
        log("explain", t0, r.check.ok, `attempts=${r.attempts}`);
        if (!r.check.ok) return send(res, 200, { ok: false, reason: "check", bad: r.check.bad, model: modelLabel(cfg), ms: Date.now() - t0 });
        return send(res, 200, { ok: true, answer: normalizeExplain(r.answer), model: modelLabel(cfg), attempts: r.attempts, ms: Date.now() - t0 });
      }

      if (path === "/ask/plan") {
        const question = String(body.question || "").trim();
        const context = body.context || {};
        if (!question || question.length > 500) return send(res, 400, { error: "Ask a question of up to 500 characters" });
        if (!Array.isArray(context.countries) || !Array.isArray(context.departments) || !Array.isArray(context.costCenters)) {
          return send(res, 400, { error: "context is missing" });
        }
        let plan;
        let via = "model";
        try {
          const { system, user } = planMessages({ question, context });
          const raw = await callModel(cfg, { system, user, schema: PLAN_SCHEMA, mock: () => keywordPlan(question, context) });
          plan = sanitizePlan(raw, context);
        } catch (e) {
          if (cfg.provider !== "local" && cfg.provider !== "mock") throw e;
          if (/not running|not installed/.test(e.message)) throw e;
          plan = sanitizePlan(keywordPlan(question, context), context);
          via = "keywords";
        }
        log("ask/plan", t0, true, `tool=${plan.tool} via=${via}`);
        return send(res, 200, { ok: true, plan, via, model: modelLabel(cfg), ms: Date.now() - t0 });
      }

      if (path === "/ask/answer") {
        const question = String(body.question || "").trim();
        const result = body.result || {};
        if (!question || !strList(result.facts, 40, 500) || typeof result.title !== "string") {
          return send(res, 400, { error: "question and result are required" });
        }
        const { system, user } = answerMessages({ question, result });
        const mock = () => ({ answer: `${result.facts[0]}.${env.AI_MOCK_BAD === "1" ? " Roughly $999.9K." : ""}` });
        const r = await checkedCall(cfg, { system, user, schema: ANSWER_SCHEMA, mock }, [...result.facts, question]);
        log("ask/answer", t0, r.check.ok, `attempts=${r.attempts}`);
        if (!r.check.ok) return send(res, 200, { ok: false, reason: "check", bad: r.check.bad, model: modelLabel(cfg), ms: Date.now() - t0 });
        return send(res, 200, { ok: true, answer: String(r.answer?.answer || "").trim(), model: modelLabel(cfg), attempts: r.attempts, ms: Date.now() - t0 });
      }

      return send(res, 404, { error: "Not found" });
    } catch (e) {
      const msg = e.name === "AbortError" ? "The model took too long to answer. Try again." : e.message || "AI request failed";
      log(path, t0, false, `error="${String(msg).slice(0, 300)}"`);
      // 500, not 502: hosting proxies replace 502 responses with their own page and the message is lost.
      return send(res, e.status || 500, { error: msg });
    }
  };
}

function normalizeExplain(a) {
  const points = Array.isArray(a?.points) ? a.points : [];
  const checks = Array.isArray(a?.checks) ? a.checks : [];
  return {
    headline: String(a?.headline || "").trim(),
    points: points.slice(0, 4).map((p) => ({ title: String(p?.title || "").trim(), text: String(p?.text || "").trim() })).filter((p) => p.text),
    checks: checks.slice(0, 3).map((c) => String(c || "").trim()).filter(Boolean),
  };
}
