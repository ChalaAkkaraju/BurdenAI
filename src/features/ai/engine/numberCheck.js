// numberCheck.js
// Every number in AI-written text must come from the figures Burden AI gave
// the model. This module pulls the numbers out of a piece of text and checks
// each one against the allowed figures. Anything that does not match is
// reported, and the caller rejects the text.
//
// Numbers are compared as written ("131.9K", "3.1%", "35.4"), with signs,
// currency symbols and thousands separators removed, so "−$131.9K",
// "$131.9K" and "131.9K" all count as the same figure.

const NUM_RE = /(?<![A-Za-z0-9])[-−+]?[$€£¥₹]?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s?(K|M|B|bn|%|pts?|×|x)?(?![A-Za-z0-9])/g;

// Canonical form: digits with a unit suffix, e.g. "131.9K", "3.1%", "35.4".
function canon(intPart, frac, unit) {
  const i = String(intPart).replace(/,/g, "").replace(/^0+(?=\d)/, "");
  const f = frac ? `.${frac}` : "";
  let u = unit || "";
  if (u === "bn") u = "B";
  if (u === "pt" || u === "pts") u = "pts";
  if (u === "x") u = "×";
  return `${i}${f}${u}`;
}

export function extractNumbers(text) {
  const out = [];
  const s = String(text || "");
  for (const m of s.matchAll(NUM_RE)) {
    out.push({ raw: m[0].trim(), canon: canon(m[1], m[2], m[3]) });
  }
  return out;
}

// Small whole numbers ("2 cost centers", "3 checks") and years/fiscal years
// are always allowed: they are counts or labels, not figures.
function alwaysAllowed(tok) {
  if (/^\d{4}$/.test(tok) && Number(tok) >= 2000 && Number(tok) <= 2100) return true;
  if (/^\d{1,2}$/.test(tok) && Number(tok) <= 12) return true;
  return false;
}

// Variants of an allowed figure that are still the same number: the bare
// number without its unit ("3.1%" → "3.1"), and "pts" ↔ "%" for point gaps.
function variants(c) {
  const v = new Set([c]);
  const m = /^(\d+(?:\.\d+)?)(K|M|B|%|pts|×)?$/.exec(c);
  if (m) {
    v.add(m[1]);
    if (m[2] === "pts") v.add(`${m[1]}%`);
  }
  return v;
}

export function allowedSetFrom(strings) {
  const set = new Set();
  for (const s of strings) for (const n of extractNumbers(s)) for (const v of variants(n.canon)) set.add(v);
  return set;
}

// Returns { ok, bad: [raw tokens not in the figures] }.
export function checkNumbers(text, allowedStrings) {
  const allowed = allowedStrings instanceof Set ? allowedStrings : allowedSetFrom(allowedStrings);
  const bad = [];
  for (const n of extractNumbers(text)) {
    if (allowed.has(n.canon)) continue;
    const bare = n.canon.replace(/(K|M|B|%|pts|×)$/, "");
    if (!/[KMB%×]|pts/.test(n.canon) && alwaysAllowed(bare)) continue;
    bad.push(n.raw);
  }
  return { ok: bad.length === 0, bad: [...new Set(bad)] };
}

// Collects every string in a JSON-ish answer so the whole answer is checked.
export function allText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(allText).join("\n");
  if (typeof value === "object") return Object.values(value).map(allText).join("\n");
  return String(value);
}
