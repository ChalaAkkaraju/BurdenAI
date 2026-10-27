import { describe, it, expect } from "vitest";
import { lastCompletedPeriod, DATA_AS_OF } from "./asOf.js";

describe("asOf", () => {
  it("is the month before today", () => {
    expect(lastCompletedPeriod(new Date(2026, 9, 27))).toBe("2026-09");
    expect(lastCompletedPeriod(new Date(2026, 10, 1))).toBe("2026-10");
    expect(lastCompletedPeriod(new Date(2027, 0, 15))).toBe("2026-12");
  });
  it("sample data ends at DATA_AS_OF and keeps earlier months unchanged", async () => {
    const { periods, costData, auditLog } = await import("./generateData.js");
    expect(periods[0]).toBe("2021-04");
    expect(periods[periods.length - 1]).toBe(DATA_AS_OF);
    const mar26 = costData.filter((c) => c.period === "2026-03");
    expect(mar26.length).toBe(500);
    expect(new Date(auditLog[0].timestamp) > new Date(`${DATA_AS_OF}-01T00:00:00Z`)).toBe(true);
  });
});
