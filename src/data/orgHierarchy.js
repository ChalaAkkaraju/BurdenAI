// Organization Hierarchy: Corporate → Country → Vertical → Department → Cost Center → Job Code

export const corporateEntity = { id: 'CORP', name: 'Burden Global Corp' };

// Country distribution for verticals
const autoCountries = ['US', 'IN', 'GB', 'DE', 'JP', 'AU', 'SG', 'BR'];
const constCountries = ['US', 'IN', 'GB', 'DE'];
const chemCountries = ['US', 'IN'];

export const companyCodes = [
  ...autoCountries.map(cc => ({ id: `CCODE-AUTO-${cc}`, name: 'Automation', countryCode: cc })),
  ...constCountries.map(cc => ({ id: `CCODE-CONST-${cc}`, name: 'Construction', countryCode: cc })),
  ...chemCountries.map(cc => ({ id: `CCODE-CHEM-${cc}`, name: 'Chemicals', countryCode: cc })),
];

// Department templates per vertical
const autoDeptTemplates = [
  { suffix: 'SWE', name: 'Software Engineering' },
  { suffix: 'DAT', name: 'Data & Analytics' },
  { suffix: 'PDD', name: 'Product & Design' },
  { suffix: 'FNA', name: 'Finance & Admin' },
];

const constDeptTemplates = [
  { suffix: 'MFG', name: 'Manufacturing' },
  { suffix: 'QAS', name: 'Quality & Safety' },
  { suffix: 'LOG', name: 'Logistics' },
  { suffix: 'FNC', name: 'Finance & Admin' },
];

const chemDeptTemplates = [
  { suffix: 'PRE', name: 'Process Engineering' },
  { suffix: 'RND', name: 'R&D Lab' },
  { suffix: 'PRC', name: 'Procurement' },
  { suffix: 'FNH', name: 'Finance & Admin' },
];

export const departments = [
  ...autoCountries.flatMap(cc =>
    autoDeptTemplates.map(t => ({
      id: `DEP-A-${t.suffix}-${cc}`,
      name: t.name,
      companyCode: `CCODE-AUTO-${cc}`,
    }))
  ),
  ...constCountries.flatMap(cc =>
    constDeptTemplates.map(t => ({
      id: `DEP-C-${t.suffix}-${cc}`,
      name: t.name,
      companyCode: `CCODE-CONST-${cc}`,
    }))
  ),
  ...chemCountries.flatMap(cc =>
    chemDeptTemplates.map(t => ({
      id: `DEP-CH-${t.suffix}-${cc}`,
      name: t.name,
      companyCode: `CCODE-CHEM-${cc}`,
    }))
  ),
];

export const costCenters = departments.map(d => ({
  id: `CC-${d.id.replace('DEP-', '')}`,
  name: `${d.name} Cost Center`,
  departmentId: d.id,
}));

