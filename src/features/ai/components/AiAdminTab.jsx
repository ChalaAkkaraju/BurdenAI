// AiAdminTab.jsx — Admin Console › AI: switch AI on/off, choose roles,
// set the per-user daily limit and the anomaly sensitivity, and check the
// connection to the model.

import React, { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle, Server } from "lucide-react";
import { useAi } from "../AiContext.jsx";
import { ROLE_PERMISSIONS } from "../../../context/AppContext";
import { SparkIcon } from "./Drawer.jsx";

export default function AiAdminTab() {
  const ai = useAi();
  const { settings, saveSettings, status } = ai;
  const [checking, setChecking] = useState(false);
  const roles = Object.keys(ROLE_PERMISSIONS);

  const recheck = async () => {
    setChecking(true);
    await ai.refreshStatus();
    setChecking(false);
  };
  const change = (patch, what) => {
    saveSettings(patch);
    ai.audit("AI Settings Changed", what);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex w-10 h-10 rounded-lg bg-slate-900 text-white items-center justify-center"><SparkIcon size={18} className="text-amber-400" /></span>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">AI features</h2>
          <p className="text-sm text-gray-600">Explain this variance and Ask Burden AI use a language model. Anomaly spotting and the learned forecast are statistics that run inside the app and are always on.</p>
        </div>
      </div>

      {/* Connection */}
      <section className="rounded-xl border border-gray-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Server size={16} className="text-gray-500" />
            <h3 className="font-semibold text-gray-900">Model connection</h3>
          </div>
          <button type="button" onClick={recheck} disabled={checking}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw size={14} className={checking ? "animate-spin" : ""} /> Test connection
          </button>
        </div>
        {!status ? (
          <p className="mt-3 text-sm text-gray-500">Checking…</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-500">Model</div>
              <div className="font-medium text-gray-900">{status.model || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status</div>
              {status.enabled && status.reachable ? (
                <div className="flex items-center gap-1.5 font-medium text-blue-700"><CheckCircle size={15} /> Connected</div>
              ) : (
                <div className="flex items-start gap-1.5 font-medium text-orange-700"><AlertCircle size={15} className="mt-0.5 shrink-0" /> {status.error || "Not available"}</div>
              )}
            </div>
            <div>
              <div className="text-xs text-gray-500">Server requests today</div>
              <div className="font-medium text-gray-900">{status.usedToday ?? 0} of {status.dailyLimit ?? "—"}</div>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-500">
          The model is set on the server: <code className="px-1 bg-gray-100 rounded">AI_PROVIDER=local</code> uses Ollama on the same machine;{" "}
          <code className="px-1 bg-gray-100 rounded">AI_PROVIDER=anthropic</code> with <code className="px-1 bg-gray-100 rounded">ANTHROPIC_API_KEY</code> uses Claude.
          The key stays on the server and is never sent to the browser.
        </p>
      </section>

      {/* On / off and roles */}
      <section className="rounded-xl border border-gray-200 p-5 space-y-4">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block font-semibold text-gray-900">AI explanations and questions</span>
            <span className="block text-sm text-gray-600">When off, Explain shows a plain explanation written from the figures, and Ask is hidden.</span>
          </span>
          <input type="checkbox" role="switch" className="w-5 h-5 accent-slate-900" checked={settings.enabled}
            onChange={(e) => change({ enabled: e.target.checked }, `AI features turned ${e.target.checked ? "on" : "off"}`)} />
        </label>

        <div>
          <div className="text-sm font-semibold text-gray-900">Roles that can use AI</div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {roles.map((r) => {
              const on = settings.roles?.[r] !== false;
              return (
                <label key={r} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${on ? "border-slate-300 bg-slate-50" : "border-gray-200"} ${settings.enabled ? "" : "opacity-50"}`}>
                  <input type="checkbox" className="accent-slate-900" checked={on} disabled={!settings.enabled}
                    onChange={(e) => change({ roles: { ...settings.roles, [r]: e.target.checked } }, `AI ${e.target.checked ? "enabled" : "disabled"} for role ${r}`)} />
                  {r}
                </label>
              );
            })}
          </div>
        </div>
      </section>

      {/* Limits */}
      <section className="rounded-xl border border-gray-200 p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
        <label className="block">
          <span className="block text-sm font-semibold text-gray-900">Daily AI requests per user</span>
          <span className="block text-xs text-gray-500 mb-2">0 = no limit. The server also has its own overall daily limit.</span>
          <input type="number" min={0} max={1000} value={settings.dailyLimitPerUser}
            onChange={(e) => saveSettings({ dailyLimitPerUser: Math.max(0, Math.min(1000, Number(e.target.value) || 0)) })}
            onBlur={() => ai.audit("AI Settings Changed", `Daily AI requests per user set to ${settings.dailyLimitPerUser}`)}
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-gray-900">Anomaly sensitivity</span>
          <span className="block text-xs text-gray-500 mb-2">Robust z-score cutoff. Lower flags more months; 3.5 is the usual choice.</span>
          <select value={settings.anomalyCutoff}
            onChange={(e) => change({ anomalyCutoff: Number(e.target.value) }, `Anomaly cutoff set to ${e.target.value}`)}
            className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value={2.5}>2.5 — more sensitive</option>
            <option value={3}>3.0</option>
            <option value={3.5}>3.5 — standard</option>
            <option value={4.5}>4.5 — only the clearest</option>
          </select>
        </label>
      </section>

      <p className="text-xs text-gray-500">
        Every AI explanation and question is recorded in the Audit tab with the model used and the result of the number check.
        Only cost-center and country totals are sent to the model — never employee names or pay.
      </p>
    </div>
  );
}
