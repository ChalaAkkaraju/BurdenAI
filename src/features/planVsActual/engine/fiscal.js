// fiscal.js
// Fiscal-year helpers. The app's data runs April → March, so a fiscal year is
// named by the calendar year it ends in: FY2026 = Apr 2025 … Mar 2026.

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fiscalYearOf(period) {
  const [y, m] = String(period).split("-").map(Number);
  return m >= 4 ? y + 1 : y;
}

// The 12 periods ("YYYY-MM") of a fiscal year, April first.
export function fiscalMonths(fy) {
  const out = [];
  for (let i = 0; i < 12; i++) {
    const m = ((3 + i) % 12) + 1; // 4..12, 1..3
    const y = m >= 4 ? fy - 1 : fy;
    out.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

// Fiscal years that have at least one month of actuals AND a complete prior
// year (the prior year is what a plan is built from). The current, still-open
// year qualifies, so it can be compared year to date. Newest first.
export function plannableFiscalYears(periods) {
  const set = new Set(periods);
  const complete = (fy) => fiscalMonths(fy).every((p) => set.has(p));
  const fys = [...new Set(periods.map(fiscalYearOf))];
  return fys.filter((fy) => complete(fy - 1) && fiscalMonths(fy).some((p) => set.has(p))).sort((a, b) => b - a);
}

// The months of a fiscal year that have actuals, in order.
export function availableMonths(fy, periods) {
  const set = new Set(periods);
  return fiscalMonths(fy).filter((p) => set.has(p));
}

export function monthLabel(period, withYear = true) {
  const [y, m] = String(period).split("-").map(Number);
  return withYear ? `${MONTH_NAMES[m - 1]} ${y}` : MONTH_NAMES[m - 1];
}

export function calendarMonth(period) {
  return Number(String(period).split("-")[1]);
}
