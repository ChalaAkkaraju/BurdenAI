import { describe, it, expect } from "vitest";
import { buildKp26Rows, defaultMappingSeed, validateSettings } from "./kp26Mapper.js";

const sampleForecast = {
  byCountry: [
    {
      countryCode: "US", label: "USA",
      forecastedTotal: 3_568_739, forecastedRate: 97.36, forecastedHeadcount: 227,
    },
    {
      countryCode: "IN", label: "India",
      forecastedTotal: 586_180, forecastedRate: 29.93, forecastedHeadcount: 120,
    },
    {
      countryCode: "DE", label: "Germany",
      forecastedTotal: 737_250, forecastedRate: 99.15, forecastedHeadcount: 51,
    },
  ],
};

const sampleSettings = {
  controllingArea: "1000",
  planVersion: "P1",
  fiscalYear: 2027,
  activityType: "BURDEN",
  currency: "USD",
};

describe("buildKp26Rows", () => {
  it("returns one row per country with a mapping", () => {
    const mapping = { US: "USCC10000", IN: "INCC20000", DE: "DECC30000" };
    const { rows, missing } = buildKp26Rows({
      countryForecast: sampleForecast,
      mapping,
      settings: sampleSettings,
    });
    expect(rows).toHaveLength(3);
    expect(missing).toEqual([]);
  });

  it("flags countries without a mapping and excludes them from rows", () => {
    const mapping = { US: "USCC10000" }; // IN + DE missing
    const { rows, missing } = buildKp26Rows({
      countryForecast: sampleForecast,
      mapping,
      settings: sampleSettings,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].KOSTL).toBe("USCC10000");
    expect(missing.map((m) => m.countryCode).sort()).toEqual(["DE", "IN"]);
  });

  it("treats whitespace-only mapping entries as missing", () => {
    const mapping = { US: "USCC10000", IN: "   ", DE: "" };
    const { rows, missing } = buildKp26Rows({
      countryForecast: sampleForecast,
      mapping,
      settings: sampleSettings,
    });
    expect(rows).toHaveLength(1);
    expect(missing.map((m) => m.countryCode).sort()).toEqual(["DE", "IN"]);
  });

  it("populates KP26 fields from settings", () => {
    const mapping = { US: "USCC10000" };
    const { rows } = buildKp26Rows({
      countryForecast: { byCountry: [sampleForecast.byCountry[0]] },
      mapping,
      settings: sampleSettings,
    });
    const r = rows[0];
    expect(r.KOKRS).toBe("1000");
    expect(r.VERSN).toBe("P1");
    expect(r.GJAHR).toBe("2027");
    expect(r.VON_PERIOD).toBe(1);
    expect(r.BIS_PERIOD).toBe(12);
    expect(r.KOSTL).toBe("USCC10000");
    expect(r.LSTAR).toBe("BURDEN");
    expect(r.MEINS).toBe("HR");
    expect(r.WAERS).toBe("USD");
    expect(r.TKG).toBe("1");
    expect(r.TKV).toBe(0);
  });

  it("plan price fixed = forecasted burden rate, rounded to 2dp", () => {
    const mapping = { US: "USCC10000" };
    const { rows } = buildKp26Rows({
      countryForecast: {
        byCountry: [{ countryCode: "US", label: "USA", forecastedTotal: 1_000_000, forecastedRate: 77.456789, forecastedHeadcount: 100 }],
      },
      mapping,
      settings: sampleSettings,
    });
    expect(rows[0].TKF).toBe(77.46);
  });

  it("plan quantity = forecastedTotal / forecastedRate (productive hours)", () => {
    const mapping = { US: "USCC10000" };
    const { rows } = buildKp26Rows({
      countryForecast: {
        byCountry: [{ countryCode: "US", label: "USA", forecastedTotal: 1_000_000, forecastedRate: 50, forecastedHeadcount: 100 }],
      },
      mapping,
      settings: sampleSettings,
    });
    // 1,000,000 / 50 = 20,000 hours
    expect(rows[0].PLNMG).toBe(20000);
  });

  it("guards against zero or missing forecastedRate", () => {
    const mapping = { US: "USCC10000" };
    const { rows } = buildKp26Rows({
      countryForecast: {
        byCountry: [{ countryCode: "US", label: "USA", forecastedTotal: 1_000_000, forecastedRate: 0, forecastedHeadcount: 0 }],
      },
      mapping,
      settings: sampleSettings,
    });
    expect(rows[0].PLNMG).toBe(0);
    expect(rows[0].TKF).toBe(0);
  });

  it("returns empty result for missing forecast input", () => {
    const r1 = buildKp26Rows({ countryForecast: null, mapping: {}, settings: sampleSettings });
    const r2 = buildKp26Rows({ countryForecast: {}, mapping: {}, settings: sampleSettings });
    expect(r1.rows).toEqual([]);
    expect(r2.rows).toEqual([]);
  });
});

describe("defaultMappingSeed", () => {
  it("creates an empty-string entry per country code", () => {
    const seed = defaultMappingSeed(["US", "GB", "IN"]);
    expect(seed).toEqual({ US: "", GB: "", IN: "" });
  });
});

describe("validateSettings", () => {
  it("accepts well-formed settings", () => {
    expect(validateSettings({
      controllingArea: "1000", planVersion: "P1", fiscalYear: 2027,
      activityType: "BURDEN", currency: "USD",
    })).toEqual([]);
  });

  it("rejects missing controlling area", () => {
    const errs = validateSettings({ controllingArea: "", planVersion: "P1", fiscalYear: 2027, activityType: "X", currency: "USD" });
    expect(errs.some((e) => /controlling area/i.test(e))).toBe(true);
  });

  it("rejects non-4-digit fiscal year", () => {
    const errs = validateSettings({ controllingArea: "X", planVersion: "P1", fiscalYear: 27, activityType: "X", currency: "USD" });
    expect(errs.some((e) => /fiscal year/i.test(e))).toBe(true);
  });

  it("rejects non-ISO currency", () => {
    const errs = validateSettings({ controllingArea: "X", planVersion: "P1", fiscalYear: 2027, activityType: "X", currency: "Dollars" });
    expect(errs.some((e) => /currency/i.test(e))).toBe(true);
  });
});
