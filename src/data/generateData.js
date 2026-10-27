import {
  corporateEntity, companyCodes, departments, costCenters, jobCodes,
  countries, countryWeights, overheadCategories, benefitCategories,
  familyToDepartments
} from './orgHierarchy.js';
import { calculateAllBenefits, getRulesForCountry } from './countryBenefitRules.js';
import { DATA_AS_OF, AS_OF_YEAR, AS_OF_MONTH, asOfDate, isoDay, asOfMonthName, asOfQuarter, asOfFiscalYear } from './asOf.js';

// Seeded random for reproducibility
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(42);

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function randBetween(min, max) {
  return min + rand() * (max - min);
}

// Generate a contextual position title based on vertical, department, and job level
function generatePositionTitle(jobCode, deptName, verticalName) {
  // Seniority prefixes by level (level 5 uses suffix only)
  const seniorityPrefix = { 1: '', 2: '', 3: 'Senior ', 4: 'Lead ', 5: '' };
  const prefix = seniorityPrefix[jobCode.level] || '';

  // Context-specific titles keyed by job family + vertical/dept combination
  const titleVariants = {
    Engineering: {
      Automation:    ['Automation Systems', 'Controls Software', 'Robotics Platform', 'PLC Integration', 'IoT Systems'],
      Construction:  ['BIM Software', 'Site Systems', 'Structural Modeling', 'Project Tech', 'Field Software'],
      Chemicals:     ['Process Control', 'Plant Systems', 'SCADA', 'Batch Automation', 'DCS'],
      _default:      ['Software', 'Platform', 'Systems', 'Backend', 'Cloud Infrastructure'],
    },
    Product: {
      Automation:    ['Automation Products', 'Industrial IoT', 'Robotics Solutions'],
      Construction:  ['Construction Tech', 'Jobsite Solutions', 'Safety Products'],
      Chemicals:     ['Chemical Products', 'Lab Solutions', 'Process Products'],
      _default:      ['Product Strategy', 'Product Growth', 'Platform Products'],
    },
    Design: {
      Automation:    ['Industrial UX', 'HMI Design', 'Control Panel UX'],
      Construction:  ['Construction UX', 'Safety Interface', 'Jobsite UX'],
      Chemicals:     ['Lab Interface', 'Process UX', 'Chemical Safety UX'],
      _default:      ['User Experience', 'Interaction Design', 'Visual Design'],
    },
    Data: {
      Automation:    ['Sensor Analytics', 'Telemetry Data', 'Predictive Maintenance', 'Machine Data'],
      Construction:  ['Project Analytics', 'Cost Data', 'Schedule Intelligence', 'Site Data'],
      Chemicals:     ['Process Analytics', 'Lab Data', 'Yield Analytics', 'Quality Data'],
      _default:      ['Business Intelligence', 'Data Platform', 'Analytics'],
    },
    Finance: {
      Automation:    ['Automation Finance', 'Manufacturing Cost', 'CapEx Planning'],
      Construction:  ['Project Finance', 'Construction Cost', 'Contract Finance'],
      Chemicals:     ['Chemical Cost', 'Plant Finance', 'Raw Materials Cost'],
      _default:      ['Corporate Finance', 'Financial Planning', 'Accounting'],
    },
    Operations: {
      Automation:    ['Factory Operations', 'Production Ops', 'Assembly Ops', 'Line Operations'],
      Construction:  ['Site Operations', 'Field Ops', 'Equipment Ops', 'Logistics Ops'],
      Chemicals:     ['Plant Operations', 'Process Ops', 'Batch Ops', 'Safety Ops'],
      _default:      ['Business Operations', 'General Ops', 'Office Operations'],
    },
    Manufacturing: {
      Automation:    ['Robotics Assembly', 'Sensor Production', 'Component Mfg'],
      Construction:  ['Heavy Equipment', 'Steel Fabrication', 'Prefab Production'],
      Chemicals:     ['Chemical Processing', 'Batch Production', 'Distillation'],
      _default:      ['Production', 'Assembly', 'Quality Control'],
    },
    'Supply Chain': {
      Automation:    ['Parts Procurement', 'Automation Logistics', 'Component Sourcing'],
      Construction:  ['Material Procurement', 'Equipment Logistics', 'Site Delivery'],
      Chemicals:     ['Raw Material Sourcing', 'Chemical Logistics', 'Reagent Supply'],
      _default:      ['Supply Chain', 'Procurement', 'Logistics'],
    },
  };

  const familyMap = titleVariants[jobCode.family] || titleVariants.Engineering;
  const variants = familyMap[verticalName] || familyMap._default;
  const domain = pick(variants);

  // Build a role suffix based on level
  const roleSuffix = {
    1: ['Analyst', 'Associate', 'Coordinator', 'Specialist'],
    2: ['Specialist', 'Analyst', 'Engineer', 'Administrator'],
    3: ['Manager', 'Specialist', 'Consultant', 'Architect'],
    4: ['Manager', 'Director', 'Principal', 'Architect'],
    5: ['Director', 'VP', 'Head', 'Executive'],
  };
  const suffixes = roleSuffix[jobCode.level] || roleSuffix[2];
  const suffix = pick(suffixes);

  return `${prefix}${domain} ${suffix}`;
}