export const jobCodes = [
  // Engineering
  { code: 'JC-SWE1', title: 'Software Engineer I', family: 'Engineering', level: 1, baseMin: 70000, baseMax: 95000 },
  { code: 'JC-SWE2', title: 'Software Engineer II', family: 'Engineering', level: 2, baseMin: 95000, baseMax: 130000 },
  { code: 'JC-SWE3', title: 'Senior Software Engineer', family: 'Engineering', level: 3, baseMin: 130000, baseMax: 175000 },
  { code: 'JC-SWEL', title: 'Staff Engineer', family: 'Engineering', level: 4, baseMin: 170000, baseMax: 220000 },
  { code: 'JC-SWEP', title: 'Principal Engineer', family: 'Engineering', level: 5, baseMin: 210000, baseMax: 280000 },
  { code: 'JC-EM1', title: 'Engineering Manager', family: 'Engineering', level: 4, baseMin: 160000, baseMax: 210000 },
  { code: 'JC-ED1', title: 'Engineering Director', family: 'Engineering', level: 5, baseMin: 200000, baseMax: 270000 },
  // Product & Design
  { code: 'JC-PM1', title: 'Product Manager I', family: 'Product', level: 2, baseMin: 90000, baseMax: 120000 },
  { code: 'JC-PM2', title: 'Senior Product Manager', family: 'Product', level: 3, baseMin: 130000, baseMax: 170000 },
  { code: 'JC-PM3', title: 'Director of Product', family: 'Product', level: 5, baseMin: 180000, baseMax: 240000 },
  { code: 'JC-UX1', title: 'UX Designer I', family: 'Design', level: 1, baseMin: 65000, baseMax: 90000 },
  { code: 'JC-UX2', title: 'Senior UX Designer', family: 'Design', level: 3, baseMin: 110000, baseMax: 150000 },
  // Data
  { code: 'JC-DS1', title: 'Data Scientist I', family: 'Data', level: 2, baseMin: 95000, baseMax: 125000 },
  { code: 'JC-DS2', title: 'Senior Data Scientist', family: 'Data', level: 3, baseMin: 130000, baseMax: 175000 },
  { code: 'JC-DE1', title: 'Data Engineer I', family: 'Data', level: 2, baseMin: 90000, baseMax: 120000 },
  { code: 'JC-DE2', title: 'Senior Data Engineer', family: 'Data', level: 3, baseMin: 120000, baseMax: 160000 },
  { code: 'JC-BA1', title: 'Business Analyst', family: 'Data', level: 2, baseMin: 70000, baseMax: 100000 },
  // Finance
  { code: 'JC-FA1', title: 'Financial Analyst I', family: 'Finance', level: 1, baseMin: 60000, baseMax: 80000 },
  { code: 'JC-FA2', title: 'Senior Financial Analyst', family: 'Finance', level: 3, baseMin: 90000, baseMax: 125000 },
  { code: 'JC-ACC1', title: 'Staff Accountant', family: 'Finance', level: 1, baseMin: 55000, baseMax: 75000 },
  { code: 'JC-ACC2', title: 'Senior Accountant', family: 'Finance', level: 3, baseMin: 80000, baseMax: 110000 },
  { code: 'JC-FM1', title: 'Finance Manager', family: 'Finance', level: 4, baseMin: 120000, baseMax: 165000 },
  { code: 'JC-FD1', title: 'Finance Director', family: 'Finance', level: 5, baseMin: 170000, baseMax: 230000 },
  // Operations
  { code: 'JC-OP1', title: 'Operations Associate', family: 'Operations', level: 1, baseMin: 40000, baseMax: 55000 },
  { code: 'JC-OP2', title: 'Operations Specialist', family: 'Operations', level: 2, baseMin: 55000, baseMax: 75000 },
  { code: 'JC-OP3', title: 'Senior Operations Analyst', family: 'Operations', level: 3, baseMin: 75000, baseMax: 100000 },
  { code: 'JC-OM1', title: 'Operations Manager', family: 'Operations', level: 4, baseMin: 95000, baseMax: 130000 },
  { code: 'JC-OD1', title: 'Operations Director', family: 'Operations', level: 5, baseMin: 140000, baseMax: 190000 },
  // Manufacturing
  { code: 'JC-MF1', title: 'Production Technician', family: 'Manufacturing', level: 1, baseMin: 35000, baseMax: 50000 },
  { code: 'JC-MF2', title: 'Senior Technician', family: 'Manufacturing', level: 2, baseMin: 48000, baseMax: 65000 },
  { code: 'JC-MF3', title: 'Production Supervisor', family: 'Manufacturing', level: 3, baseMin: 65000, baseMax: 90000 },
  { code: 'JC-QA1', title: 'QA Inspector', family: 'Manufacturing', level: 1, baseMin: 38000, baseMax: 52000 },
  { code: 'JC-QA2', title: 'Senior QA Analyst', family: 'Manufacturing', level: 3, baseMin: 70000, baseMax: 95000 },
  // Supply Chain
  { code: 'JC-SC1', title: 'Supply Chain Coordinator', family: 'Supply Chain', level: 1, baseMin: 45000, baseMax: 60000 },
  { code: 'JC-SC2', title: 'Supply Chain Analyst', family: 'Supply Chain', level: 2, baseMin: 60000, baseMax: 85000 },
  { code: 'JC-SC3', title: 'Senior Supply Chain Mgr', family: 'Supply Chain', level: 4, baseMin: 100000, baseMax: 140000 },
];

