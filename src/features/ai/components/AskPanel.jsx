// AskPanel.jsx — "Ask Burden AI", a floating assistant panel.
// 1. The chosen agent (or Auto) picks one fixed lookup for the question; the
//    model never sees raw data.
// 2. Burden AI runs that lookup with its own calculations, in the user's countries.
// 3. The model writes a short answer from those figures; its numbers are checked.
// The figures are always shown with the answer.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Info, Loader2, RotateCw, ChevronDown, ChevronUp, Maximize2, Minimize2, FileDown, ExternalLink, FileText, Eraser } from "lucide-react";
import { askReport } from "../report.js";
import { SparkIcon } from "./Drawer.jsx";
import { useAi } from "../AiContext.jsx";
import { useApp } from "../../../context/AppContext";
import { aiAskPlan, aiAskAnswer } from "../aiClient.js";
import { useAskContext } from "../hooks/useAiData.js";
import { runAskTool } from "../engine/askTools.js";
import { keywordPlan, sanitizePlan, AGENTS } from "../engine/askCatalog.js";
import { areasFor, pickPrompts } from "../promptBank.js";

let nextId = 1;

export default function AskPanel({ onClose, page, pageLabel }) {
  const ai = useAi();
  const { currentUser } = useApp();
  const ctx = useAskContext(ai.settings.anomalyCutoff);
  const [entries, setEntries] = useState([]);
  const [q, setQ] = useState("");
  const [agent, setAgent] = useState("auto");
  const [round, setRound] = useState(0);
  const [showPrompts, setShowPrompts] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const busy = entries.some((e) => e.status === "loading");
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const areas = useMemo(() => areasFor(page, ctx, !!ctx.getForecast), [page, ctx]);
  const groups = pickPrompts(areas, round);
  const agents = AGENTS.filter((a) => a.id !== "forecast" || ctx.getForecast);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" }); }, [entries]);

  const prefill = (text, areaAgent) => {
    setQ(text);
    if (areaAgent) setAgent(areaAgent);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) { el.focus(); el.setSelectionRange(text.length, text.length); }
    });
  };

  const update = (id, patch) => setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const ask = async () => {
    const text = q.trim();
    if (!text || busy) return;
    setQ("");
    setShowPrompts(false);
    const id = nextId++;
    const agentDef = AGENTS.find((a) => a.id === agent) || AGENTS[0];
    setEntries((prev) => [...prev, { id, question: text, agentLabel: agentDef.label, status: "loading" }]);
    const lookupCtx = {
      countries: ctx.countries,
      departments: ctx.departments,
      costCenters: ctx.costCenters,
      latestMonth: ctx.latestMonth,
      tools: agentDef.tools,
    };
    const local = (note) => {
      const plan = sanitizePlan(keywordPlan(text, lookupCtx), lookupCtx);
      const routed = AGENTS.find((x) => x.id === plan.agent)?.label;
      update(id, { status: "done", result: runAskTool(plan, ctx), note, routedTo: agent === "auto" && routed ? routed : null });
    };

    if (ai.blocker) {
      local(`${ai.blocker} Showing the figures for the closest lookup instead.`);
      return;
    }
    try {
      const p = await aiAskPlan(text, lookupCtx);
      ai.noteUse();
      if (p.plan.tool === "none") {
        update(id, {
          status: "done",
          model: p.model,
          answer: agent === "auto"
            ? "I can answer questions about burden cost, utilization, absorption, forecasts and unusual months, by country, department or cost center — but not about individual employees or pay."
            : `The ${agentDef.label.toLowerCase()} can't answer that. Try Auto, or pick another agent.`,
        });
        ai.audit("AI Question", `"${text}" · ${agentDef.label} · no matching lookup · ${p.model}`);
        return;
      }
      const result = runAskTool(p.plan, ctx);
      const routed = AGENTS.find((x) => x.id === p.plan.agent)?.label;
      update(id, { result, model: p.model, routedTo: agent === "auto" && routed ? routed : null });
      const a = await aiAskAnswer(text, result);
      if (a.ok) {
        update(id, { status: "done", answer: a.answer, model: a.model });
        ai.audit("AI Question", `"${text}" · ${agentDef.label} · lookup ${p.plan.tool} · ${a.model} · numbers checked`);
      } else {
        update(id, { status: "done", note: `The AI answer used figures that are not in the lookup (${a.bad.join(", ")}), so it was not shown. Here are the figures.`, model: a.model });
        ai.audit("AI Question Rejected", `"${text}" · ${agentDef.label} · lookup ${p.plan.tool} · ${a.model} · failed number check`);
      }
    } catch (e) {
      local(`${e.message} Showing the figures for the closest lookup instead.`);
    }
  };

  const openOne = (e, popOut) => {
    const ok = askReport({
      entries: [e], user: currentUser, scope: ctx.allLabel, pageLabel,
      model: e.model || ai.status?.model, asOf: ctx.latestMonth, popOut,
    });
    setPopupBlocked(!ok);
    if (ok && !popOut) ai.audit("AI Report Downloaded", `Ask Burden AI answer · "${e.question}"`);
  };
  const clearChat = () => { setEntries([]); setShowPrompts(true); setQ(""); };

  const downloadPdf = () => {
    const ok = askReport({
      entries, user: currentUser, scope: ctx.allLabel, pageLabel,
      model: entries.map((e) => e.model).filter(Boolean).pop() || ai.status?.model, asOf: ctx.latestMonth,
    });
    setPopupBlocked(!ok);
    if (ok) ai.audit("AI Report Downloaded", `Ask Burden AI conversation · ${entries.length} questions`);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
  };
  const agentLabel = (AGENTS.find((a) => a.id === agent) || AGENTS[0]).label;

  return (
    <>
    {expanded && <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px] print:hidden" onClick={() => setExpanded(false)} />}
    <aside
      role="dialog"
      aria-labelledby="ai-ask-title"
      className={`fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden print:hidden ${
        expanded
          ? "inset-4 sm:inset-6 lg:left-[12%] lg:right-[12%]"
          : "right-4 sm:right-6 bottom-4 sm:bottom-6 h-[min(820px,calc(100vh-2rem))] w-[calc(100vw-2rem)] sm:w-[480px]"
      }`}
    >
      {/* Header */}
      <header className="bg-slate-900 text-white px-5 py-4 flex items-start gap-3">
        <span className="inline-flex w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 items-center justify-center shadow">
          <SparkIcon size={18} className="text-white" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 id="ai-ask-title" className="text-lg font-bold leading-tight">Ask Burden AI</h2>
          <p className="text-sm text-slate-300 truncate">
            {currentUser?.role || "User"} · context: {pageLabel || "Dashboard"}
          </p>
        </div>
        <div className="flex items-center gap-1 -mr-1">
          <button type="button" onClick={downloadPdf} disabled={!entries.some((e) => e.status === "done")}
            title="Download the conversation as a PDF report" aria-label="Download PDF report"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent">
            <FileDown size={18} />
          </button>
          <button type="button" onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Back to side panel" : "Open in a bigger window"} aria-label={expanded ? "Shrink assistant" : "Expand assistant"}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10">
            {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button type="button" onClick={onClose} aria-label="Close assistant" className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
      </header>
      {popupBlocked && (
        <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900">
          Your browser blocked the report window. Allow pop-ups for this site, then click the PDF button again.
        </div>
      )}

      {/* Body */}
      <div className={`flex-1 overflow-y-auto ${expanded ? "[&>*]:max-w-4xl [&>*]:mx-auto" : ""}`}>
        {ai.blocker && (
          <div className="mx-5 mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>{ai.blocker} Questions will be answered with figures only.</span>
          </div>
        )}

        {/* Suggested prompts */}
        <div className="px-5 pt-4 pb-3">
          {entries.length > 0 && (
            <button type="button" onClick={() => setShowPrompts((v) => !v)}
              className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-800">
              Suggested prompts {showPrompts ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          {(showPrompts || entries.length === 0) && (
            <div className={entries.length ? "mt-3" : ""}>
              <div className="space-y-4">
                {groups.map((g) => (
                  <section key={g.id}>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">{g.label}</h3>
                    <div className="space-y-2">
                      {g.shown.map((p) => (
                        <button key={p} type="button" onClick={() => prefill(p, g.agent)}
                          className="w-full text-left text-[14px] leading-snug text-slate-800 bg-blue-50 border border-blue-100 rounded-lg px-3.5 py-2.5 hover:bg-blue-100 hover:border-blue-200 transition-colors">
                          {p}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-gray-500">Pick one to pre-fill, edit, then Send.</span>
                <button type="button" onClick={() => setRound((r) => r + 1)} className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-900">
                  <RotateCw size={12} /> More prompts
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Conversation */}
        {entries.length > 0 && (
          <div className="px-5 pb-5 pt-2 space-y-5 border-t border-gray-100">
            {entries.map((e) => <Entry key={e.id} e={e} onPopOut={() => openOne(e, true)} onReport={() => openOne(e, false)} />)}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className={`border-t border-gray-200 bg-gray-50/70 px-5 pt-3 pb-4 ${expanded ? "[&>*]:max-w-4xl [&>*]:mx-auto [&>*+*]:mt-2.5" : "space-y-2.5"}`}>
        <label className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Pick agent</span>
          <select value={agent} onChange={(e) => setAgent(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg">
            {agents.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
        <label htmlFor="ai-ask-input" className="sr-only">Your question</label>
        <textarea
          id="ai-ask-input"
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={500}
          rows={4}
          placeholder={'e.g. "Which three cost centers need attention this month, and why?"'}
          className="block w-full resize-none px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          autoFocus
        />
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-3 text-xs text-gray-500">
            {entries.length > 0 && (
              <button type="button" onClick={clearChat} disabled={busy} className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50">
                <Eraser size={12} /> Clear chat
              </button>
            )}
            <span>{agent === "auto" ? "Auto" : agentLabel} · Enter to send, Shift+Enter for new line</span>
          </span>
          <button type="button" onClick={ask} disabled={!q.trim() || busy}
            className="px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:bg-gray-300 disabled:text-white">
            {busy ? "Working…" : "Send"}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Figures come from Burden AI’s calculations; {ai.status?.model || "the AI model"} writes the words and every number is checked.
          It only sees totals for {ctx.allLabel} — never employee names or pay.
        </p>
      </div>
    </aside>
    </>
  );
}

// A column is numeric when every value in it looks like a figure.
const NUMERIC = /^[−+\-]?[$€£¥₹]?\d|^range |^—$/;
function numCol(result, j) {
  return result.rows.length > 0 && result.rows.every((r) => NUMERIC.test(String(r[j] ?? "")));
}

function Entry({ e, onPopOut, onReport }) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-col items-end">
        <p className="max-w-[85%] text-sm bg-slate-900 text-white rounded-2xl rounded-br-md px-3.5 py-2">{e.question}</p>
        <span className="text-[10px] text-gray-400 mt-1">
          {e.routedTo ? <>Orchestrator → <span className="font-semibold text-gray-600">{e.routedTo}</span></> : e.agentLabel}
        </span>
      </div>
      {e.status === "loading" && !e.result && (
        <p className="flex items-center gap-2 text-sm text-blue-800"><Loader2 size={14} className="animate-spin" /> Choosing the right lookup…</p>
      )}
      {e.status === "loading" && e.result && (
        <p className="flex items-center gap-2 text-sm text-blue-800"><Loader2 size={14} className="animate-spin" /> Writing the answer from the figures…</p>
      )}
      {e.answer && (
        <div className="flex gap-2.5">
          <span className="mt-0.5 inline-flex w-6 h-6 shrink-0 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white items-center justify-center"><SparkIcon size={12} /></span>
          <p className="text-sm text-gray-900 leading-relaxed">{e.answer}</p>
        </div>
      )}
      {e.note && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
          <Info size={14} className="mt-0.5 shrink-0" /><span>{e.note}</span>
        </div>
      )}
      {e.result && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-700">{e.result.title}</div>
          <div className="overflow-x-auto max-h-[28rem]">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500">
                  {e.result.columns.map((c, i) => <th key={i} className={`px-3 py-1.5 font-semibold ${numCol(e.result, i) ? "text-right" : "text-left"} whitespace-nowrap`}>{c}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {e.result.rows.map((r, i) => (
                  <tr key={i}>{r.map((v, j) => <td key={j} className={`px-3 py-1.5 ${numCol(e.result, j) ? "text-right tabular-nums" : "text-gray-700"} whitespace-nowrap`}>{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {e.result.how && <p className="px-3 py-2 border-t border-gray-100 text-[11px] text-gray-500"><strong className="font-semibold text-gray-600">How I got this:</strong> {e.result.how}{e.model ? ` Answer written by ${e.model}.` : ""}</p>}
        </div>
      )}
      {e.status === "done" && (e.result || e.answer) && (
        <div className="flex justify-end gap-2 pt-0.5">
          <button type="button" onClick={onPopOut} title="Open this answer in its own window"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50">
            <ExternalLink size={12} /> Pop out
          </button>
          <button type="button" onClick={onReport} title="Open this answer as a report you can save as PDF"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50">
            <FileText size={12} /> Show full report
          </button>
        </div>
      )}
    </div>
  );
}
