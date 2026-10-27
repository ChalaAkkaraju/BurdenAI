import { describe, it, expect } from "vitest";
import { shiftPeriod, periodLabel, periodFromLabel, backtest, scorecard, snapshotAccuracy, utilizationHistory } from "./engine.js";
import { forecast } from "../forecast/engine/forecastEngine.js";
import { fiscalMonths } from "../planVsActual/engine/fiscal.js";
import { buildActuals } from "../planVsActual/engine/actuals.js";

const close = (a, b, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe("period helpers", () => {
  it("shifts and labels periods", () => {
    expect(shiftPeriod("2026-09", -12)).toBe("2025-09");
    expect(shiftPeriod("2026-01", -1)).toBe("2025-12");
    expect(shiftPeriod("2025-12", 1)).toBe("2026-01");
    expect(periodLabel("2026-09")).toBe("Sep 2026");
  });
  it("reads the baseline month from a snapshot label", () => {
    expect(periodFromLabel("Sep 2026 actual")).toBe("2026-09");
    expect(periodFromLabel("March 2025 actual")).toBe("2025-03");
    expect(periodFromLabel("reference period")).toBeNull();
  });
});

// Two years of flat-ish monthly data.
const periodData = [];
for (const y of [2024, 2025, 2026]) for (let m = 1; m <= 12; m++) {
  const period = `${y}-${String(m).padStart(2, "0")}`;
  const grow = y === 2024 ? 1 : y === 2025 ? 1.04 : 1.07;
  periodData.push({ period, totalCostToCompany: 1_000_000 * grow, totalHours: 10_000, employeeCount: 100 });
}
const scenarios = [
  { id: "base", name: "Base", drivers: { inflationPct: 4, productivityPct: 0, aopHeadcountDeltaPct: 0 } },
  { id: "high", name: "High", drivers: { inflationPct: 10, productivityPct: 0, aopHeadcountDeltaPct: 0 } },
];

describe("backtest", () => {
  const rows = backtest({ periodData, scenarios, asOfPeriod: "2026-09", years: 4 });
  it("only uses anchors with a baseline 12 months earlier", () => {
    // 2026-09 (base 2025-09) and 2025-09 (base 2024-09); 2024-09 has no baseline
    expect(new Set(rows.map((r) => r.actualPeriod))).toEqual(new Set(["2026-09", "2025-09"]));
    expect(rows).toHaveLength(4);
  });
  it("uses the forecast engine from the baseline month", () => {
    const r = rows.find((x) => x.actualPeriod === "2025-09" && x.scenarioId === "base");
    const f = forecast({ baseline: { totalBurden: 1_000_000, headcount: 100, productiveHours: 10_000 }, drivers: scenarios[0].drivers });
    close(r.forecastCost, f.forecastedTotal, 1e-6);
    close(r.costErrPct, f.forecastedTotal / 1_040_000 - 1, 1e-12);
  });
  it("scores scenarios: lowest mean absolute error first", () => {
    const s = scorecard(rows);
    expect(s[0].scenarioId).toBe("base");
    expect(s[0].tests).toBe(2);
    expect(s[1].costBias).toBeGreaterThan(0); // High over-forecasts
  });
});

describe("snapshot accuracy", () => {
  const snaps = [
    { id: "s1", name: "Old", baselineLabel: "Sep 2025 actual", activeScenarioId: "base", createdAt: "2025-10-02",
      scenarios: [{ id: "base", name: "Base", forecastedTotal: 1_100_000, forecastedRate: 110 }] },
    { id: "s2", name: "New", baselineLabel: "Sep 2026 actual", activeScenarioId: "base", createdAt: "2026-10-02",
      scenarios: [{ id: "base", name: "Base", forecastedTotal: 1_150_000, forecastedRate: 112 }] },
  ];
  const rows = snapshotAccuracy({ snapshots: snaps, periodData });
  it("scores due snapshots and lists the rest as not yet due", () => {
    const old = rows.find((r) => r.snapshotId === "s1");
    expect(old.status).toBe("Scored");
    expect(old.duePeriod).toBe("2026-09");
    close(old.costErrPct, 1_100_000 / 1_070_000 - 1);
    const nw = rows.find((r) => r.snapshotId === "s2");
    expect(nw.status).toBe("Not yet due");
    expect(nw.duePeriod).toBe("2027-09");
    expect(nw.costErrPct).toBeNull();
  });
});

describe("utilization history", () => {
  const employeeMap = {
    e1: { costCenterId: "CC-1", costCenterName: "A", departmentId: "D1", departmentName: "Software Engineering", companyCodeName: "Automation", countryCode: "US", fte: 1 },
    e2: { costCenterId: "CC-2", costCenterName: "B", departmentId: "D2", departmentName: "Finance & Admin", companyCodeName: "Automation", countryCode: "DE", fte: 1 },
  };
  const periods = [...fiscalMonths(2025), ...fiscalMonths(2026), "2026-04", "2026-05"];
  const costData = periods.flatMap((period) => [
    { employeeId: "e1", period, productiveHours: 170, totalCostToCompany: 15000 },
    { employeeId: "e2", period, productiveHours: 150, totalCostToCompany: 12000 },
  ]);
  const actuals = buildActuals({ costData, employeeMap });
  it("covers every plannable year, oldest first, open year marked partial", () => {
    const h = utilizationHistory({ actuals, periods, targets: { defaultPct: 85 } });
    expect(h.map((y) => y.fy)).toEqual([2026, 2027]);
    expect(h[1].partial).toBe(true);
    expect(h[1].months).toEqual(["2026-04", "2026-05"]);
    expect([...h[0].byCountry.keys()].sort()).toEqual(["DE", "US"]);
    const sum = [...h[0].byCountry.values()].reduce((a, s) => a + s.absorption, 0);
    close(sum, h[0].total.absorption, 1e-6);
  });
  it("respects country scope", () => {
    const h = utilizationHistory({ actuals, periods, targets: {}, inScope: (c) => c === "DE" });
    expect([...h[0].byCountry.keys()]).toEqual(["DE"]);
  });
});
