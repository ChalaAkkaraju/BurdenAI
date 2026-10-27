// holtWinters.js
// The "learned forecast": a seasonal trend model (Holt-Winters, multiplicative
// seasons, additive trend) fitted on monthly burden cost history. It runs in
// the browser; no outside service.
//
//   level_t  = α · y_t / season_{t−m} + (1 − α) · (level_{t−1} + trend_{t−1})
//   trend_t  = β · (level_t − level_{t−1}) + (1 − β) · trend_{t−1}
//   season_t = γ · y_t / level_t + (1 − γ) · season_{t−m}
//   forecast_{t+h} = (level_t + h · trend_t) · season_{t+h−m}
//
// α, β, γ are chosen by a grid search that minimises one-step-ahead squared
// error. The 80% range comes from the spread of the model's own h-step errors
// on the history (an empirical interval), widened by √h when there are few.

const SEASON = 12;

function fitOnce(y, alpha, beta, gamma, m = SEASON) {
  const n = y.length;
  // Initial level/trend from the first two seasons; initial seasonals from season 1.
  const mean1 = y.slice(0, m).reduce((a, b) => a + b, 0) / m;
  const mean2 = y.slice(m, 2 * m).reduce((a, b) => a + b, 0) / m;
  let level = mean1;
  let trend = (mean2 - mean1) / m;
  const season = y.slice(0, m).map((v) => v / mean1);
  const fitted = new Array(n).fill(null);
  let sse = 0;
  let count = 0;
  for (let t = m; t < n; t++) {
    const s = season[t - m];
    const yhat = (level + trend) * s;
    fitted[t] = yhat;
    const e = y[t] - yhat;
    if (t >= 2 * m) { sse += e * e; count++; }
    const prevLevel = level;
    level = alpha * (y[t] / s) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    season.push(gamma * (y[t] / level) + (1 - gamma) * s);
  }
  return { level, trend, season, fitted, mse: count ? sse / count : Infinity };
}

const GRID = [0.05, 0.1, 0.2, 0.3, 0.5, 0.7];
const GRID_B = [0.01, 0.05, 0.1, 0.2];
const GRID_G = [0.05, 0.1, 0.2, 0.4];

export function fitHoltWinters(y, m = SEASON) {
  if (!Array.isArray(y) || y.length < 2 * m + 2) return null;
  let best = null;
  for (const a of GRID) for (const b of GRID_B) for (const g of GRID_G) {
    const r = fitOnce(y, a, b, g, m);
    if (!best || r.mse < best.mse) best = { ...r, alpha: a, beta: b, gamma: g };
  }
  return { ...best, n: y.length, m };
}

export function predict(model, h) {
  const { level, trend, season, n, m } = model;
  // season array holds one value per observed month; index n + h − 1 − m
  // is the latest estimate for the same calendar month.
  const out = [];
  for (let k = 1; k <= h; k++) {
    let idx = n + k - 1 - m;
    while (idx >= season.length) idx -= m;
    out.push((level + k * trend) * season[idx]);
  }
  return out;
}

// h-step-ahead relative errors on the history (refitting is too slow in the
// browser, so the fitted smoothing constants are reused and the state is
// re-run up to each origin).
function horizonErrors(y, model, h, m = SEASON) {
  const errs = [];
  for (let origin = 2 * m + 2; origin + h <= y.length; origin++) {
    const r = fitOnce(y.slice(0, origin), model.alpha, model.beta, model.gamma, m);
    const f = predict({ ...r, n: origin, m }, h)[h - 1];
    const actual = y[origin + h - 1];
    if (actual > 0) errs.push((actual - f) / f);
  }
  return errs;
}

const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
};

// Fits on `values` (oldest first) and forecasts `h` months ahead with an 80% range.
export function learnedForecast(values, h = 12) {
  const model = fitHoltWinters(values);
  if (!model) return null;
  const path = predict(model, h);
  const errs = horizonErrors(values, model, h);
  let lo10;
  let hi90;
  if (errs.length >= 8) {
    lo10 = quantile(errs, 0.1);
    hi90 = quantile(errs, 0.9);
  } else {
    // Fallback: one-step error spread widened by √h.
    const resid = model.fitted.map((f, i) => (f ? (values[i] - f) / f : null)).filter((e) => e != null);
    const sd = Math.sqrt(resid.reduce((a, e) => a + e * e, 0) / Math.max(1, resid.length));
    lo10 = -1.2816 * sd * Math.sqrt(h);
    hi90 = 1.2816 * sd * Math.sqrt(h);
  }
  const range = path.map((v, i) => {
    const scale = Math.sqrt((i + 1) / h); // narrower for nearer months
    return { low: v * (1 + lo10 * scale), high: v * (1 + hi90 * scale) };
  });
  return { model, path, range, fittedOn: values.length, backtestErrors: errs };
}