function pickWeighted(items) {
  const r = rand();
  let cumulative = 0;
  for (const item of items) {
    cumulative += item.weight;
    if (r <= cumulative) return item.code;
  }
  return items[items.length - 1].code;
}

const firstNames = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Lisa', 'Daniel', 'Nancy',
  'Priya', 'Raj', 'Ananya', 'Vikram', 'Sunita', 'Amit', 'Deepak', 'Neha',
  'Takeshi', 'Yuki', 'Hiroshi', 'Sakura', 'Kenji', 'Aiko',
  'Hans', 'Klaus', 'Petra', 'Ingrid', 'Stefan', 'Monika',
  'Oliver', 'Charlotte', 'George', 'Amelia', 'Harry', 'Emily',
  'Lucas', 'Ana', 'Pedro', 'Maria', 'Carlos', 'Julia',
  'Wei', 'Li', 'Chen', 'Mei', 'Jun', 'Xiao',
  'Abdullah', 'Fatima', 'Ahmed', 'Zainab', 'Hassan', 'Noor',
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Sharma', 'Patel', 'Gupta', 'Singh', 'Kumar', 'Reddy', 'Nair', 'Iyer',
  'Tanaka', 'Suzuki', 'Watanabe', 'Yamamoto', 'Nakamura', 'Sato',
  'Mueller', 'Schmidt', 'Fischer', 'Weber', 'Becker', 'Hoffmann',
  'Taylor', 'Davies', 'Wilson', 'Roberts', 'Thompson', 'Hughes',
  'Silva', 'Santos', 'Oliveira', 'Pereira', 'Costa', 'Ferreira',
];

function generateEmployeeId(index) {
  return `EMP-${String(index + 1).padStart(5, '0')}`;
}

function lookupDeptPath(deptId) {
  const dept = departments.find(d => d.id === deptId);
  if (!dept) return null;
  const companyCode = companyCodes.find(s => s.id === dept.companyCode);
  if (!companyCode) return null;
  const cc = costCenters.find(c => c.departmentId === deptId);
  return { dept, companyCode, cc, corporate: corporateEntity };
}

