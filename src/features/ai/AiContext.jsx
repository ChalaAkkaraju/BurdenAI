// AiContext.jsx
// One place that knows whether AI can be used right now (admin settings,
// the user's role, the server and the model) and hosts the two AI panels:
// "Explain this variance" and "Ask Burden AI". Pages call useAi().

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import { usePersistedState } from "../forecast/hooks/usePersistedState.js";
import { aiStatus } from "./aiClient.js";
import { AI_SETTINGS_KEY, DEFAULT_AI_SETTINGS, aiAllowedFor, usageToday, recordUse } from "./settings.js";
import ExplainPanel from "./components/ExplainPanel.jsx";
import AskPanel from "./components/AskPanel.jsx";
import { SparkIcon } from "./components/Drawer.jsx";
import { NAV } from "../../components/Sidebar";

const AiCtx = createContext(null);

export function AiProvider({ children, activePage }) {
  const { currentUser, addAuditEntry } = useApp();
  const [stored, setStored] = usePersistedState(AI_SETTINGS_KEY, DEFAULT_AI_SETTINGS);
  const settings = useMemo(() => ({ ...DEFAULT_AI_SETTINGS, ...(stored || {}), roles: { ...(stored?.roles || {}) } }), [stored]);
  const [status, setStatus] = useState(null); // server status, null while checking
  const [explainSubject, setExplainSubject] = useState(null);
  const [askOpen, setAskOpen] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await aiStatus();
      setStatus(s);
      return s;
    } catch (e) {
      const s = { enabled: false, reachable: false, error: e.message, model: null };
      setStatus(s);
      return s;
    }
  }, []);
  useEffect(() => { if (currentUser) refreshStatus(); }, [currentUser, refreshStatus]);

  const access = aiAllowedFor(currentUser, settings);
  const used = usageToday(currentUser);
  const limitReached = settings.dailyLimitPerUser > 0 && used >= settings.dailyLimitPerUser;

  // Can a request go to the model right now? If not, why not.
  const blocker = !access.ok ? access.reason
    : !status ? "Checking the AI service…"
      : !status.enabled ? (status.error || "AI is turned off on the server.")
        : !status.reachable ? status.error || "The AI model cannot be reached."
          : limitReached ? `You have used your ${settings.dailyLimitPerUser} AI requests for today.`
            : null;

  const audit = useCallback((action, details) => {
    try { addAuditEntry?.({ action, target: "Burden AI", details, category: "AI" }); } catch { /* best effort */ }
  }, [addAuditEntry]);

  const value = {
    settings,
    saveSettings: (next) => setStored({ ...settings, ...next }),
    status,
    refreshStatus,
    access,
    visible: access.ok, // show AI buttons at all
    blocker,
    used,
    noteUse: () => recordUse(currentUser),
    audit,
    explain: (subject) => setExplainSubject(subject),
    openAsk: () => setAskOpen(true),
  };

  return (
    <AiCtx.Provider value={value}>
      {children}
      {explainSubject && <ExplainPanel subject={explainSubject} onClose={() => setExplainSubject(null)} />}
      {access.ok && !askOpen && (
        <button
          type="button"
          onClick={() => setAskOpen(true)}
          aria-label="Open Ask Burden AI assistant"
          className="fixed z-40 right-6 bottom-6 flex items-center gap-2.5 pl-2 pr-5 py-2 rounded-full bg-slate-900 text-white shadow-xl ring-1 ring-black/5 hover:bg-slate-800 transition-colors print:hidden"
        >
          <span className="inline-flex w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 items-center justify-center">
            <SparkIcon size={16} className="text-white" />
          </span>
          <span className="text-sm font-semibold">Ask Burden AI</span>
        </button>
      )}
      {askOpen && (
        <AskPanel
          onClose={() => setAskOpen(false)}
          page={activePage}
          pageLabel={NAV.flatMap((s) => s.items).find((i) => i.id === activePage)?.label}
        />
      )}
    </AiCtx.Provider>
  );
}

export function useAi() {
  return useContext(AiCtx) || { visible: false, explain: () => {}, openAsk: () => {} };
}