export const countries = [
  // fxToUSD = how many USD 1 unit of local currency buys (Apr 2026 market rates)
  // fxFromUSD = how many units of local currency 1 USD buys (inverse)
  { code: 'US', name: 'United States', currency: 'USD', symbol: '$',  fxToUSD: 1.0,     fxFromUSD: 1.0,     standardHours: 2080, benefitMultiplier: 1.0 },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£',  fxToUSD: 1.32,    fxFromUSD: 0.758,   standardHours: 1960, benefitMultiplier: 0.85 },
  { code: 'DE', name: 'Germany', currency: 'EUR', symbol: '€',  fxToUSD: 1.11,    fxFromUSD: 0.901,   standardHours: 1880, benefitMultiplier: 1.25 },
  { code: 'IN', name: 'India', currency: 'INR', symbol: '₹',  fxToUSD: 0.01183, fxFromUSD: 84.53,   standardHours: 2080, benefitMultiplier: 0.45 },
  { code: 'JP', name: 'Japan', currency: 'JPY', symbol: '¥',  fxToUSD: 0.00633, fxFromUSD: 158.0,   standardHours: 2000, benefitMultiplier: 0.90 },
  { code: 'BR', name: 'Brazil', currency: 'BRL', symbol: 'R$', fxToUSD: 0.175,   fxFromUSD: 5.72,    standardHours: 2000, benefitMultiplier: 0.70 },
  { code: 'SG', name: 'Singapore', currency: 'SGD', symbol: 'S$', fxToUSD: 0.76,    fxFromUSD: 1.316,   standardHours: 2080, benefitMultiplier: 0.60 },
  { code: 'AU', name: 'Australia', currency: 'AUD', symbol: 'A$', fxToUSD: 0.635,   fxFromUSD: 1.575,   standardHours: 1976, benefitMultiplier: 0.80 },
];

// Distribution weights for country assignment
export const countryWeights = [
  { code: 'US', weight: 0.40 },
  { code: 'IN', weight: 0.20 },
  { code: 'GB', weight: 0.10 },
  { code: 'DE', weight: 0.08 },
  { code: 'JP', weight: 0.06 },
  { code: 'BR', weight: 0.06 },
  { code: 'SG', weight: 0.05 },
  { code: 'AU', weight: 0.05 },
];

// Overhead rates per cost center (as % of direct labor)
export const overheadCategories = [
  { id: 'OH-FAC', name: 'Facilities & Real Estate', rateRange: [0.06, 0.12] },
  { id: 'OH-IT', name: 'IT Infrastructure & Licensing', rateRange: [0.04, 0.10] },
  { id: 'OH-GA', name: 'General & Administrative', rateRange: [0.05, 0.08] },
  { id: 'OH-SS', name: 'Shared Services', rateRange: [0.03, 0.06] },
  { id: 'OH-DEP', name: 'Depreciation & Amortization', rateRange: [0.02, 0.05] },
  { id: 'OH-CORP', name: 'Corporate Allocations', rateRange: [0.03, 0.07] },
];

// Benefit categories
export const benefitCategories = [
  { id: 'BEN-MED', name: 'Medical Insurance', rateRange: [0.08, 0.14] },
  { id: 'BEN-DEN', name: 'Dental & Vision', rateRange: [0.01, 0.03] },
  { id: 'BEN-RET', name: 'Retirement / 401k Match', rateRange: [0.03, 0.06] },
  { id: 'BEN-LIF', name: 'Life & Disability Insurance', rateRange: [0.01, 0.02] },
  { id: 'BEN-PTO', name: 'PTO & Leave Accrual', rateRange: [0.06, 0.10] },
  { id: 'BEN-STAT', name: 'Statutory Benefits (FICA, etc.)', rateRange: [0.065, 0.085] },
  { id: 'BEN-EDU', name: 'Education & Training', rateRange: [0.005, 0.02] },
  { id: 'BEN-WEL', name: 'Wellness & Perks', rateRange: [0.005, 0.015] },
];

// Job family → department name mapping (used with country filtering in generateData)
// Engineering and Data can also land in Chemicals R&D; Finance goes to any vertical's Finance & Admin
export const familyToDepartments = {
  'Engineering': departments.filter(d =>
    d.name === 'Software Engineering' || d.name === 'Process Engineering'
  ).map(d => d.id),
  'Product': departments.filter(d => d.name === 'Product & Design').map(d => d.id),
  'Design': departments.filter(d => d.name === 'Product & Design').map(d => d.id),
  'Data': departments.filter(d =>
    d.name === 'Data & Analytics' || d.name === 'R&D Lab'
  ).map(d => d.id),
  'Manufacturing': departments.filter(d => d.name === 'Manufacturing').map(d => d.id),
  'Operations': departments.filter(d =>
    d.name === 'Logistics' || d.name === 'Quality & Safety'
  ).map(d => d.id),
  'Supply Chain': departments.filter(d =>
    d.name === 'Logistics' || d.name === 'Procurement'
  ).map(d => d.id),
  'Finance': departments.filter(d => d.name === 'Finance & Admin').map(d => d.id),
};
