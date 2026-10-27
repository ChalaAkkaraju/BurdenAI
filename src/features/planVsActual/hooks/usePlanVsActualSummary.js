// usePlanVsActualSummary.js
// Company-wide (within the user's country scope) Plan vs Actual summary for the
// dashboard. Uses the same saved plan version, uploads and targets as the
// Plan vs Actual page, for the fiscal year chosen there, year to date.

import { useMemo } from "react";
import { usePersistedState } from "../../forecast/hooks/usePersistedState.js";
import { useSnapshots } from "../../forecast/hooks/useSnapshots.js";
import { buildActuals } from "../engine/actuals.js";
import { computeYtd } from "../engine/ytd.js";

export function usePlanVsActualSummary({ costData, employeeMap, periods, allowedCountries }) {
  const [settings] = usePersistedState("burdenai_pva_settings", {});
  const [uploads] = usePersistedState("burdenai_pva_uploads", {});
  const [storedTargets] = usePersistedState("burdenai_pva_targets", null);
  const { snapshots } = useSnapshots();
  const actuals = useMemo(() => buildActuals({ costData, employeeMap }), [costData, employeeMap]);

  return useMemo(
    () => computeYtd({ actuals, periods, settings, uploads, storedTargets, snapshots, allowedCountries }),
    [actuals, periods, allowedCountries, settings, uploads, storedTargets, snapshots],
  );
}