export function generateEmployees(count = 500) {
  const employees = [];

  // Pre-compute: for each country, which department IDs are valid per job family
  const countryFamilyDepts = {};
  for (const c of countries) {
    countryFamilyDepts[c.code] = {};
    const ccIds = companyCodes.filter(cc => cc.countryCode === c.code).map(cc => cc.id);
    const countryDeptIds = new Set(departments.filter(d => ccIds.includes(d.companyCode)).map(d => d.id));
    for (const [family, deptIds] of Object.entries(familyToDepartments)) {
      const valid = deptIds.filter(id => countryDeptIds.has(id));
      if (valid.length > 0) countryFamilyDepts[c.code][family] = valid;
    }
  }

  let idx = 0;
  let attempts = 0;
  while (employees.length < count && attempts < count * 3) {
    attempts++;

    // 1. Pick country first (weighted)
    const countryCode = pickWeighted(countryWeights);
    const country = countries.find(c => c.code === countryCode);

    // 2. Pick job code
    const jobCode = pick(jobCodes);

    // 3. Find valid departments for this family in this country
    const validDepts = countryFamilyDepts[countryCode]?.[jobCode.family];
    if (!validDepts || validDepts.length === 0) continue;

    const deptId = pick(validDepts);
    const path = lookupDeptPath(deptId);
    if (!path) continue;

    // Adjust salary for country
    let salaryMultiplier = 1.0;
    if (countryCode === 'IN') salaryMultiplier = 0.30;
    else if (countryCode === 'BR') salaryMultiplier = 0.40;
    else if (countryCode === 'GB') salaryMultiplier = 0.95;
    else if (countryCode === 'DE') salaryMultiplier = 0.90;
    else if (countryCode === 'JP') salaryMultiplier = 0.85;
    else if (countryCode === 'SG') salaryMultiplier = 0.88;
    else if (countryCode === 'AU') salaryMultiplier = 0.92;

    const baseSalaryUSD = Math.round(randBetween(jobCode.baseMin, jobCode.baseMax) * salaryMultiplier);
    const baseSalaryLocal = Math.round(baseSalaryUSD / country.fxToUSD);

    const startYear = 2018 + Math.floor(rand() * 7);
    const startMonth = Math.floor(rand() * 12) + 1;

    employees.push({
      id: generateEmployeeId(idx),
      firstName: pick(firstNames),
      lastName: pick(lastNames),
      email: null, // populated after
      jobCode: jobCode.code,
      jobCodeName: jobCode.title,
      jobTitle: generatePositionTitle(jobCode, path.dept.name, path.companyCode.name),
      jobFamily: jobCode.family,
      jobLevel: jobCode.level,
      departmentId: path.dept.id,
      departmentName: path.dept.name,
      costCenterId: path.cc.id,
      costCenterName: path.cc.name,
      companyCodeId: path.companyCode.id,
      companyCodeName: path.companyCode.name,
      corporateId: path.corporate.id,
      corporateName: path.corporate.name,
      countryCode: country.code,
      countryName: country.name,
      currency: country.currency,
      fxToUSD: country.fxToUSD,
      standardHours: country.standardHours,
      baseSalaryUSD,
      baseSalaryLocal,
      startDate: `${startYear}-${String(startMonth).padStart(2, '0')}-01`,
      status: 'Active', // legacy — kept for back-compat; see employmentStatus/leaveStatus
      employmentStatus: 'Active',
      terminationDate: null,
      terminationReason: null,
      leaveStatus: null, // 'Paid Leave' | 'Unpaid Leave' | 'Disability' | null
      leaveType: null,
      leaveStart: null,
      leaveEnd: null,
      assignmentHistory: [
        {
          effectiveFrom: `${startYear}-${String(startMonth).padStart(2, '0')}-01`,
          effectiveTo: null,
          costCenterId: path.cc.id,
          departmentId: path.dept.id,
          companyCodeId: path.companyCode.id,
          jobCode: jobCode.code,
          reason: 'Initial hire',
        },
      ],
      fte: rand() > 0.08 ? 1.0 : 0.8,
    });
    idx++;
  }

  // Populate emails
  employees.forEach(emp => {
    emp.email = `${emp.firstName.toLowerCase()}.${emp.lastName.toLowerCase()}@burdencorp.com`;
    emp.fullName = `${emp.firstName} ${emp.lastName}`;
  });

  // ── Lifecycle events: terminations, leaves, cost-center moves ──
  const termReasons = ['Voluntary Resignation', 'Retirement', 'Involuntary - Performance', 'Role Eliminated', 'End of Contract'];
  const leaveKinds = [
    { type: 'Parental Leave',  status: 'Paid Leave',   months: 4 },
    { type: 'Medical Leave',   status: 'Paid Leave',   months: 2 },
    { type: 'Sabbatical',      status: 'Unpaid Leave', months: 3 },
    { type: 'Long-term Disability', status: 'Disability', months: 6 },
  ];
  const moveReasons = ['Internal transfer', 'Reorganization', 'Promotion', 'Project reassignment'];

  employees.forEach((emp, i) => {
    const r = rand();
    // ~4% terminated in last 12 months
    if (r < 0.04) {
      const monthsAgo = Math.floor(rand() * 12) + 1;
      const termDate = new Date(AS_OF_YEAR, AS_OF_MONTH - monthsAgo, Math.floor(rand() * 27) + 1);
      emp.employmentStatus = 'Terminated';
      emp.status = 'Terminated';
      emp.terminationDate = termDate.toISOString().slice(0, 10);
      emp.terminationReason = pick(termReasons);
      if (emp.assignmentHistory[0]) {
        emp.assignmentHistory[0].effectiveTo = emp.terminationDate;
      }
    }
    // ~3% currently on leave
    else if (r < 0.07) {
      const kind = pick(leaveKinds);
      const startOffset = Math.floor(rand() * 3) + 1; // 1-3 months ago
      const startDt = new Date(AS_OF_YEAR, AS_OF_MONTH - startOffset, 1);
      const endDt = new Date(startDt);
      endDt.setMonth(endDt.getMonth() + kind.months);
      emp.employmentStatus = 'Active';
      emp.status = 'On Leave';
      emp.leaveStatus = kind.status;
      emp.leaveType = kind.type;
      emp.leaveStart = startDt.toISOString().slice(0, 10);
      emp.leaveEnd = endDt.toISOString().slice(0, 10);
      // Leave suspense assignment — employee's home CC is replaced by CC-LEAVE
      // for the duration of leave, so departmental per-head metrics aren't skewed.
      const prev = emp.assignmentHistory[emp.assignmentHistory.length - 1];
      prev.effectiveTo = emp.leaveStart;
      emp.assignmentHistory.push({
        effectiveFrom: emp.leaveStart,
        effectiveTo: emp.leaveEnd,
        costCenterId: 'CC-LEAVE',
        departmentId: prev.departmentId,
        companyCodeId: prev.companyCodeId,
        jobCode: prev.jobCode,
        reason: `Leave suspense: ${kind.type}`,
      });
    }

    // ~8% had a cost-center move in the last 18 months (independent of leave/term)
    if (rand() < 0.08 && emp.employmentStatus === 'Active') {
      const monthsAgo = Math.floor(rand() * 18) + 1;
      const moveDate = new Date(AS_OF_YEAR, AS_OF_MONTH - monthsAgo, 1);
      const moveDateStr = moveDate.toISOString().slice(0, 10);
      // Close previous assignment, open new one pointing at current CC
      const prev = emp.assignmentHistory[0];
      prev.effectiveTo = moveDateStr;
      // Pretend the previous assignment was a different CC label
      prev.costCenterId = prev.costCenterId + '-PRIOR';
      emp.assignmentHistory.push({
        effectiveFrom: moveDateStr,
        effectiveTo: null,
        costCenterId: emp.costCenterId,
        departmentId: emp.departmentId,
        companyCodeId: emp.companyCodeId,
        jobCode: emp.jobCode,
        reason: pick(moveReasons),
      });
    }
  });

  return employees;
}

