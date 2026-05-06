// usePersistedState.js
// Drop-in replacement for useState that mirrors a value into localStorage.
// Same API as useState, plus a `key` parameter and an optional default.
//
// Usage:
//   const [drivers, setDrivers] = usePersistedState("burdenai_my_key", { foo: 1 });

import { useEffect, useState } from "react";

export function usePersistedState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) return JSON.parse(saved);
    } catch {
      // ignore parse errors
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota / serialization errors
    }
  }, [key, value]);

  return [value, setValue];
}
