import { describe, it, expect } from "vitest";
import { parseAOPCsv, computeAOPOverrides } from "./aopParser.js";

describe("parseAOPCsv", () => {
  it("parses a clean two-column CSV", () => {
    const csv = `country,planned_headcount
US,220
IN,200
GB,40`;
    const { rows, errors } = parseAOPCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { countryCode: "US", plannedHeadcount: 220 },
      { countryCode: "IN", plannedHeadcount: 200 },
      { countryCode: "GB", plannedHeadcount: 40 },
    ]);
  });

  it("accepts alternate header names", () => {
    const csv = `Country Code,Headcount Plan
us,150
de,80`;
    const { rows, errors } = parseAOPCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0].countryCode).toBe("US");
  });

  it("normalizes country codes to uppercase", () => {
    const { rows } = parseAOPCsv(`country,headcount\nus,100\nin,50`);
    expect(rows.map((r) => r.countryCode)).toEqual(["US", "IN"]);
  });

  it("flags missing country column", () => {
    const csv = `region,headcount\nus,100`;
    const { errors } = parseAOPCsv(csv);
    expect(errors[0]).toMatch(/Missing country column/);
  });

  it("flags missing headcount column", () => {
    const csv = `country,foo\nus,100`;
    const { errors } = parseAOPCsv(csv);
    expect(errors[0]).toMatch(/Missing headcount column/);
  });

  it("rejects negative or non-numeric headcounts but keeps valid rows", () => {
    const csv = `country,headcount
US,200
IN,abc
DE,-5
GB,40`;
    const { rows, errors } = parseAOPCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.countryCode)).toEqual(["US", "GB"]);
    expect(errors).toHaveLength(2);
  });

  it("returns empty result on empty input", () => {
    expect(parseAOPCsv("").rows).toEqual([]);
    expect(parseAOPCsv("").errors[0]).toMatch(/Empty CSV/);
  });

  it("requires at least header + 1 data row", () => {
    const { errors } = parseAOPCsv(`country,headcount`);
    expect(errors[0]).toMatch(/at least one data row/);
  });
});

describe("computeAOPOverrides", () => {
  const countryBaselines = [
    { countryCode: "US", headcount: 200 },
    { countryCode: "IN", headcount: 180 },
    { countryCode: "DE", headcount:  76 },
  ];

  it("computes delta % per country from planned headcount", () => {
    const aop = [
      { countryCode: "US", plannedHeadcount: 220 },  // +10%
      { countryCode: "IN", plannedHeadcount: 198 },  // +10%
      { countryCode: "DE", plannedHeadcount:  72 },  // ~-5.26%
    ];
    const { overrides, warnings } = computeAOPOverrides(aop, countryBaselines);
    expect(overrides.US.aopHeadcountDeltaPct).toBeCloseTo(10);
    expect(overrides.IN.aopHeadcountDeltaPct).toBeCloseTo(10);
    expect(overrides.DE.aopHeadcountDeltaPct).toBeCloseTo(-5.263, 2);
    expect(warnings).toEqual([]);
  });

  it("warns when AOP row references unknown country", () => {
    const aop = [
      { countryCode: "US", plannedHeadcount: 220 },
      { countryCode: "FR", plannedHeadcount: 50 },  // not in baseline
    ];
    const { overrides, warnings } = computeAOPOverrides(aop, countryBaselines);
    expect(overrides.FR).toBeUndefined();
    expect(warnings[0]).toMatch(/FR.*no matching baseline/);
  });

  it("warns on zero-baseline country and skips override", () => {
    const aop = [{ countryCode: "ZZ", plannedHeadcount: 100 }];
    const baselines = [{ countryCode: "ZZ", headcount: 0 }];
    const { overrides, warnings } = computeAOPOverrides(aop, baselines);
    expect(overrides.ZZ).toBeUndefined();
    expect(warnings[0]).toMatch(/zero baseline headcount/);
  });

  it("countries missing from AOP get no override (fall back to global)", () => {
    const aop = [{ countryCode: "US", plannedHeadcount: 220 }];
    const { overrides } = computeAOPOverrides(aop, countryBaselines);
    expect(overrides.IN).toBeUndefined();
    expect(overrides.DE).toBeUndefined();
  });
});
