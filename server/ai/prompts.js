// prompts.js — what Burden AI asks the model, and the shape of the answer.
// Prompts live on the server so the browser cannot change them.

import { allowedTools, AGENTS } from "../../src/features/ai/engine/askCatalog.js";

const FIGURE_RULES = `Rules for numbers — these are checked automatically and the answer is rejected if broken:
- Use ONLY numbers that appear in FACTS, copied exactly as written there (same rounding, units, currency symbol and sign).
- Do not calculate, round, convert or estimate any new number. If you want a number that is not in FACTS, say it in words instead.
- Month names and fiscal year labels are fine.`;

export const EXPLAIN_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string", description: "One sentence, at most 35 words: the variance and its main cause." },
    points: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "A short lead-in of at most 6 words ending with a period, e.g. 'Utilization slipped.'" },
          text: { type: "string", description: "One or two sentences with the supporting figures." },
        },
        required: ["title", "text"],
      },
    },
    checks: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: { type: "string", description: "A question a manager should check next, or the what-if figure from FACTS." },
    },
  },
  required: ["headline", "points", "checks"],
};

export function explainMessages({ facts }) {
  const system = `You are Burden AI's cost analyst. You explain plan-versus-actual labor burden cost variances to finance managers in plain, calm business English.
How the measures relate: cost variance = volume effect + rate effect. Volume effect is the difference in productive hours valued at the plan rate. Rate effect is the extra (or saved) cost per productive hour; absorption is the rate effect with the opposite sign — negative absorption means under-absorbed (each productive hour cost more than planned). Utilization = productive hours ÷ available hours; more people or lower utilization raises the cost of each productive hour.
${FIGURE_RULES}
Other rules:
- Explain the chain of cause and effect: headcount → available hours → utilization → productive hours → rate → absorption. Lead with the biggest driver.
- Do not state causes you cannot see in FACTS as facts. Put possible reasons as questions under checks.
- Never mention individual employees or pay.
Return JSON only, matching the schema.`;
  const user = `FACTS:\n${facts.map((f) => `- ${f}`).join("\n")}\n\nWrite the explanation.`;
  return { system, user };
}

export const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string", description: "One to three sentences that answer the question from FACTS." },
  },
  required: ["answer"],
};

export function planMessages({ question, context }) {
  const lookups = allowedTools(context);
  const orchestrating = !(Array.isArray(context.tools) && context.tools.length);
  const agents = AGENTS.filter((a) => a.tools && lookups.some((t) => a.tools.includes(t.name)));
  const system = orchestrating
    ? `You are the orchestrator in Burden AI, a labor burden cost application. Read the finance user's question and route it to the one specialist agent whose job it is, then choose that agent's lookup and its arguments.
Agents and their lookups:
${agents.map((a) => `- ${a.id}: ${a.job}. Lookups: ${a.tools.map((n) => { const t = lookups.find((x) => x.name === n); return `${n} (${t.description})`; }).join("; ")}`).join("\n")}
If no agent can answer (for example questions about individual employees or pay), use agent "none" and tool "none".
Use only values from the allowed lists; use null when an argument does not apply. Countries are given by code.
Return JSON only, matching the schema.`
    : `You are the ${agents[0]?.id || "specialist"} agent in Burden AI. Choose one of your lookups for the finance user's question, and its arguments.
Lookups:
${lookups.map((t) => `- ${t.name}: ${t.description}`).join("\n")}
If none of your lookups can answer, choose tool "none". Use only values from the allowed lists; use null when an argument does not apply. Countries are given by code.
Return JSON only, matching the schema.`;
  const user = `Allowed countries: ${context.countries.map((c) => `${c.code} (${c.name})`).join(", ") || "none"}
Allowed departments: ${context.departments.join(", ")}
Allowed cost centers: ${context.costCenters.map((c) => `${c.id} (${c.departmentName}, ${c.countryCode})`).join(", ")}
Latest month with data: ${context.latestMonth}

Question: ${question}`;
  return { system, user };
}

export function answerMessages({ question, result }) {
  const system = `You are Burden AI. Answer the user's question in one to three sentences from the lookup result in FACTS. Be direct: lead with the answer.
${FIGURE_RULES}
- If FACTS do not fully answer the question, say what they do show.
- Never mention individual employees or pay.
Return JSON only, matching the schema.`;
  const user = `Question: ${question}\n\nLookup: ${result.title}\nFACTS:\n${result.facts.map((f) => `- ${f}`).join("\n")}`;
  return { system, user };
}
