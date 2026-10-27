import { describe, it, expect } from "vitest";
import { fiscalYearOf, fiscalMonths, plannableFiscalYears, availableMonths, monthLabel } from "./fiscal.js";
import { hash01, between } from "./hash.js";
import { buildActuals, actualUtilization } from "./actuals.js";
import { annualByCostCenter, derivePlan, snapshotFactors, applyUploads, SAMPLE_INFLATION } from "./plan.js";
import { buildLine, buildLines, summarize, groupBy, needsReview, monthlyTrend, resolveTargetPct } from "./variance.js";
import { parsePlanCsv, parseTargetsCsv, buildPlanTemplateCsv, buildTargetsCsv } from "./csv.js";

const close = (a, b, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe("fiscal", () => {
  it("names a fiscal year by the year it ends in (Apr–Mar)", () => {
    expect(fiscalYearOf("2025-04")).toBe(2026);
    expect(fiscalYearOf("2026-03")).toBe(2026);
    expect(fiscalYearOf("2025-03")).toBe(2025);
  });
  it("lists 12 months April first", () => {
    const m = fiscalMonths(2026);
    expect(m).toHaveLength(12);
    expect(m[0]).toBe("2025-04");
    expect(m[8]).toBe("2025-12");
    expect(m[11]).toBe("2026-03");
  });
  it("offers years with a complete prior year, including the open current year", () => {
    const periods = [...fiscalMonths(2024), ...fiscalMonths(2025), ...fiscalMonths(2026), "2026-04", "2026-05"];
    expect(plannableFiscalYears(periods)).toEqual([2027, 2026, 2025]);
    expect(availableMonths(2027, periods)).toEqual(["2026-04", "2026-05"]);
    expect(availableMonths(2026, periods)).toHaveLength(12);
  });
  it("labels months", () => {
    expect(monthLabel("2025-12")).toBe("Dec 2025");
    expect(monthLabel("2025-12", false)).toBe("Dec");
  });
});

describe("hash", () => {
  it("is deterministic and within range", () => {
    expect(hash01("abc")).toBe(hash01("abc"));
    expect(hash01("abc")).not.toBe(hash01("abd"));
    for (let i = 0; i < 50; i++) {
      const v = between(`k${i}`, -0.05, 0.05);
      expect(v).toBeGreaterThanOrEqual(-0.05);
      expect(v).toBeLessThan(0.05);
    }
  });
});

const employeeMap = {
  e1: { costCenterId: "CC-1", costCenterName: "Eng CC", departmentId: "D1", departmentName: "Software Engineering", companyCodeName: "Automation", countryCode: "US", fte: 1 },
  e2: { costCenterId: "CC-1", costCenterName: "Eng CC", departmentId: "D1", departmentName: "Software Engineering", companyCodeName: "Automation", countryCode: "US", fte: 0.8 },
  e3: { costCenterId: "CC-2", costCenterName: "Fin CC", departmentId: "D2", departmentName: "Finance & Admin", companyCodeName: "Automation", countryCode: "DE", fte: 1 },
};
function costData(periods) {
  const out = [];
  for (const period of periods) {
    out.push({ employeeId: "e1", period, productiveHours: 173.33, totalCostToCompany: 15000 });
    out.push({ employeeId: "e2", period, productiveHours: 138.67, totalCostToCompany: 11000 });
    out.push({ employeeId: "e3", period, productiveHours: 156.67, totalCostToCompany: 13000 });
  }
  return out;
}
const PERIODS = [...fiscalMonths(2025), ...fiscalMonths(2026)];
const actuals = buildActuals({ costData: costData(PERIODS), employeeMap });

describe("actuals", () => {
  it("creates one record per cost center per month", () => {
    expect(actuals).toHaveLength(2 * 24);
  });
  it("splits paid hours into holidays, leave, productive and non-productive", () => {
    for (const a of actuals) {
      close(a.holidays + a.leave + a.available, a.paid, 0.05);
      close(a.productive + a.nonProductive, a.available, 0.05);
      expect(a.productive).toBeLessThan(a.available);
      expect(a.holidays).toBeGreaterThan(0);
    }
  });
  it("sums cost, FTE and headcount from employees", () => {
    const a = actuals.find((x) => x.costCenterId === "CC-1" && x.period === "2025-07");
    expect(a.cost).toBe(26000);
    close(a.fte, 1.8);
    expect(a.headcount).toBe(2);
  });
  it("utilization is deterministic and realistic", () => {
    const u = actualUtilization("CC-1", "Software Engineering", "2025-07");
    expect(u).toBe(actualUtilization("CC-1", "Software Engineering", "2025-07"));
    expect(u).toBeGreaterThan(0.75);
    expect(u).toBeLessThan(0.95);
    expect(actualUtilization("CC-2", "Finance & Admin", "2025-07")).toBeLessThan(u);
  });
});

describe("plan", () => {
  const prior = annualByCostCenter(actuals, 2025);

  it("sums the prior year per cost center", () => {
    const p = prior.get("CC-1");
    expect(p.months).toBe(12);
    expect(p.cost).toBe(26000 * 12);
    close(p.fte, 1.8);
  });

  it("sample plan spreads evenly and applies inflation to cost", () => {
    const plan = derivePlan({ priorAnnual: prior, fy: 2026, source: "sample" });
    expect(plan.size).toBe(2 * 12);
    const jul = plan.get("CC-1|2025-07");
    const dec = plan.get("CC-1|2025-12");
    expect(jul.cost).toBe(dec.cost);
    expect(jul.productive).toBe(dec.productive);
    expect(jul.source).toBe("Sample plan");
    const annualCost = jul.cost * 12;
    const hc = jul.fte / prior.get("CC-1").fte;
    close(annualCost, prior.get("CC-1").cost * hc * (1 + SAMPLE_INFLATION), 1e-3);
    expect(hc).toBeGreaterThan(0.93);
    expect(hc).toBeLessThan(1.09);
    expect(jul.productive).toBeLessThanOrEqual(jul.available);
  });

  it("reads factors from a forecast snapshot", () => {
    const snap = {
      baseline: { totalBurden: 1000, headcount: 100, productiveHours: 10 },
      activeScenarioId: "base",
      scenarios: [{ id: "base", name: "Base", forecastedTotal: 1155, forecastedHeadcount: 110 }],
    };
    const f = snapshotFactors(snap);
    close(f.hcFactor, 1.1);
    close(f.costGrowth, 1.155);
    close(f.rateFactor, 1.05);
    expect(snapshotFactors({ baseline: {}, scenarios: [] })).toBeNull();
    expect(snapshotFactors(null)).toBeNull();
  });

  it("snapshot plan scales every cost center the same way", () => {
    const factors = { hcFactor: 1.1, rateFactor: 1.05 };
    const plan = derivePlan({ priorAnnual: prior, fy: 2026, source: "snapshot", factors });
    const p = plan.get("CC-2|2025-05");
    expect(p.source).toBe("From snapshot");
    close(p.cost * 12, prior.get("CC-2").cost * 1.1 * 1.05, 1e-3);
    close(p.available * 12, prior.get("CC-2").available * 1.1, 1e-6);
    close(p.productive / p.available, prior.get("CC-2").productive / prior.get("CC-2").available, 1e-9);
  });

  it("uploads override a month or a whole year, and skip unknown cost centers", () => {
    const base = derivePlan({ priorAnnual: prior, fy: 2026, source: "sample" });
    const rows = [
      { period: "2025-07", costCenter: "CC-1", headcount: null, fte: 3, available: 400, productive: 300, cost: 40000 },
      { period: "FY2026", costCenter: "CC-2", headcount: null, fte: null, available: null, productive: null, cost: 120000 },
      { period: "2025-07", costCenter: "CC-404", fte: 1, cost: 1 },
      { period: "2024-07", costCenter: "CC-1", cost: 1 },
      { period: "FY2027", costCenter: "CC-1", cost: 1 },
    ];
    const r = applyUploads(base, rows, 2026);
    expect(r.applied).toBe(2);
    expect(r.skipped).toHaveLength(1);
    expect(r.costCentersOverridden).toBe(2);
    const jul = r.plan.get("CC-1|2025-07");
    expect(jul).toMatchObject({ source: "Uploaded", fte: 3, available: 400, productive: 300, cost: 40000 });
    expect(r.plan.get("CC-1|2025-08").source).toBe("Sample plan");
    close(r.plan.get("CC-2|2025-11").cost, 10000);
    expect(r.plan.get("CC-2|2025-11").available).toBe(base.get("CC-2|2025-11").available);
    expect(base.get("CC-1|2025-07").source).toBe("Sample plan"); // original untouched
  });
});

describe("variance", () => {
  it("volume + rate = cost variance, and absorption = −rate", () => {
    const l = buildLine(
      { fte: 10, headcount: 10, available: 1600, productive: 1400, cost: 140000 },
      { fte: 11, headcount: 11, available: 1700, productive: 1360, cost: 150000 },
      85,
    );
    // plan rate = 100
    close(l.volume, (1360 - 1400) * 100);
    close(l.rateEffect, 150000 - 1360 * 100);
    close(l.volume + l.rateEffect, l.costVariance);
    close(l.absorption, -l.rateEffect);
    close(l.absorption, 136000 - 150000);
  });

  it("handles missing plan or actual without NaN", () => {
    const l = buildLine(null, { fte: 1, headcount: 1, available: 100, productive: 80, cost: 5000 }, 85);
    expect(Number.isFinite(l.volume)).toBe(true);
    expect(l.costVariance).toBe(5000);
  });

  it("resolves targets: cost center, then company default, then 85", () => {
    expect(resolveTargetPct({ defaultPct: 80, byCostCenter: { A: 90 } }, "A")).toBe(90);
    expect(resolveTargetPct({ defaultPct: 80, byCostCenter: {} }, "B")).toBe(80);
    expect(resolveTargetPct(undefined, "B")).toBe(85);
  });

  const prior = annualByCostCenter(actuals, 2025);
  const plan = derivePlan({ priorAnnual: prior, fy: 2026, source: "sample" });
  const actualsByKey = new Map(actuals.map((a) => [a.key, a]));
  const lines = buildLines({ plan, actualsByKey, periods: fiscalMonths(2026), targets: { defaultPct: 85, byCostCenter: { "CC-2": 72 } } });

  it("builds a line per cost center per month and sums them consistently", () => {
    expect(lines).toHaveLength(24);
    const s = summarize(lines);
    close(s.volume + s.rateEffect, s.costVariance, 1e-4);
    close(s.absorption, -s.rateEffect, 1e-4);
    close(s.costVariance, s.actual.cost - s.plan.cost, 1e-4);
    expect(s.months).toBe(12);
    // FTE is an average across months, not a sum
    close(s.actual.fte, 2.8, 1e-6);
    // target is weighted by available hours
    expect(s.targetUtil).toBeGreaterThan(0.72);
    expect(s.targetUtil).toBeLessThan(0.85);
  });

  it("group totals add up to the overall total", () => {
    const total = summarize(lines);
    const groups = [...groupBy(lines, (l) => l.costCenterId).values()].map(summarize);
    close(groups.reduce((a, g) => a + g.absorption, 0), total.absorption, 1e-4);
    close(groups.reduce((a, g) => a + g.plan.cost, 0), total.plan.cost, 1e-4);
  });

  it("filters by any dimension", () => {
    const de = buildLines({ plan, actualsByKey, periods: fiscalMonths(2026), targets: {}, filter: (i) => i.countryCode === "DE" });
    expect(de).toHaveLength(12);
    expect(de.every((l) => l.costCenterId === "CC-2")).toBe(true);
  });

  it("flags review on target gap or absorption", () => {
    expect(needsReview({ gapToTargetPts: -6, absorptionPct: 0 })).toBe(true);
    expect(needsReview({ gapToTargetPts: -4.9, absorptionPct: 0.01 })).toBe(false);
    expect(needsReview({ gapToTargetPts: 2, absorptionPct: -0.031 })).toBe(true);
    expect(needsReview({ gapToTargetPts: -3, absorptionPct: 0 }, { gapPts: 2, absorptionPct: 0.03 })).toBe(true);
  });

  it("open year: months without actuals keep the plan and target but no actual", () => {
    const partial = new Map([...actualsByKey].filter(([, a]) => a.period <= "2025-06"));
    const ls = buildLines({ plan, actualsByKey: partial, periods: fiscalMonths(2026), targets: { defaultPct: 85 } });
    const t = monthlyTrend(ls, fiscalMonths(2026));
    expect(t.filter((m) => m.hasData)).toHaveLength(3);
    const later = t.find((m) => m.period === "2025-10");
    expect(later.actualUtil).toBeNull();
    expect(later.planUtil).toBeGreaterThan(0);
    expect(later.targetUtil).toBeCloseTo(85, 6);
    expect(later.hasPlan).toBe(true);
  });

  it("monthly trend: plan is flat (even spread), actual varies", () => {
    const t = monthlyTrend(lines, fiscalMonths(2026));
    expect(t).toHaveLength(12);
    const plans = t.map((m) => m.planUtil.toFixed(6));
    expect(new Set(plans).size).toBe(1);
    expect(new Set(t.map((m) => m.actualUtil.toFixed(3))).size).toBeGreaterThan(1);
  });
});

describe("targets", () => {
  it("seeds sample targets by department type, default stays 85", async () => {
    const { sampleTargets } = await import("./targets.js");
    const t = sampleTargets([
      { costCenterId: "A", departmentName: "Software Engineering" },
      { costCenterId: "B", departmentName: "Finance & Admin" },
      { costCenterId: "C", departmentName: "Something new" },
    ]);
    expect(t.byCostCenter).toEqual({ A: 86, B: 72 });
    expect(t.defaultPct).toBe(85);
    expect(resolveTargetPct(t, "C")).toBe(85);
  });
});

describe("csv", () => {
  it("parses a plan file with monthly and yearly rows", () => {
    const text = "Period,Country,CostCenter,PlanHeadcount,PlanFTE,PlanAvailableHours,PlanProductiveHours,PlanBurdenCost\n" +
      "2025-07,US,CC-1,2,1.8,300,250,\"26,000\"\nFY2026,DE,CC-2,,,,,150000\n";
    const r = parsePlanCsv(text);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ period: "2025-07", costCenter: "CC-1", headcount: 2, fte: 1.8, available: 300, productive: 250, cost: 26000 });
    expect(r.rows[1]).toMatchObject({ period: "FY2026", costCenter: "CC-2", cost: 150000, fte: null });
  });

  it("accepts relaxed headers", () => {
    const r = parsePlanCsv("period,cost_center,plan burden cost\n2025-08,CC-1,100\n");
    expect(r.errors).toEqual([]);
    expect(r.rows[0].cost).toBe(100);
  });

  it("reports bad rows with line numbers", () => {
    const r = parsePlanCsv("Period,CostCenter,PlanAvailableHours,PlanProductiveHours\n2025-13,CC-1,10,5\nJuly,CC-1,10,5\n2025-07,,10,5\n2025-07,CC-1,10,50\n2025-07,CC-1,-1,0\n");
    expect(r.rows).toHaveLength(0);
    expect(r.errors).toHaveLength(5);
    expect(r.errors[0]).toMatch(/Row 2/);
    expect(r.errors[3]).toMatch(/more than available/);
  });

  it("rejects files without the required columns", () => {
    expect(parsePlanCsv("").errors[0]).toMatch(/empty/);
    expect(parsePlanCsv("CostCenter,PlanFTE\nCC-1,2\n").errors[0]).toMatch(/Period/);
    expect(parsePlanCsv("Period,CostCenter\n2025-07,CC-1\n").errors[0]).toMatch(/at least one plan column/);
  });

  it("parses targets", () => {
    const r = parseTargetsCsv("CostCenter,TargetUtilizationPct\nCC-1,88\nCC-2,72%\nCC-3,150\n");
    expect(r.byCostCenter).toEqual({ "CC-1": 88, "CC-2": 72 });
    expect(r.errors).toHaveLength(1);
  });

  it("templates round-trip through the parsers", () => {
    const prior = annualByCostCenter(actuals, 2025);
    const plan = derivePlan({ priorAnnual: prior, fy: 2026, source: "sample" });
    const tpl = buildPlanTemplateCsv(plan, 2026);
    const parsed = parsePlanCsv(tpl);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows.map((r) => r.costCenter)).toEqual(["CC-1", "CC-2"]);
    expect(parsed.rows[0].period).toBe("FY2026");
    const t = parseTargetsCsv(buildTargetsCsv(["CC-2", "CC-1"], (cc) => (cc === "CC-1" ? 90 : 85)));
    expect(t.byCostCenter).toEqual({ "CC-1": 90, "CC-2": 85 });
  });
});