// Annual cost multiplier: rates stay flat within a year, step up at year boundaries.
// Combines inflation + market demand adjustment applied once per year.
// 2026 is the reference year (factor = 1.0). Earlier years are lower.
const annualMultipliers = {
  2021: 1.0,                         // base year
  2022: 1.0 * (1 + 0.065 + 0.02),   // +6.5% inflation + 2% market demand
  2023: null,                        // computed below
  2024: null,
  2025: null,
  2026: null,
};
// Chain the multipliers: each year = prior year × (1 + inflation + market adjustment)
const yearAdjustments = {
  2022: 0.065 + 0.020,  // high inflation + talent demand surge
  2023: 0.041 + 0.015,  // moderating inflation + steady demand
  2024: 0.032 + 0.010,  // cooling inflation + normalized demand
  2025: 0.028 + 0.008,  // near-target inflation + slight demand
  2026: 0.025 + 0.005,  // stable inflation + flat market
};
// Years after 2026 (the data rolls forward to the last completed month) use 3%.
const LAST_DATA_YEAR = Math.max(2026, AS_OF_YEAR);
(function buildMultipliers() {
  annualMultipliers[2021] = 1.0;
  for (let y = 2022; y <= LAST_DATA_YEAR; y++) {
    annualMultipliers[y] = annualMultipliers[y - 1] * (1 + (yearAdjustments[y] || 0.03));
  }
  // Normalize so 2026 = 1.0 (current-year baseline)
  const ref = annualMultipliers[2026];
  for (let y = 2021; y <= LAST_DATA_YEAR; y++) {
    annualMultipliers[y] = annualMultipliers[y] / ref;
  }
})();

