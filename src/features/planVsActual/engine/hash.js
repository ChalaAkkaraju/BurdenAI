// hash.js
// Small deterministic "noise" helpers so the sample data is identical on every
// load (no Math.random), but still varies by cost center, month and year.

export function hash01(key) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  const s = String(key);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

export function between(key, lo, hi) {
  return lo + hash01(key) * (hi - lo);
}
