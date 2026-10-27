// format.js — display helpers for Plan vs Actual. Amounts are stored in USD;
// `cur` = { symbol, fx } converts for local-currency display.

export const USD = { symbol: "$", fx: 1, code: "USD" };

export function money(usd, cur = USD, { signed = false, decimals } = {}) {
  if (usd == null || !isFinite(usd)) return "—";
  const v = usd * (cur.fx ?? 1);
  const a = Math.abs(v);
  let s;
  if (a >= 1e9) s = `${(a / 1e9).toFixed(decimals ?? 2)}B`;
  else if (a >= 1e6) s = `${(a / 1e6).toFixed(decimals ?? 2)}M`;
  else if (a >= 1e3) s = `${(a / 1e3).toFixed(decimals ?? 1)}K`;
  else s = a.toFixed(0);
  const sign = v < 0 ? "−" : signed && v > 0 ? "+" : "";
  return `${sign}${cur.symbol}${s}`;
}

export function rate(usd, cur = USD) {
  if (usd == null || !isFinite(usd)) return "—";
  return `${cur.symbol}${(usd * (cur.fx ?? 1)).toFixed(2)}/hr`;
}

export function pct(fraction, digits = 1) {
  if (fraction == null || !isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function pts(points, digits = 1) {
  if (points == null || !isFinite(points)) return "—";
  const sign = points > 0.05 ? "+" : points < -0.05 ? "−" : "±";
  return `${sign}${Math.abs(points).toFixed(digits)} pts`;
}

export function num(v, digits = 0) {
  if (v == null || !isFinite(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function signedNum(v, digits = 1) {
  if (v == null || !isFinite(v)) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "−" : "±";
  return `${sign}${Math.abs(v).toFixed(digits)}`;
}

// Tailwind text colours for favourable / unfavourable (blue / orange, colour-blind safe).
export const tone = (favourable) => (favourable ? "text-blue-700" : "text-orange-700");
