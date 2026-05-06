// aopParser.js
// Parses an uploaded AOP CSV into structured planned-headcount data.
//
// Expected CSV shape (header row required):
//   country,planned_headcount
//   US,220
//   IN,200
//   GB,40
//
// Country column accepts: country, country_code, code, geo
// Headcount column accepts: planned_headcount, headcount, headcount_plan, target_headcount
//
// Returns: { rows: [{ countryCode, plannedHeadcount }], errors: [...] }

const COUNTRY_HEADERS = ["country", "country_code", "code", "geo"];
const HEADCOUNT_HEADERS = ["planned_headcount", "headcount", "headcount_plan", "target_headcount"];

function normalizeHeader(h) {
  return String(h || "").trim().toLowerCase().replace(/\s+/g, "_");
}

export function parseAOPCsv(csvText) {
  const errors = [];
  if (typeof csvText !== "string" || csvText.trim().length === 0) {
    return { rows: [], errors: ["Empty CSV"] };
  }

  // Light CSV split — handles quoted commas in values.
  const splitLine = (line) => {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let k = 0; k < line.length; k++) {
      const ch = line[k];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], errors: ["CSV must have a header row and at least one data row"] };
  }

  const headers = splitLine(lines[0]).map(normalizeHeader);
  const countryIdx = headers.findIndex((h) => COUNTRY_HEADERS.includes(h));
  const headcountIdx = headers.findIndex((h) => HEADCOUNT_HEADERS.includes(h));

  if (countryIdx === -1) {
    errors.push(`Missing country column. Expected one of: ${COUNTRY_HEADERS.join(", ")}`);
  }
  if (headcountIdx === -1) {
    errors.push(`Missing headcount column. Expected one of: ${HEADCOUNT_HEADERS.join(", ")}`);
  }
  if (errors.length > 0) {
    return { rows: [], errors };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const country = (cells[countryIdx] || "").toUpperCase();
    const hcRaw = cells[headcountIdx];
    const hc = parseFloat(hcRaw);
    if (!country) {
      errors.push(`Row ${i + 1}: missing country`);
      continue;
    }
    if (!Number.isFinite(hc) || hc < 0) {
      errors.push(`Row ${i + 1}: invalid headcount "${hcRaw}"`);
      continue;
    }
    rows.push({ countryCode: country, plannedHeadcount: hc });
  }

  return { rows, errors };
}

// Compute per-country aopHeadcountDeltaPct from parsed AOP + current country
// baselines. Countries present in baseline but missing from AOP are NOT given
// an override (they fall back to global). Countries in AOP but missing from
// baseline are flagged as warnings.
export function computeAOPOverrides(aopRows, countryBaselines) {
  const baselineMap = {};
  for (const cb of countryBaselines) {
    baselineMap[cb.countryCode] = cb;
  }

  const overrides = {};
  const warnings = [];
  for (const row of aopRows) {
    const cb = baselineMap[row.countryCode];
    if (!cb) {
      warnings.push(`AOP row for ${row.countryCode} has no matching baseline — skipped`);
      continue;
    }
    if (cb.headcount === 0) {
      warnings.push(`${row.countryCode} has zero baseline headcount — cannot compute delta`);
      continue;
    }
    const deltaPct = ((row.plannedHeadcount - cb.headcount) / cb.headcount) * 100;
    overrides[row.countryCode] = { aopHeadcountDeltaPct: deltaPct };
  }
  return { overrides, warnings };
}
