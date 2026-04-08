/* ───────────────────────────────────────────────────────────
   ERP Allocation Service
   Stub adapter for fetching Overhead Allocation Policies from
   an ERP system (Oracle Fusion, SAP S/4HANA, NetSuite, Workday).
   Also provides CSV template download + parsing for manual import.

   Swap `fetchFromErp()` internals for a real HTTP call later.
   ─────────────────────────────────────────────────────────── */

// Columns in the user-facing CSV template
export const TEMPLATE_COLUMNS = [
  'id',
  'name',
  'costCategory',
  'method',
  'description',
  'effectiveDate',
  'endDate',
  'version',
  'status',
  'approvedBy',
  'approvedDate',
];

const VALID_METHODS = ['headcount', 'labor-hour', 'percent-of-payroll', 'cost-center-proportional', 'custom'];

/* ─── CSV template download ─── */
export function buildCsvTemplate() {
  const header = TEMPLATE_COLUMNS.join(',');
  const sample = [
    'AR-001,Facilities Allocation - Headcount,OH-FAC,headcount,Allocate facilities costs proportionally by headcount per cost center,2025-01-01,,3,Active,CFO Office,2024-12-15',
    'AR-003,G&A Allocation - % of Payroll,OH-GA,percent-of-payroll,General & Administrative costs as a percentage of payroll,2025-01-01,,4,Active,CFO Office,2024-11-30',
  ].join('\n');
  return `${header}\n${sample}\n`;
}

export function downloadTemplate(filename = 'allocation-policies-template.csv') {
  const csv = buildCsvTemplate();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── CSV parse + validate ─── */
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], errors: ['File is empty'] };

  const header = splitCsvLine(lines[0]);
  const missing = TEMPLATE_COLUMNS.filter(c => !header.includes(c));
  if (missing.length > 0) {
    return { rows: [], errors: [`Missing required columns: ${missing.join(', ')}`] };
  }

  const errors = [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const row = Object.fromEntries(header.map((h, idx) => [h, values[idx] ?? '']));
    if (!row.id) { errors.push(`Row ${i + 1}: missing id`); continue; }
    if (!row.name) { errors.push(`Row ${i + 1}: missing name`); continue; }
    if (!VALID_METHODS.includes(row.method)) {
      errors.push(`Row ${i + 1}: invalid method "${row.method}" (allowed: ${VALID_METHODS.join(', ')})`);
      continue;
    }
    rows.push({
      id: row.id,
      name: row.name,
      costCategory: row.costCategory,
      method: row.method,
      description: row.description,
      effectiveDate: row.effectiveDate,
      endDate: row.endDate || null,
      version: parseInt(row.version, 10) || 1,
      status: row.status || 'Active',
      approvedBy: row.approvedBy,
      approvedDate: row.approvedDate,
      createdBy: 'csv-import',
      lastModified: new Date().toISOString().slice(0, 10),
    });
  }
  return { rows, errors };
}

/* ─── Diff preview ─── */
export function diffPolicies(current, incoming) {
  const curMap = new Map(current.map(r => [r.id, r]));
  const inMap = new Map(incoming.map(r => [r.id, r]));
  const added = incoming.filter(r => !curMap.has(r.id));
  const removed = current.filter(r => !inMap.has(r.id));
  const updated = [];
  for (const inc of incoming) {
    const cur = curMap.get(inc.id);
    if (!cur) continue;
    const changedFields = [];
    for (const k of ['name', 'costCategory', 'method', 'description', 'effectiveDate', 'endDate', 'version', 'status', 'approvedBy']) {
      if ((cur[k] ?? '') !== (inc[k] ?? '')) changedFields.push(k);
    }
    if (changedFields.length > 0) updated.push({ before: cur, after: inc, changedFields });
  }
  return { added, removed, updated };
}

/* ─── ERP fetch (stub) ─── */
const ERP_ENDPOINTS = {
  oracle: '/fscmRestApi/resources/latest/costAllocations',
  sap:    '/sap/opu/odata/sap/API_COSTCENTER_SRV/CostCenterAllocation',
  netsuite: '/services/rest/query/v1/suiteql?q=SELECT+*+FROM+allocationschedule',
  workday: '/ccx/service/customreport2/tenant/Financial_Allocations',
};

export async function fetchFromErp(system = 'oracle') {
  // Simulate network latency
  await new Promise(r => setTimeout(r, 900));

  // In production this would be:
  //   const res = await fetch(ERP_ENDPOINTS[system], { headers: { Authorization: ... } });
  //   const json = await res.json();
  //   return normalizeFromErp(json, system);

  const today = new Date().toISOString().slice(0, 10);
  return [
    {
      id: 'AR-001',
      name: 'Facilities Allocation - Headcount',
      costCategory: 'OH-FAC',
      method: 'headcount',
      description: 'Allocate facilities costs proportionally by headcount per cost center',
      effectiveDate: '2025-01-01',
      endDate: null,
      version: 4,
      status: 'Active',
      approvedBy: 'CFO Office',
      approvedDate: '2024-12-15',
      createdBy: `erp-sync:${system}`,
      lastModified: today,
    },
    {
      id: 'AR-003',
      name: 'G&A Allocation - % of Payroll',
      costCategory: 'OH-GA',
      method: 'percent-of-payroll',
      description: 'General & Administrative costs as a percentage of payroll (ERP v5)',
      effectiveDate: '2025-01-01',
      endDate: null,
      version: 5,
      status: 'Active',
      approvedBy: 'CFO Office',
      approvedDate: '2024-11-30',
      createdBy: `erp-sync:${system}`,
      lastModified: today,
    },
    {
      id: 'AR-008',
      name: 'Insurance & Risk - Headcount',
      costCategory: 'OH-INS',
      method: 'headcount',
      description: 'New insurance pool allocated by headcount (synced from ERP)',
      effectiveDate: '2026-04-01',
      endDate: null,
      version: 1,
      status: 'Active',
      approvedBy: 'Risk Committee',
      approvedDate: '2026-03-20',
      createdBy: `erp-sync:${system}`,
      lastModified: today,
    },
  ];
}

export const SUPPORTED_ERPS = [
  { id: 'oracle', label: 'Oracle Fusion ERP' },
  { id: 'sap', label: 'SAP S/4HANA' },
  { id: 'netsuite', label: 'NetSuite' },
  { id: 'workday', label: 'Workday Financials' },
];
