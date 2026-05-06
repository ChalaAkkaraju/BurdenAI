// useForecast.js
// Wires UI driver inputs to the pure forecast engine.
// Holds drivers state and memoizes the engine output.

import { useMemo, useState } from "react";
import { forecast } from "../engine/forecastEngine.js";

const DEFAULT_DRIVERS = {
  inflationPct: 5,
  productivityPct: 3,
  aopHeadcountDeltaPct: 10,
};

export function useForecast(baseline, initialDrivers = DEFAULT_DRIVERS) {
  const [drivers, setDrivers] = useState(initialDrivers);

  const result = useMemo(
    () => forecast({ baseline, drivers }),
    [baseline, drivers]
  );

  const updateDriver = (key, value) => {
    setDrivers((prev) => ({ ...prev, [key]: value }));
  };

  const resetDrivers = () => setDrivers(initialDrivers);

  return { drivers, updateDriver, resetDrivers, result };
}
