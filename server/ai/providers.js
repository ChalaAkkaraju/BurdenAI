// providers.js — the two places an answer can come from.
//   local     : Ollama running on the same machine (no data leaves it)
//   anthropic : Claude through the Anthropic API (key kept on the server)
// Both take { system, user, schema } and return the parsed JSON answer.
// AI_PROVIDER picks one; nothing else in the app changes.

export function readConfig(env = process.env) {
  const provider = (env.AI_PROVIDER || (env.ANTHROPIC_API_KEY ? "anthropic" : "local")).toLowerCase();
  return {
    enabled: String(env.AI_ENABLED ?? "true").toLowerCase() !== "false",
    provider,
    ollamaUrl: (env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, ""),
    ollamaModel: env.OLLAMA_MODEL || "qwen3:30b-a3b",
    anthropicKey: env.ANTHROPIC_API_KEY || "",
    anthropicModel: env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
    dailyLimit: Number(env.AI_DAILY_LIMIT || 300),
    timeoutMs: Number(env.AI_TIMEOUT_MS || (provider === "local" ? 180000 : 60000)),
  };
}

export function modelLabel(cfg) {
  if (cfg.provider === "anthropic") return `Claude (${cfg.anthropicModel})`;
  if (cfg.provider === "mock") return "Test model";
  return `Local model (${cfg.ollamaModel})`;
}

async function withTimeout(ms, fn) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(text) {
  const s = String(text || "").trim();
  try {
    return JSON.parse(s);
  } catch {
    const m = /\{[\s\S]*\}/.exec(s);
    if (m) return JSON.parse(m[0]);
    throw new Error("The model did not return JSON");
  }
}

const thinks = (model) => /^(qwen3|deepseek-r1|magistral|gpt-oss)/i.test(model);

async function callOllama(cfg, { system, user, schema }) {
  return withTimeout(cfg.timeoutMs, async (signal) => {
    const res = await fetch(`${cfg.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal,
      body: JSON.stringify({
        model: cfg.ollamaModel,
        stream: false,
        format: schema,
        options: { temperature: 0.2 },
        // Thinking models (Qwen3, DeepSeek-R1…) answer much faster with thinking off.
        ...(thinks(cfg.ollamaModel) ? { think: false } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 404) throw new Error(`Model "${cfg.ollamaModel}" is not installed in Ollama. Run: ollama pull ${cfg.ollamaModel}`);
      throw new Error(`Ollama error ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return parseJson(data?.message?.content);
  });
}

async function callAnthropic(cfg, { system, user, schema }) {
  if (!cfg.anthropicKey) throw new Error("ANTHROPIC_API_KEY is not set on the server");
  return withTimeout(cfg.timeoutMs, async (signal) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.anthropicModel,
        max_tokens: 1200,
        temperature: 0.2,
        system,
        // Forcing a single tool call makes Claude return JSON in the schema.
        tools: [{ name: "respond", description: "Return the answer", input_schema: schema }],
        tool_choice: { type: "tool", name: "respond" },
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const block = (data.content || []).find((b) => b.type === "tool_use");
    if (!block) throw new Error("Claude did not return a structured answer");
    return block.input;
  });
}

export async function callModel(cfg, req) {
  if (cfg.provider === "anthropic") return callAnthropic(cfg, req);
  if (cfg.provider === "mock") return req.mock();
  return callOllama(cfg, req);
}

// Is the provider reachable? Used by the status check (cheap: no generation).
export async function ping(cfg) {
  if (cfg.provider === "mock") return { ok: true };
  if (cfg.provider === "anthropic") {
    return cfg.anthropicKey ? { ok: true } : { ok: false, error: "ANTHROPIC_API_KEY is not set" };
  }
  try {
    return await withTimeout(3000, async (signal) => {
      const res = await fetch(`${cfg.ollamaUrl}/api/tags`, { signal });
      if (!res.ok) return { ok: false, error: `Ollama answered ${res.status}` };
      const data = await res.json();
      const names = (data.models || []).map((m) => m.name);
      const want = cfg.ollamaModel.includes(":") ? cfg.ollamaModel : `${cfg.ollamaModel}:latest`;
      if (!names.includes(want)) {
        return { ok: false, error: `Ollama is running but "${cfg.ollamaModel}" is not installed. Run: ollama pull ${cfg.ollamaModel}` };
      }
      return { ok: true };
    });
  } catch {
    return { ok: false, error: `Ollama is not running at ${cfg.ollamaUrl}. Start Ollama and try again.` };
  }
}