function getAnnualMultiplier(period) {
  const year = parseInt(period.split('-')[0], 10);
  return annualMultipliers[year] || 1.0;
}

export function generateCostData(employees, periods) {
  const costRecords = [];

  for (const period of periods) {
    const periodMultiplier = getAnnualMultiplier(period);

    for (const emp of employees) {
      const monthlyBase = (emp.baseSalaryUSD / 12) * periodMultiplier;
      const country = countries.find(c => c.code === emp.countryCode);

      // Direct costs
      const payroll = Math.round(monthlyBase * emp.fte);
      const bonus = rand() > 0.85 ? Math.round(monthlyBase * randBetween(0.05, 0.20)) : 0;
      const shiftDiff = emp.jobFamily === 'Manufacturing' ? Math.round(monthlyBase * randBetween(0.03, 0.08)) : 0;
      const overtime = rand() > 0.80 ? Math.round(monthlyBase * randBetween(0.02, 0.10)) : 0;

      const directTotal = payroll + bonus + shiftDiff + overtime;

      // Benefits — use country-specific rules engine (applied on inflated base)
      const benefitDetails = {};
      let benefitTotal = 0;
      const countryRules = getRulesForCountry(emp.countryCode);

      let benefitRuleDetails = null;
      if (countryRules.length > 0) {
        const benefitResult = calculateAllBenefits(emp, monthlyBase);
        for (const detail of benefitResult.details) {
          const catKey = detail.categoryId;
          benefitDetails[catKey] = (benefitDetails[catKey] || 0) + detail.employer;
        }
        benefitTotal = benefitResult.totalEmployerCost;
        benefitRuleDetails = benefitResult.details;
      } else {
        const benefitMult = country ? country.benefitMultiplier : 1.0;
        for (const bc of benefitCategories) {
          const rate = randBetween(bc.rateRange[0], bc.rateRange[1]) * benefitMult;
          const amount = Math.round(monthlyBase * rate);
          benefitDetails[bc.id] = amount;
          benefitTotal += amount;
        }
      }

      // Overheads (allocated) — also scale with inflation
      const overheadDetails = {};
      let overheadTotal = 0;
      for (const oc of overheadCategories) {
        const rate = randBetween(oc.rateRange[0], oc.rateRange[1]);
        const amount = Math.round(monthlyBase * rate);
        overheadDetails[oc.id] = amount;
        overheadTotal += amount;
      }

      const totalCostToCompany = directTotal + benefitTotal + overheadTotal;
      const monthlyHours = (emp.standardHours / 12) * emp.fte;
      const burdenAmount = benefitTotal + overheadTotal;
      const burdenRate = monthlyHours > 0 ? totalCostToCompany / monthlyHours : 0;

      costRecords.push({
        employeeId: emp.id,
        period,
        direct: {
          payroll,
          bonus,
          shiftDifferential: shiftDiff,
          overtime,
          total: directTotal,
        },
        benefits: {
          ...benefitDetails,
          total: benefitTotal,
          ruleDetails: benefitRuleDetails,
        },
        overhead: {
          ...overheadDetails,
          total: overheadTotal,
        },
        totalCostToCompany,
        burdenAmount,
        burdenRate: Math.round(burdenRate * 100) / 100,
        productiveHours: Math.round(monthlyHours * 100) / 100,
        // Currency info — amounts above are in USD; use fxFromUSD to convert to local
        currency: 'USD',
        localCurrency: country?.currency || 'USD',
        currencySymbol: country?.symbol || '$',
        fxToUSD: country?.fxToUSD || 1.0,
        fxFromUSD: country?.fxFromUSD || 1.0,
      });
    }
  }

  return costRecords;
}

