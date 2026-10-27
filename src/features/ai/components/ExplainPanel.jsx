// ExplainPanel.jsx — "Explain this variance".
// The figures are Burden AI's own calculation and are always shown. The model
// writes the words; every number it uses is checked against the figures on the
// server. If AI is unavailable, or its text fails the check, a plain
// explanation written from the figures by rules is shown instead, and labelled.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, RefreshCw, Check, Info, ShieldCheck, FileDown } from "lucide-react";
import { explainReport } from "../report.js";
import { useApp } from "../../../context/AppContext";
import Drawer, { AiKicker } from "./Drawer.jsx";
import { useAi } from "../AiContext.jsx";
import { aiExplain } from "../aiClient.js";
import { buildExplainFacts } from "../engine/explainFacts.js";

export default function ExplainPanel({ subject, onClose }) {
  const ai = useAi();
  const ex = useMemo(() => buildExplainFacts(subject), [subject]);
  const facts = useMemo(() => [...(subject.extraFacts || []), ...ex.facts], [ex, subject.extraFacts]);
  const [state, setState] = useState({ phase: "loading" });
  const [copied, setCopied] = useState(false);
  const runId = useRef(0);

  const run = useCallback(async () => {
    const id = ++runId.current;
    if (ai.blocker) {
      setState({ phase: "fallback", note: ai.blocker });
      return;
    }
    setState({ phase: "loading" });
    try {
      const r = await aiExplain(facts);
      if (id !== runId.current) return;
      ai.noteUse();
      if (r.ok) {
        setState({ phase: "ai", answer: r.answer, model: r.model, ms: r.ms });
        ai.audit("AI Explanation", `${subject.name} · ${subject.periodLabel} · ${r.model} · numbers checked`);
      } else {
        setState({ phase: "fallback", note: `The AI text used figures that are not in the numbers below (${r.bad.join(", ")}), so it was not shown.`, rejected: true });
        ai.audit("AI Explanation Rejected", `${subject.name} · ${subject.periodLabel} · ${r.model} · failed number check: ${r.bad.join(", ")}`);
      }
    } catch (e) {
      if (id !== runId.current) return;
      setState({ phase: "fallback", note: e.message });
    }
  }, [ai, facts, subject]);

  useEffect(() => { run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = state.phase === "ai" ? state.answer : ex.fallback;
  const { currentUser } = useApp();
  const pdf = () => {
    const ok = explainReport({ subject, shown, aiWritten: state.phase === "ai", model: state.model, table: ex.table, extraFacts: subject.extraFacts, user: currentUser });
    if (ok) ai.audit("AI Report Downloaded", `Variance explanation · ${subject.name} · ${subject.periodLabel}`);
  };
  const copy = async () => {
    const text = [shown.headline, ...shown.points.map((p) => `${p.title} ${p.text}`), "What to check next:", ...shown.checks.map((c) => `- ${c}`)].join("\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  return (
    <Drawer
      labelId="ai-explain-title"
      kicker={<AiKicker />}
      title={subject.name}
      subtitle={`${subject.scope} · ${subject.periodLabel}`}
      onClose={onClose}
      footer={
        <div className="px-6 py-4 space-y-3">
          <div className="flex gap-2">
            <button type="button" onClick={copy} disabled={state.phase === "loading"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" onClick={pdf} disabled={state.phase === "loading"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <FileDown size={14} /> PDF
            </button>
            <button type="button" onClick={run} disabled={state.phase === "loading" || !!ai.blocker}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw size={14} /> Regenerate
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-gray-500">
            {state.phase === "ai"
              ? <>Written by AI ({state.model}) from the figures above. The figures come from Burden AI’s calculations and are the source of truth — every number in the text was checked against them before it was shown.</>
              : <>Written from the figures above by Burden AI’s rules (no AI).</>}
            {" "}Only totals are used, never employee names or pay.
          </p>
        </div>
      }
    >
      <div className="px-6 py-5 space-y-5">
        {state.phase === "loading" ? (
          <div className="space-y-3" aria-live="polite">
            <p className="text-sm text-slate-700 font-medium">Writing an explanation from {subject.name}’s figures…</p>
            {[90, 75, 82, 60].map((w, i) => (
              <div key={i} className="h-3 rounded bg-gray-100 animate-pulse" style={{ width: `${w}%` }} />
            ))}
            <p className="text-xs text-gray-500">A local model can take 10–60 seconds the first time.</p>
          </div>
        ) : (
          <>
            {state.phase === "fallback" && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>{state.note} Showing a plain explanation written from the figures instead.</span>
              </div>
            )}
            <p className="text-[15px] font-semibold text-gray-900 leading-relaxed bg-amber-50/70 border border-amber-200 rounded-xl px-4 py-3">
              {shown.headline}
            </p>
            <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
              {shown.points.map((p, i) => (
                <p key={i}><strong className="font-semibold text-gray-900">{p.title}</strong> {p.text}</p>
              ))}
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">What to check next</h3>
              <ul className="space-y-1.5 text-sm text-gray-700 list-disc pl-5">
                {shown.checks.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          </>
        )}

        <div>
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            <ShieldCheck size={13} className="text-blue-600" /> The figures (Burden AI calculation)
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-gray-400">
                <th className="text-left font-semibold py-1">Measure</th>
                <th className="text-right font-semibold py-1">Plan</th>
                <th className="text-right font-semibold py-1">Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ex.table.map((r) => (
                <tr key={r.label}>
                  <td className="py-1.5 text-gray-600">{r.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-600 whitespace-nowrap">{r.plan}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium text-gray-900 whitespace-nowrap">{r.actual}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {subject.extraFacts?.length > 0 && (
            <ul className="mt-2 text-xs text-gray-600 space-y-1">
              {subject.extraFacts.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  );
}
