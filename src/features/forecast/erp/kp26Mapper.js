// kp26Mapper.js
// Maps BurdenAI's per-country forecast into rows shaped for SAP KP26 flexible
// upload. Pure function — no React, no I/O.
//
// KP26 is SAP's Cost Center / Activity Type Planning transaction. The flexible
// upload format expects one row per cost center × activity type × period range,
// covering: controlling area, plan version, fiscal year, period from/to,
// cost center, activity type, plan quantity, unit, plan price (fixed +
// variable), currency, price indicator.
//
// For BurdenAI Phase 1 we collapse a year into a single annual row covering
// periods 1–12 with:
//   - Plan price fixed (TKF)        = forecasted burden rate ($/hr)
//   - Plan quantity (PLNMG)         = forecasted productive hours
//   - Period from / to              = 1 / 12
//   - Price indicator (TKG)         = 1 (fixed)
//   - Plan price variable (TKV)     = 0
//
// Caller supplies the mapping (BurdenAI country code → SAP cost center) and
// the settings (controlling area, plan version, fiscal year, activity type,
// currency). Rows for unmapped countries are returned with `missingMapping:
// true` so the UI can flag them; they should be filtered before export.

const HOURS_UNIT = "HR";
const PRICE_INDICATOR_FIXED = "1";

/**
 * Build KP26 rows for a single forecast year.
 *
 * @param {object} args
 * @param {object} args.countryForecast        - BurdenAI per-country forecast (output of forecastPerCountry)
 * @param {object} args.mapping                - { [countryCode]: "SAP_COST_CENTER_ID" }
 * @param {object} args.settings               - { controllingArea, planVersion, fiscalYear, activityType, currency }
 * @returns {{ rows: Array, missing: Array }}  - rows[]: KP26 row objects; missing[]: countries without mapping
 */
export function buildKp26Rows({ countryForecast, mapping, settings }) {
  if (!countryForecast || !Array.isArray(countryForecast.byCountry)) {
    return { rows: [], missing: [] };
  }
  const safeMapping = mapping || {};
  const {
    controllingArea = "",
    planVersion = "",
    fiscalYear = "",
    activityType = "BURDEN",
    currency = "USD",
  } = settings || {};

  const rows = [];
  const missing = [];

  for (const c of countryForecast.byCountry) {
    const sapCostCenter = safeMapping[c.countryCode];
    if (!sapCostCenter || String(sapCostCenter).trim() === "") {
      missing.push({ countryCode: c.countryCode, label: c.label });
      continue;
    }

    // Forecasted productive hours for the country. The engine returns
    // forecastedRate ($/hr) and forecastedTotal ($), so productive hours =
    // forecastedTotal / forecastedRate.
    const productiveHours = c.forecastedRate > 0
      ? Math.round((c.forecastedTotal / c.forecastedRate) * 100) / 100
      : 0;

    rows.push({
      KOKRS: controllingArea,                      // Controlling Area
      VERSN: planVersion,                          // Plan Version
      GJAHR: String(fiscalYear),                   // Fiscal Year
      VON_PERIOD: 1,                               // Period From
      BIS_PERIOD: 12,                              // Period To
      KOSTL: String(sapCostCenter).trim(),         // Cost Center
      LSTAR: String(activityType).trim(),          // Activity Type
      PLNMG: productiveHours,                      // Plan Quantity (productive hrs)
      MEINS: HOURS_UNIT,                           // Unit
      TKF: round2(c.forecastedRate ?? 0),          // Plan Price Fixed ($/hr)
      TKV: 0,                                      // Plan Price Variable
      WAERS: currency,                             // Currency
      TKG: PRICE_INDICATOR_FIXED,                  // Price Indicator
      // Useful metadata for the UI / audit — stripped before CSV export.
      _meta: {
        countryCode: c.countryCode,
        countryLabel: c.label,
        forecastedTotal: c.forecastedTotal,
      },
    });
  }

  return { rows, missing };
}

function round2(n) {
  return Math.round((n || 0) * 100) / 100;
}

// Default mapping seed — BurdenAI's eight built-in countries → placeholder
// SAP cost center IDs. User edits these before export. Empty string means
// "user must fill in".
export function defaultMappingSeed(countryCodes = []) {
  const seed = {};
  for (const code of countryCodes) seed[code] = "";
  return seed;
}

// Validates settings for export. Returns an array of human-readable error
// strings; empty array means "OK to export".
export function validateSettings(settings) {
  const errs = [];
  if (!settings) return ["Missing settings"];
  const { controllingArea, planVersion, fiscalYear, activityType, currency } = settings;
  if (!controllingArea || !String(controllingArea).trim()) {
    errs.push("Controlling area is required");
  }
  if (!planVersion || !String(planVersion).trim()) {
    errs.push("Plan version is required");
  }
  if (!fiscalYear || !/^\d{4}$/.test(String(fiscalYear))) {
    errs.push("Fiscal year must be a 4-digit year");
  }
  if (!activityType || !String(activityType).trim()) {
    errs.push("Activity type is required");
  }
  if (!currency || !/^[A-Z]{3}$/.test(String(currency).trim())) {
    errs.push("Currency must be a 3-letter ISO code (e.g. USD)");
  }
  return errs;
}
