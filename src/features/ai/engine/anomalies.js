// anomalies.js
// Spots cost-center months that sit well outside that cost center's own
// normal range. No thresholds to set per cost center.
//
// For each cost center and measure (burden rate, cost per FTE, utilization):
//   change    = this month vs the same month last year
//               (log ratio for money, point difference for utilization).
//               Comparing with the same month removes the usual seasonal
//               pattern, so an expected January pay rise is not flagged.
//   normal    = the median of the same change over the previous 12 months
//   spread    = 1.4826 × median absolute deviation of those 12 changes
//               (a "robust" standard deviation, not thrown off by one odd month),
//               with a small floor so very steady series do not over-flag
//   z         = (change − normal) ÷ spread
// A month is flagged when |z| ≥ the cutoff (3.5 by default).

export const DEFAULT_CUTOFF = 3.5;

export const MEASURES = [
  { id: "rate", label: "Burden rate", kind: "money", unit: "/hr", floor: 0.01, value: (a) => (a.productive > 0 ? a.cost / a.productive : null) },
  { id: "costPerFte", label: "Cost per FTE", kind: "money", unit: "", floor: 0.01, value: (a) => (a.fte > 0 ? a.cost / a.fte : null) },
  { id: "util", label: "Utilization", kind: "pct", unit: "", floor: 0.75, value: (a) => (a.available > 0 ? (a.productive / a.available) * 100 : null) },
];

function shift(period, months) {
  const [y, m] = String(period).split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN;
};

function change(measure, now, before) {
  if (now == null || before == null) return null;
  if (measure.kind === "money") return now > 0 && before > 0 ? Math.log(now / before) : null;
  return now - before; // points
}

// actuals: rows from planVsActual/engine/actuals.js buildActuals.
// period: the month to check, e.g. "2026-09".
export function detectAnomalies({ actuals, period, cutoff = DEFAULT_CUTOFF, inScope = () => true }) {
  const byCc = new Map();
  for (const a of actuals) {
    if (!inScope(a.countryCode)) continue;
    if (!byCc.has(a.costCenterId)) byCc.set(a.costCenterId, { info: a, rows: new Map() });
    byCc.get(a.costCenterId).rows.set(a.period, a);
  }

  const found = [];
  for (const { info, rows } of byCc.values()) {
    const cur = rows.get(period);
    if (!cur) continue;
    for (const m of MEASURES) {
      const val = (p) => { const r = rows.get(p); return r ? m.value(r) : null; };
      const now = val(period);
      const lastYear = val(shift(period, -12));
      const c = change(m, now, lastYear);
      if (c == null) continue;
      const hist = [];
      for (let k = 1; k <= 12; k++) {
        const p = shift(period, -k);
        const h = change(m, val(p), val(shift(p, -12)));
        if (h != null) hist.push(h);
      }
      if (hist.length < 9) continue; // not enough history to judge
      const med = median(hist);
      const mad = median(hist.map((h) => Math.abs(h - med)));
      const spread = Math.max(1.4826 * mad, m.floor);
      const z = (c - med) / spread;
      if (Math.abs(z) < cutoff) continue;
      const expected = m.kind === "money" ? lastYear * Math.exp(med) : lastYear + med;
      found.push({
        costCenterId: info.costCenterId,
        departmentName: info.departmentName,
        countryCode: info.countryCode,
        measure: m.id,
        measureLabel: m.label,
        kind: m.kind,
        period,
        value: now,
        expected,
        lastYear,
        z,
        direction: z > 0 ? "up" : "down",
        // Is the move bad for cost? Higher rate/cost or lower utilization is.
        unfavourable: m.id === "util" ? z < 0 : z > 0,
        cost: cur.cost,
        fte: cur.fte,
      });
    }
  }
  found.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  return found;
}
