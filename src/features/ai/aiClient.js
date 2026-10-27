// aiClient.js — browser calls to the /api/ai endpoints.

async function call(path, body) {
  let res;
  try {
    res = await fetch(`/api/ai${path}`, body
      ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
      : undefined);
  } catch {
    throw new Error("Could not reach the Burden AI server.");
  }
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) throw new Error(data?.error || `AI request failed (${res.status})`);
  if (!data) throw new Error("The AI service is not available on this server.");
  return data;
}

export const aiStatus = () => call("/status");
export const aiExplain = (facts) => call("/explain", { facts });
export const aiAskPlan = (question, context) => call("/ask/plan", { question, context });
export const aiAskAnswer = (question, result) => call("/ask/answer", { question, result: { title: result.title, facts: result.facts } });
