import { describe, it, expect } from "vitest";
import { rowsToKp26Csv, buildKp26Filename, stripMeta } from "./kp26Exporter.js";

const sampleRows = [
  {
    KOKRS: "1000", VERSN: "P1", GJAHR: "2027",
    VON_PERIOD: 1, BIS_PERIOD: 12,
    KOSTL: "USCC10000", LSTAR: "BURDEN",
    PLNMG: 20000, MEINS: "HR",
    TKF: 77.46, TKV: 0, WAERS: "USD", TKG: "1",
    _meta: { countryCode: "US", forecastedTotal: 1_000_000 },
  },
  {
    KOKRS: "1000", VERSN: "P1", GJAHR: "2027",
    VON_PERIOD: 1, BIS_PERIOD: 12,
    KOSTL: "INCC20000", LSTAR: "BURDEN",
    PLNMG: 19583, MEINS: "HR",
    TKF: 29.93, TKV: 0, WAERS: "USD", TKG: "1",
  },
];

describe("rowsToKp26Csv", () => {
  it("emits the SAP column header in the right order", () => {
    const csv = rowsToKp26Csv([]);
    expect(csv.split("\n")[0]).toBe(
      "KOKRS,VERSN,GJAHR,VON_PERIOD,BIS_PERIOD,KOSTL,LSTAR,PLNMG,MEINS,TKF,TKV,WAERS,TKG"
    );
  });

  it("emits one CSV line per row + header", () => {
    const csv = rowsToKp26Csv(sampleRows);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("USCC10000");
    expect(lines[2]).toContain("INCC20000");
  });

  it("does not include _meta column in CSV (mapper stripped or not)", () => {
    const csv = rowsToKp26Csv(sampleRows);
    expect(csv).not.toContain("_meta");
    expect(csv).not.toContain("countryCode");
  });

  it("handles empty rows", () => {
    expect(rowsToKp26Csv([])).toBe("KOKRS,VERSN,GJAHR,VON_PERIOD,BIS_PERIOD,KOSTL,LSTAR,PLNMG,MEINS,TKF,TKV,WAERS,TKG");
  });
});

describe("buildKp26Filename", () => {
  it("includes plan version, year, scenario, date", () => {
    const f = buildKp26Filename({ planVersion: "P1", fiscalYear: 2027, scenarioName: "Base" });
    expect(f).toMatch(/burdenai-kp26-2027-p1-base-\d{4}-\d{2}-\d{2}\.csv/);
  });
  it("normalizes special chars", () => {
    const f = buildKp26Filename({ planVersion: "P/1", fiscalYear: 2027, scenarioName: "High Inflation!" });
    expect(f).toContain("p-1");
    expect(f).toContain("high-inflation");
  });
});

describe("stripMeta", () => {
  it("removes _meta field while keeping other fields intact", () => {
    const stripped = stripMeta(sampleRows);
    expect(stripped[0]._meta).toBeUndefined();
    expect(stripped[0].KOKRS).toBe("1000");
    expect(stripped[0].KOSTL).toBe("USCC10000");
  });
});