export function generateAllocationRules() {
  return [
    {
      id: 'AR-001',
      name: 'Facilities Allocation - Headcount',
      costCategory: 'OH-FAC',
      method: 'headcount',
      description: 'Allocate facilities costs proportionally by headcount per cost center',
      effectiveDate: '2025-01-01',
      endDate: null,
      version: 3,
      status: 'Active',
      approvedBy: 'CFO Office',
      approvedDate: '2024-12-15',
      createdBy: 'admin@burdencorp.com',
      lastModified: '2024-12-15',
    },
    {
      id: 'AR-002',
      name: 'IT Infrastructure - Per Capita',
      costCategory: 'OH-IT',
      method: 'headcount',
      description: 'IT costs allocated equally per employee',
      effectiveDate: '2025-01-01',
      endDate: null,
      version: 2,
      status: 'Active',
      approvedBy: 'CIO & CFO',
      approvedDate: '2024-12-20',
      createdBy: 'admin@burdencorp.com',
      lastModified: '2024-12-20',
    },
    {
      id: 'AR-003',
      name: 'G&A Allocation - % of Payroll',
      costCategory: 'OH-GA',
      method: 'percent-of-payroll',
      description: 'General & Administrative costs as a percentage of payroll cost per cost center',
      effectiveDate: '2025-01-01',
      endDate: null,
      version: 4,
      status: 'Active',
      approvedBy: 'CFO Office',
      approvedDate: '2024-11-30',
      createdBy: 'admin@burdencorp.com',
      lastModified: '2024-11-30',
    },
    {
      id: 'AR-004',
      name: 'Shared Services - Labor Hour',
      costCategory: 'OH-SS',
      method: 'labor-hour',
      description: 'Shared services costs allocated by productive labor hours per department',
      effectiveDate: '2025-01-01',
      endDate: null,
      version: 1,
      status: 'Active',
      approvedBy: 'VP Finance',
      approvedDate: '2024-12-10',
      createdBy: 'admin@burdencorp.com',
      lastModified: '2024-12-10',
    },
    {
      id: 'AR-005',
      name: 'Depreciation - Cost Center Proportional',
      costCategory: 'OH-DEP',
      method: 'cost-center-proportional',
      description: 'Depreciation allocated proportionally based on cost center total direct costs',
      effectiveDate: '2025-01-01',
      endDate: null,
      version: 2,
      status: 'Active',
      approvedBy: 'Controller',
      approvedDate: '2024-12-01',
      createdBy: 'admin@burdencorp.com',
      lastModified: '2024-12-01',
    },
    {
      id: 'AR-006',
      name: 'Corporate Allocations - Revenue-based',
      costCategory: 'OH-CORP',
      method: 'percent-of-payroll',
      description: 'Corporate overhead allocated by payroll share of each business unit',
      effectiveDate: '2025-01-01',
      endDate: null,
      version: 5,
      status: 'Active',
      approvedBy: 'CEO & CFO',
      approvedDate: '2024-12-22',
      createdBy: 'admin@burdencorp.com',
      lastModified: '2024-12-22',
    },
    {
      id: 'AR-007',
      name: 'Facilities v2 - Square Footage (Draft)',
      costCategory: 'OH-FAC',
      method: 'custom',
      description: 'DRAFT: New facilities allocation based on occupied square footage per department',
      effectiveDate: isoDay(new Date(Date.UTC(AS_OF_YEAR, AS_OF_MONTH + 3, 1))), // a quarter out
      endDate: null,
      version: 1,
      status: 'Draft',
      approvedBy: null,
      approvedDate: null,
      createdBy: 'admin@burdencorp.com',
      lastModified: isoDay(asOfDate(-16)),
    },
  ];
}

