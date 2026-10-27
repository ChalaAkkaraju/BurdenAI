// useAiData.js — the data the AI features look things up in, scoped to the
// user's countries. Same calculations and saved settings as the module pages.

import { useMemo } from "react";
import { useApp } from "../../../context/AppContext";
import { usePersistedState } from "../../forecast/hooks/usePersistedState.js";
import { useSnapshots } from "../../forecast/hooks/useSnapshots.js";
import { buildActuals } from "../../planVsActual/engine/actuals.js";
import { computeYtd } from "../../planVsActual/engine/ytd.js";
import { countries as COUNTRY_LIST } from "../../../data/orgHierarchy.js";
import { USD } from "../../planVsActual/format.js";
import { detectAnomalies } from "../engine/anomalies.js";
import { forecastSummary } from "../engine/forecastSummary.js";

const COUNTRY_NAME = Object.fromEntries(COUNTRY_LIST.map((c) => [c.code, c.name]));
export const countryName = (code) => COUNTRY_NAME[code] || code;

export function useScopedActuals() {
  const { costData, employeeMap, currentUser } = useApp();
  const actuals = useMemo(() => buildActuals({ costData, employeeMap }), [costData, employeeMap]);
  const allowed = currentUser?.allowedCountries || [];
  const all = allowed.includes("*");
  const key = allowed.join(",");
  const inScope = useMemo(() => (code) => all || allowed.includes(code), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { actuals, inScope, allCountries: all, allowed };
}

export function useAnomalies(period, cutoff) {
  const { actuals, inScope } = useScopedActuals();
  return useMemo(() => detectAnomalies({ actuals, period, cutoff, inScope }), [actuals, period, cutoff, inScope]);
}

export function useAskContext(cutoff) {
  const { periods, currentUser, kpis, summaryByCountry, selectedPeriod, periodData } = useApp();
  const { actuals, inScope, allCountries } = useScopedActuals();
  const [settings] = usePersistedState("burdenai_pva_settings", {});
  const [uploads] = usePersistedState("burdenai_pva_uploads", {});
  const [storedTargets] = usePersistedState("burdenai_pva_targets", null);
  const { snapshots } = useSnapshots();
  const latestMonth = periods[periods.length - 1];

  const ytd = useMemo(
    () => computeYtd({ actuals, periods, settings, uploads, storedTargets, snapshots, allowedCountries: currentUser?.allowedCountries }),
    [actuals, periods, settings, uploads, storedTargets, snapshots, currentUser],
  );
  const anomalies = useMemo(() => detectAnomalies({ actuals, period: latestMonth, cutoff, inScope }), [actuals, latestMonth, cutoff, inScope]);

  return useMemo(() => {
    const ccMap = new Map();
    for (const a of actuals) if (inScope(a.countryCode) && !ccMap.has(a.costCenterId)) {
      ccMap.set(a.costCenterId, { id: a.costCenterId, departmentName: a.departmentName, countryCode: a.countryCode });
    }
    const costCenters = [...ccMap.values()];
    const codes = [...new Set(costCenters.map((c) => c.countryCode))].sort();
    const ctx = {
      actuals, inScope, ytd, anomalies, latestMonth, USD, countryName,
      costCenters,
      countries: codes.map((c) => ({ code: c, name: countryName(c) })),
      departments: [...new Set(costCenters.map((c) => c.departmentName))].sort(),
      allLabel: allCountries ? "all countries" : `your countries (${codes.join(", ")})`,
      // The forecast is company-wide, like the Forecast page; only offered to users who see every country.
      getForecast: allCountries ? () => forecastSummary({ kpis, summaryByCountry, selectedPeriod, periodData }) : null,
    };
    return ctx;
  }, [actuals, inScope, ytd, anomalies, latestMonth, allCountries, kpis, summaryByCountry, selectedPeriod, periodData]);
}
