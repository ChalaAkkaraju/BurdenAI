// actuals.js
// Builds actual hours and cost per cost center per month from the app's
// employee cost records.
//
// The cost records carry "paid hours" (standard hours × FTE) and total cost.
// They do not split time into holidays, leave and productive work, so until a
// timesheet / HR feed is connected this module derives that split:
//   holidays   = paid × country holiday %   (seasonal by calendar month)
//   leave      = paid × country leave %     (seasonal by calendar month)
//   available  = paid − holidays − leave
//   productive = available × utilization    (by department, varies by month/year)
// Every split is deterministic, so numbers are the same on every load.

import { calendarMonth, fiscalYearOf } from "./fiscal.js";
import { between } from "./hash.js";

export const HOLIDAY_PCT = { US: 0.042, GB: 0.036, DE: 0.042, IN: 0.055, JP: 0.06, BR: 0.05, SG: 0.044, AU: 0.044 };
export const LEAVE_PCT = { US: 0.07, GB: 0.10, DE: 0.12, IN: 0.07, JP: 0.06, BR: 0.09, SG: 0.07, AU: 0.09 };

// Calendar-month weights (Jan..Dec); each set averages to 1.0.
const HOLIDAY_W = [1.3, 0.7, 0.6, 1.1, 1.2, 0.6, 0.9, 0.9, 0.8, 0.8, 1.0, 2.1];
const LEAVE_W_RAW = [0.8, 0.8, 1.0, 1.0, 1.0, 1.1, 1.5, 1.5, 0.9, 0.9, 0.9, 1.6];
const LEAVE_SUM = LEAVE_W_RAW.reduce((a, b) => a + b, 0);
const LEAVE_W = LEAVE_W_RAW.map((w) => (w * 12) / LEAVE_SUM);

// Typical share of available time booked to productive work, by department.
export const UTIL_BASE = {
  "Software Engineering": 0.86,
  "Data & Analytics": 0.84,
  "Product & Design": 0.82,
  "Finance & Admin": 0.72,
  "Manufacturing": 0.9,
  "Quality & Safety": 0.8,
  "Logistics": 0.85,
  "Process Engineering": 0.84,
  "R&D Lab": 0.78,
  "Procurement": 0.76,
};
const DEFAULT_UTIL = 0.82;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r2 = (v) => Math.round(v * 100) / 100;

export function actualUtilization(costCenterId, departmentName, period) {
  const base = UTIL_BASE[departmentName] ?? DEFAULT_UTIL;
  const fy = fiscalYearOf(period);
  const u =
    base +
    between(`cc|${costCenterId}`, -0.03, 0.03) +
    between(`fy|${costCenterId}|${fy}`, -0.035, 0.025) +
    between(`m|${costCenterId}|${period}`, -0.02, 0.02) +
    (calendarMonth(period) === 12 ? -0.02 : 0) +
    (calendarMonth(period) === 8 ? -0.01 : 0);
  return clamp(u, 0.5, 0.97);
}

// Returns an array of { key, costCenterId, period, ... } — one per cost center per month.
export function buildActuals({ costData, employeeMap }) {
  const groups = new Map();
  for (const rec of costData) {
    const emp = employeeMap[rec.employeeId];
    if (!emp) continue;
    const key = `${emp.costCenterId}|${rec.period}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        costCenterId: emp.costCenterId,
        costCenterName: emp.costCenterName,
        departmentId: emp.departmentId,
        departmentName: emp.departmentName,
        vertical: emp.companyCodeName,
        countryCode: emp.countryCode,
        period: rec.period,
        paid: 0,
        cost: 0,
        fte: 0,
        headcount: 0,
      };
      groups.set(key, g);
    }
    g.paid += rec.productiveHours;
    g.cost += rec.totalCostToCompany;
    g.fte += emp.fte ?? 1;
    g.headcount += 1;
  }

  const out = [];
  for (const g of groups.values()) {
    const m = calendarMonth(g.period) - 1;
    const holidays = g.paid * (HOLIDAY_PCT[g.countryCode] ?? 0.045) * HOLIDAY_W[m];
    const leave = g.paid * (LEAVE_PCT[g.countryCode] ?? 0.08) * LEAVE_W[m];
    const available = Math.max(0, g.paid - holidays - leave);
    const util = actualUtilization(g.costCenterId, g.departmentName, g.period);
    const productive = available * util;
    out.push({
      ...g,
      paid: r2(g.paid),
      cost: r2(g.cost),
      fte: r2(g.fte),
      holidays: r2(holidays),
      leave: r2(leave),
      available: r2(available),
      productive: r2(productive),
      nonProductive: r2(available - productive),
    });
  }
  return out;
}