export function generateCalculationRuns(periods) {
  return periods.map((period, i) => {
    // Realistic durations between ~2m and ~4m, pseudo-random but deterministic.
    const durationSecs = 130 + ((i * 37) % 110); // 130s..239s
    const start = new Date(`${period}-05T08:00:00Z`);
    const end = new Date(start.getTime() + durationSecs * 1000);
    return {
      id: `RUN-${String(i + 1).padStart(3, '0')}`,
      period,
      status: 'Completed',
      startedAt: start.toISOString(),
      completedAt: end.toISOString(),
      employeeCount: 500,
    totalCostToCompany: 0, // Will be computed
      initiatedBy: 'system@burdencorp.com',
      type: 'Monthly Close',
      notes: `Standard monthly close calculation for ${period}`,
    };
  });
}

export function generateAuditLog() {
  // Dated just after the latest month-end close so the log always looks recent.
  const t = (days, h, m) => asOfDate(days, h, m).toISOString().replace('.000', '');
  const thisMonth = asOfMonthName(0);
  const lastMonth = asOfMonthName(1);
  return [
    { id: 1, timestamp: t(-3, 14, 22), user: 'admin@burdencorp.com', action: 'Allocation Rule Modified', target: 'AR-003', details: 'Updated G&A rate from 6.5% to 7.0%', category: 'Configuration' },
    { id: 2, timestamp: t(-4, 9, 15), user: 'system@burdencorp.com', action: 'Calculation Run Completed', target: 'RUN-006', details: `${thisMonth} monthly close - 500 employees processed`, category: 'Calculation' },
    { id: 3, timestamp: t(-6, 16, 45), user: 'hr.admin@burdencorp.com', action: 'Employee Data Import', target: 'Batch Import', details: 'Updated 12 employee records from HRIS feed', category: 'Data' },
    { id: 4, timestamp: t(-9, 11, 0), user: 'finance@burdencorp.com', action: 'Report Exported', target: 'Burden Rate by Country', details: `${asOfQuarter()} burden rate report exported to Excel`, category: 'Reporting' },
    { id: 5, timestamp: t(-11, 8, 30), user: 'admin@burdencorp.com', action: 'FX Rates Updated', target: 'Currency Table', details: `${thisMonth} FX rates loaded from Treasury`, category: 'Configuration' },
    { id: 6, timestamp: t(-13, 13, 20), user: 'cfo@burdencorp.com', action: 'Allocation Rule Approved', target: 'AR-006', details: 'Corporate Allocations rule v5 approved', category: 'Approval' },
    { id: 7, timestamp: t(-16, 10, 0), user: 'admin@burdencorp.com', action: 'User Role Changed', target: 'new.analyst@burdencorp.com', details: 'Role changed from Viewer to Analyst', category: 'Security' },
    { id: 8, timestamp: t(-19, 15, 45), user: 'system@burdencorp.com', action: 'SAP Extract Received', target: 'Cost Center Actuals', details: `${lastMonth} GL actuals imported - 2,847 line items`, category: 'Data' },
    { id: 9, timestamp: t(-21, 9, 0), user: 'admin@burdencorp.com', action: 'New Cost Category Added', target: 'OH-CYBER', details: `Cybersecurity allocation category added for ${asOfFiscalYear()}`, category: 'Configuration' },
    { id: 10, timestamp: t(-23, 14, 30), user: 'hr.admin@burdencorp.com', action: 'Org Hierarchy Updated', target: 'CCODE-AUTO', details: 'Automation Vertical reorganized - 2 new departments added', category: 'Data' },
  ];
}

