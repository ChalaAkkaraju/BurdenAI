// targets.js
// Utilization targets are kept per cost center. A company default (85%)
// applies to any cost center without its own target.
//
// Out of the box the module seeds "sample targets" from each cost center's
// department type (e.g. Software Engineering 86%, Finance & Admin 72%), so
// support functions are not all flagged against an engineering-level target.

import { UTIL_BASE } from "./actuals.js";
import { DEFAULT_TARGET_PCT } from "./variance.js";

export function sampleTargets(costCenterInfos) {
  const byCostCenter = {};
  for (const info of costCenterInfos) {
    const base = UTIL_BASE[info.departmentName];
    if (base != null) byCostCenter[info.costCenterId] = Math.round(base * 100);
  }
  return { defaultPct: DEFAULT_TARGET_PCT, byCostCenter, source: "Sample targets" };
}
