// settings.js — admin settings for the AI features and per-user daily usage.
// Kept in the browser like the rest of the app's settings.

export const AI_SETTINGS_KEY = "burdenai_ai_settings";
const USAGE_KEY = "burdenai_ai_usage";

export const DEFAULT_AI_SETTINGS = {
  enabled: true,
  // Role → false to turn AI off for that role. Missing roles are on.
  roles: {},
  dailyLimitPerUser: 50,
  anomalyCutoff: 3.5,
};

export function aiAllowedFor(user, settings) {
  if (!user) return { ok: false, reason: "Not signed in" };
  const s = { ...DEFAULT_AI_SETTINGS, ...(settings || {}) };
  if (!s.enabled) return { ok: false, reason: "AI features are turned off by your administrator." };
  if (s.roles?.[user.role] === false) return { ok: false, reason: `AI features are not enabled for the ${user.role} role.` };
  return { ok: true };
}

const today = () => new Date().toISOString().slice(0, 10);

export function usageToday(user) {
  try {
    const u = JSON.parse(localStorage.getItem(USAGE_KEY) || "{}");
    return u.day === today() ? u.byUser?.[user?.email || user?.username] || 0 : 0;
  } catch {
    return 0;
  }
}

export function recordUse(user) {
  try {
    const u = JSON.parse(localStorage.getItem(USAGE_KEY) || "{}");
    const fresh = u.day === today() ? u : { day: today(), byUser: {} };
    const k = user?.email || user?.username || "unknown";
    fresh.byUser[k] = (fresh.byUser[k] || 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(fresh));
  } catch { /* best effort */ }
}