// Monthly periods from April 2021 up to the last completed month (DATA_AS_OF),
// so the sample data is always current. Earlier periods never change.
function generatePeriods() {
  const result = [];
  let year = 2021;
  let month = 4;
  const endYear = AS_OF_YEAR;
  const endMonth = AS_OF_MONTH;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return result;
}

// Generate all data
const periods = generatePeriods();
const employees = generateEmployees(500);
const costData = generateCostData(employees, periods);
const allocationRules = generateAllocationRules();
const calculationRuns = generateCalculationRuns(periods);
const auditLog = generateAuditLog();

// Compute run totals
for (const run of calculationRuns) {
  const periodCosts = costData.filter(c => c.period === run.period);
  run.totalCostToCompany = periodCosts.reduce((sum, c) => sum + c.totalCostToCompany, 0);
}

export { employees, costData, allocationRules, calculationRuns, auditLog, periods, countries, DATA_AS_OF };

// Aggregation helpers
export function aggregateByField(costRecords, employeeMap, field, period = null) {
  const filtered = period ? costRecords.filter(c => c.period === period) : costRecords;
  const groups = {};

  // Resolve the name field: costCenterId → costCenterName, jobCode → jobCodeName, etc.
  const nameFieldMap = {
    jobCode: 'jobCodeName',
    jobFamily: 'jobFamily',
    countryCode: 'countryName',
  };
  const nameField = nameFieldMap[field] || field.replace('Id', 'Name');

  for (const record of filtered) {
    const emp = employeeMap[record.employeeId];
    if (!emp) continue;
    const key = emp[field] || 'Unknown';
    if (!groups[key]) {
      groups[key] = {
        key,
        label: emp[nameField] || key,
        employeeCount: new Set(),
        directTotal: 0,
        benefitTotal: 0,
        overheadTotal: 0,
        totalCostToCompany: 0,
        totalHours: 0,
        periods: new Set(),
      };
    }
    groups[key].employeeCount.add(record.employeeId);
    groups[key].directTotal += record.direct.total;
    groups[key].benefitTotal += record.benefits.total;
    groups[key].overheadTotal += record.overhead.total;
    groups[key].totalCostToCompany += record.totalCostToCompany;
    groups[key].totalHours += record.productiveHours;
    groups[key].periods.add(record.period);
  }

  return Object.values(groups).map(g => ({
    ...g,
    employeeCount: g.employeeCount.size,
    periodCount: g.periods.size,
    avgBurdenRate: g.totalHours > 0 ? Math.round((g.totalCostToCompany / g.totalHours) * 100) / 100 : 0,
    burdenAmount: g.benefitTotal + g.overheadTotal,
  })).sort((a, b) => b.totalCostToCompany - a.totalCostToCompany);
}

export function aggregateByPeriod(costRecords) {
  const groups = {};
  for (const record of costRecords) {
    if (!groups[record.period]) {
      groups[record.period] = {
        period: record.period,
        employeeCount: new Set(),
        directTotal: 0,
        benefitTotal: 0,
        overheadTotal: 0,
        totalCostToCompany: 0,
        totalHours: 0,
      };
    }
    groups[record.period].employeeCount.add(record.employeeId);
    groups[record.period].directTotal += record.direct.total;
    groups[record.period].benefitTotal += record.benefits.total;
    groups[record.period].overheadTotal += record.overhead.total;
    groups[record.period].totalCostToCompany += record.totalCostToCompany;
    groups[record.period].totalHours += record.productiveHours;
  }

  return Object.values(groups)
    .map(g => ({
      ...g,
      employeeCount: g.employeeCount.size,
      avgBurdenRate: g.totalHours > 0 ? Math.round((g.totalCostToCompany / g.totalHours) * 100) / 100 : 0,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

export function getEmployeeDetail(employeeId, costRecords) {
  return costRecords
    .filter(c => c.employeeId === employeeId)
    .sort((a, b) => a.period.localeCompare(b.period));
}
