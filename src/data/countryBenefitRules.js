/**
 * Country-Specific Benefit Rules Engine
 *
 * Each country has a set of benefit rules. Each rule defines:
 * - The benefit category
 * - Whether it's statutory (government-mandated) or employer-sponsored
 * - The contribution type: employer, employee, or both
 * - Percentage-based rate applied to a configurable base (basePay, eligibleEarnings, totalComp)
 * - Min/max caps (for statutory compliance — e.g., India PF ceiling)
 * - Conditional tiers based on years of service, job level, cost center, etc.
 * - Versioning with effective dates
 */

// ─── Benefit Rule Schema ────────────────────────────────────────────────
// {
//   id: string,
//   countryCode: string,
//   categoryId: string,          // maps to benefitCategories
//   name: string,
//   type: 'statutory' | 'employer-sponsored',
//   contributionSplit: { employer: number, employee: number }, // percentages of the total rate
//   baseField: 'basePay' | 'eligibleEarnings' | 'totalComp',
//   rate: number,                 // default rate (decimal, e.g., 0.12 = 12%)
//   minAmountMonthly: number | null,
//   maxAmountMonthly: number | null,
//   maxBaseMonthly: number | null, // cap on the base amount (e.g., PF ceiling ₹15,000/mo)
//   tiers: [ { condition, rate } ],  // conditional overrides
//   effectiveDate: string,
//   endDate: string | null,
//   version: number,
//   status: 'Active' | 'Draft' | 'Archived',
//   regulatoryRef: string | null,
//   approvedBy: string | null,
//   lastModified: string,
//   notes: string,
// }

export const countryBenefitRules = [

  // ════════════════════════════════════════════════════════════════════════
  // UNITED STATES (US)
  // ════════════════════════════════════════════════════════════════════════

  // --- Statutory ---
  {
    id: 'CBR-US-001',
    countryCode: 'US',
    categoryId: 'BEN-STAT',
    name: 'FICA – Social Security (OASDI)',
    type: 'statutory',
    contributionSplit: { employer: 50, employee: 50 },
    baseField: 'basePay',
    rate: 0.062,
    minAmountMonthly: null,
    maxBaseMonthly: 14175,  // $170,100/yr ÷ 12 (2025 wage base)
    maxAmountMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 2,
    status: 'Active',
    regulatoryRef: 'IRC §3101 / §3111',
    approvedBy: 'CFO Office',
    lastModified: '2024-12-01',
    notes: 'Employer portion only included in burden. Wage base updated annually.',
  },
  {
    id: 'CBR-US-002',
    countryCode: 'US',
    categoryId: 'BEN-STAT',
    name: 'FICA – Medicare (HI)',
    type: 'statutory',
    contributionSplit: { employer: 50, employee: 50 },
    baseField: 'basePay',
    rate: 0.0145,
    minAmountMonthly: null,
    maxBaseMonthly: null,  // No wage cap
    maxAmountMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: 'IRC §3101(b) / §3111(b)',
    approvedBy: 'CFO Office',
    lastModified: '2024-12-01',
    notes: 'No wage base limit. Additional 0.9% employee-only surtax above $200K not included here.',
  },
  {
    id: 'CBR-US-003',
    countryCode: 'US',
    categoryId: 'BEN-STAT',
    name: 'FUTA – Federal Unemployment',
    type: 'statutory',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.006,
    minAmountMonthly: null,
    maxBaseMonthly: 583.33,  // $7,000/yr ÷ 12
    maxAmountMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: 'IRC §3301',
    approvedBy: 'CFO Office',
    lastModified: '2024-12-01',
    notes: 'Effective rate after state credit (0.6%). Wage base $7,000/yr.',
  },

  // --- Employer-Sponsored (US) ---
  {
    id: 'CBR-US-010',
    countryCode: 'US',
    categoryId: 'BEN-RET',
    name: '401(k) Employer Match',
    type: 'employer-sponsored',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.04,
    minAmountMonthly: null,
    maxBaseMonthly: null,
    maxAmountMonthly: 1916.67,  // $23,000 annual limit ÷ 12 (match cap proxy)
    tiers: [
      { condition: { field: 'yearsOfService', operator: '>=', value: 5 }, rate: 0.05, label: '5+ years: 5% match' },
      { condition: { field: 'yearsOfService', operator: '>=', value: 10 }, rate: 0.06, label: '10+ years: 6% match' },
      { condition: { field: 'jobLevel', operator: '>=', value: 4 }, rate: 0.06, label: 'Level 4+: 6% match' },
    ],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 3,
    status: 'Active',
    regulatoryRef: 'ERISA / IRC §401(k)',
    approvedBy: 'VP Total Rewards',
    lastModified: '2025-01-15',
    notes: 'Tiered match: 4% base, 5% at 5yr, 6% at 10yr or Level 4+. Highest applicable tier wins.',
  },
  {
    id: 'CBR-US-011',
    countryCode: 'US',
    categoryId: 'BEN-MED',
    name: 'Medical Insurance – Employer Share',
    type: 'employer-sponsored',
    contributionSplit: { employer: 75, employee: 25 },
    baseField: 'basePay',
    rate: 0.10,
    minAmountMonthly: 400,
    maxAmountMonthly: 1800,
    maxBaseMonthly: null,
    tiers: [
      { condition: { field: 'jobLevel', operator: '>=', value: 4 }, rate: 0.12, label: 'Exec plan: 12%' },
    ],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 2,
    status: 'Active',
    regulatoryRef: 'ACA Compliance',
    approvedBy: 'VP Total Rewards',
    lastModified: '2025-02-01',
    notes: 'PPO/HMO employer portion. Executive plan at Level 4+.',
  },
  {
    id: 'CBR-US-012',
    countryCode: 'US',
    categoryId: 'BEN-DEN',
    name: 'Dental & Vision – Employer Share',
    type: 'employer-sponsored',
    contributionSplit: { employer: 80, employee: 20 },
    baseField: 'basePay',
    rate: 0.015,
    minAmountMonthly: 50,
    maxAmountMonthly: 250,
    maxBaseMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: null,
    approvedBy: 'VP Total Rewards',
    lastModified: '2024-12-15',
    notes: 'Combined dental + vision employer contribution.',
  },
  {
    id: 'CBR-US-013',
    countryCode: 'US',
    categoryId: 'BEN-LIF',
    name: 'Life & Disability Insurance',
    type: 'employer-sponsored',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.012,
    minAmountMonthly: null,
    maxAmountMonthly: 500,
    maxBaseMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: null,
    approvedBy: 'VP Total Rewards',
    lastModified: '2024-12-15',
    notes: '1x salary life + STD/LTD coverage, 100% employer-paid.',
  },
  {
    id: 'CBR-US-014',
    countryCode: 'US',
    categoryId: 'BEN-PTO',
    name: 'PTO & Leave Accrual',
    type: 'employer-sponsored',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.077,
    minAmountMonthly: null,
    maxAmountMonthly: null,
    maxBaseMonthly: null,
    tiers: [
      { condition: { field: 'yearsOfService', operator: '>=', value: 5 }, rate: 0.096, label: '5+ years: 5 weeks PTO' },
      { condition: { field: 'yearsOfService', operator: '>=', value: 10 }, rate: 0.115, label: '10+ years: 6 weeks PTO' },
    ],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 2,
    status: 'Active',
    regulatoryRef: null,
    approvedBy: 'VP Total Rewards',
    lastModified: '2025-01-10',
    notes: 'Accrual cost: 4 weeks base, 5 weeks at 5yr, 6 weeks at 10yr.',
  },
  {
    id: 'CBR-US-015',
    countryCode: 'US',
    categoryId: 'BEN-EDU',
    name: 'Education & Tuition Reimbursement',
    type: 'employer-sponsored',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.008,
    minAmountMonthly: null,
    maxAmountMonthly: 437.50,  // $5,250 annual IRC §127 limit ÷ 12
    maxBaseMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: 'IRC §127',
    approvedBy: 'VP Total Rewards',
    lastModified: '2024-12-15',
    notes: 'Tax-free up to $5,250/yr per IRC §127.',
  },
  {
    id: 'CBR-US-016',
    countryCode: 'US',
    categoryId: 'BEN-WEL',
    name: 'Wellness & Perks Program',
    type: 'employer-sponsored',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.006,
    minAmountMonthly: 25,
    maxAmountMonthly: 150,
    maxBaseMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: null,
    approvedBy: 'VP Total Rewards',
    lastModified: '2024-12-15',
    notes: 'Gym subsidies, mental health, commuter benefits.',
  },

  // ════════════════════════════════════════════════════════════════════════
  // INDIA (IN)
  // ════════════════════════════════════════════════════════════════════════

  // --- Statutory ---
  {
    id: 'CBR-IN-001',
    countryCode: 'IN',
    categoryId: 'BEN-STAT',
    name: 'Provident Fund (EPF) – Employer',
    type: 'statutory',
    contributionSplit: { employer: 50, employee: 50 },
    baseField: 'basePay',
    rate: 0.12,
    minAmountMonthly: null,
    maxBaseMonthly: 180,  // ₹15,000/mo ÷ 83.3 (INR→USD) ≈ $180
    maxAmountMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 2,
    status: 'Active',
    regulatoryRef: 'EPF & MP Act, 1952',
    approvedBy: 'India Finance Head',
    lastModified: '2025-01-05',
    notes: 'Statutory 12% on basic (capped at ₹15,000 basic for statutory minimum). Company contributes on full basic.',
  },
  {
    id: 'CBR-IN-002',
    countryCode: 'IN',
    categoryId: 'BEN-STAT',
    name: 'Employee State Insurance (ESIC)',
    type: 'statutory',
    contributionSplit: { employer: 57, employee: 43 },
    baseField: 'basePay',
    rate: 0.0325,
    minAmountMonthly: null,
    maxBaseMonthly: 252,  // ₹21,000/mo threshold ÷ 83.3
    maxAmountMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: 'ESI Act, 1948',
    approvedBy: 'India Finance Head',
    lastModified: '2024-12-01',
    notes: 'Employer 3.25% on gross wages. Applicable only if gross ≤ ₹21,000/mo.',
  },
  {
    id: 'CBR-IN-003',
    countryCode: 'IN',
    categoryId: 'BEN-STAT',
    name: 'Gratuity Provision',
    type: 'statutory',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.0481,
    minAmountMonthly: null,
    maxBaseMonthly: null,
    maxAmountMonthly: null,
    tiers: [
      { condition: { field: 'yearsOfService', operator: '>=', value: 5 }, rate: 0.0481, label: 'Eligible after 5 years' },
    ],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: 'Payment of Gratuity Act, 1972',
    approvedBy: 'India Finance Head',
    lastModified: '2024-12-01',
    notes: '4.81% of basic monthly accrual (15/26 days per year of service). Max ₹20 lakh payout.',
  },

  // --- Employer-Sponsored (IN) ---
  {
    id: 'CBR-IN-010',
    countryCode: 'IN',
    categoryId: 'BEN-MED',
    name: 'Group Medical Insurance',
    type: 'employer-sponsored',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.035,
    minAmountMonthly: 15,
    maxAmountMonthly: 120,
    maxBaseMonthly: null,
    tiers: [
      { condition: { field: 'jobLevel', operator: '>=', value: 4 }, rate: 0.05, label: 'Senior: enhanced coverage' },
    ],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 2,
    status: 'Active',
    regulatoryRef: null,
    approvedBy: 'India HR Head',
    lastModified: '2025-01-10',
    notes: 'Group mediclaim ₹5L base, ₹10L for seniors.',
  },
  {
    id: 'CBR-IN-011',
    countryCode: 'IN',
    categoryId: 'BEN-PTO',
    name: 'Leave Encashment Accrual',
    type: 'employer-sponsored',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.058,
    minAmountMonthly: null,
    maxAmountMonthly: null,
    maxBaseMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: null,
    approvedBy: 'India HR Head',
    lastModified: '2024-12-01',
    notes: '15 days earned leave accrual for encashment.',
  },
  {
    id: 'CBR-IN-012',
    countryCode: 'IN',
    categoryId: 'BEN-EDU',
    name: 'Learning & Development',
    type: 'employer-sponsored',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.01,
    minAmountMonthly: null,
    maxAmountMonthly: 50,
    maxBaseMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: null,
    approvedBy: 'India HR Head',
    lastModified: '2024-12-01',
    notes: 'Annual training budget allocated monthly.',
  },

  // ════════════════════════════════════════════════════════════════════════
  // UNITED KINGDOM (GB)
  // ════════════════════════════════════════════════════════════════════════

  {
    id: 'CBR-GB-001',
    countryCode: 'GB',
    categoryId: 'BEN-STAT',
    name: 'Employer NIC (Class 1)',
    type: 'statutory',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.138,
    minAmountMonthly: null,
    maxBaseMonthly: null,
    maxAmountMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 2,
    status: 'Active',
    regulatoryRef: 'Social Security Contributions and Benefits Act 1992',
    approvedBy: 'UK Finance Controller',
    lastModified: '2025-01-05',
    notes: '13.8% employer NIC on earnings above secondary threshold (£175/wk).',
  },
  {
    id: 'CBR-GB-002',
    countryCode: 'GB',
    categoryId: 'BEN-RET',
    name: 'Auto-Enrolment Pension – Employer',
    type: 'statutory',
    contributionSplit: { employer: 60, employee: 40 },
    baseField: 'basePay',
    rate: 0.05,
    minAmountMonthly: null,
    maxBaseMonthly: null,
    maxAmountMonthly: null,
    tiers: [
      { condition: { field: 'yearsOfService', operator: '>=', value: 3 }, rate: 0.07, label: '3+ years: enhanced pension' },
      { condition: { field: 'jobLevel', operator: '>=', value: 4 }, rate: 0.10, label: 'Senior: 10% employer pension' },
    ],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 3,
    status: 'Active',
    regulatoryRef: 'Pensions Act 2008',
    approvedBy: 'UK Finance Controller',
    lastModified: '2025-02-01',
    notes: 'Statutory min 3%, enhanced to 5% base, 7% at 3yr, 10% for seniors.',
  },
  {
    id: 'CBR-GB-010',
    countryCode: 'GB',
    categoryId: 'BEN-MED',
    name: 'Private Medical Insurance',
    type: 'employer-sponsored',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.04,
    minAmountMonthly: 100,
    maxAmountMonthly: 500,
    maxBaseMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: null,
    approvedBy: 'UK HR Director',
    lastModified: '2024-12-15',
    notes: 'PMI through Bupa/AXA for all UK employees.',
  },
  {
    id: 'CBR-GB-011',
    countryCode: 'GB',
    categoryId: 'BEN-PTO',
    name: 'Annual Leave Accrual',
    type: 'statutory',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.107,
    minAmountMonthly: null,
    maxAmountMonthly: null,
    maxBaseMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: 'Working Time Regulations 1998',
    approvedBy: 'UK HR Director',
    lastModified: '2024-12-01',
    notes: '28 days statutory (inc bank holidays) = ~10.7% accrual.',
  },

  // ════════════════════════════════════════════════════════════════════════
  // GERMANY (DE)
  // ════════════════════════════════════════════════════════════════════════

  {
    id: 'CBR-DE-001',
    countryCode: 'DE',
    categoryId: 'BEN-STAT',
    name: 'Sozialversicherung – Employer Share',
    type: 'statutory',
    contributionSplit: { employer: 50, employee: 50 },
    baseField: 'basePay',
    rate: 0.199,
    minAmountMonthly: null,
    maxBaseMonthly: null,
    maxAmountMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 2,
    status: 'Active',
    regulatoryRef: 'Sozialgesetzbuch (SGB)',
    approvedBy: 'DE Finance Lead',
    lastModified: '2025-01-10',
    notes: 'Combined: pension 9.3% + health 7.3% + unemployment 1.3% + care 1.7% + accident ~0.3% ≈ 19.9% employer.',
  },
  {
    id: 'CBR-DE-010',
    countryCode: 'DE',
    categoryId: 'BEN-RET',
    name: 'Company Pension (bAV)',
    type: 'employer-sponsored',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.04,
    minAmountMonthly: null,
    maxAmountMonthly: 604,   // €7,248/yr ÷ 12 (2025 BBG limit)
    maxBaseMonthly: null,
    tiers: [
      { condition: { field: 'yearsOfService', operator: '>=', value: 5 }, rate: 0.05, label: '5+ years: enhanced bAV' },
    ],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 2,
    status: 'Active',
    regulatoryRef: 'Betriebsrentengesetz (BetrAVG)',
    approvedBy: 'DE Finance Lead',
    lastModified: '2025-01-15',
    notes: 'Employer-funded company pension. 15% Arbeitgeberzuschuss on employee contribution.',
  },
  {
    id: 'CBR-DE-011',
    countryCode: 'DE',
    categoryId: 'BEN-PTO',
    name: 'Urlaub & Holiday Accrual',
    type: 'statutory',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.115,
    minAmountMonthly: null,
    maxAmountMonthly: null,
    maxBaseMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: 'Bundesurlaubsgesetz (BUrlG)',
    approvedBy: 'DE Finance Lead',
    lastModified: '2024-12-01',
    notes: '30 days vacation = ~11.5% accrual. Statutory minimum 20 days.',
  },

  // ════════════════════════════════════════════════════════════════════════
  // JAPAN (JP)
  // ════════════════════════════════════════════════════════════════════════

  {
    id: 'CBR-JP-001',
    countryCode: 'JP',
    categoryId: 'BEN-STAT',
    name: 'Social Insurance – Employer Share',
    type: 'statutory',
    contributionSplit: { employer: 50, employee: 50 },
    baseField: 'basePay',
    rate: 0.155,
    minAmountMonthly: null,
    maxBaseMonthly: null,
    maxAmountMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: 'Shakai Hoken',
    approvedBy: 'JP Finance Controller',
    lastModified: '2024-12-01',
    notes: 'Health 5%, pension 9.15%, employment 0.6%, accident 0.3%, childcare 0.36% ≈ 15.5%.',
  },
  {
    id: 'CBR-JP-010',
    countryCode: 'JP',
    categoryId: 'BEN-RET',
    name: 'Corporate Defined Contribution (DC)',
    type: 'employer-sponsored',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.035,
    minAmountMonthly: null,
    maxAmountMonthly: 368,  // ¥55,000/mo ÷ 149.5
    maxBaseMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: 'Defined Contribution Pension Act',
    approvedBy: 'JP Finance Controller',
    lastModified: '2024-12-01',
    notes: 'iDeCo corporate match. Max ¥55,000/mo.',
  },
  {
    id: 'CBR-JP-011',
    countryCode: 'JP',
    categoryId: 'BEN-PTO',
    name: 'Annual Paid Leave Accrual',
    type: 'statutory',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.077,
    minAmountMonthly: null,
    maxAmountMonthly: null,
    maxBaseMonthly: null,
    tiers: [
      { condition: { field: 'yearsOfService', operator: '>=', value: 6 }, rate: 0.096, label: '6.5+ yrs: 20 days' },
    ],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: 'Labor Standards Act Art. 39',
    approvedBy: 'JP Finance Controller',
    lastModified: '2024-12-01',
    notes: '10 days at start, scaling to 20 days at 6.5yr. Mandatory 5 days usage.',
  },

  // ════════════════════════════════════════════════════════════════════════
  // BRAZIL (BR)
  // ════════════════════════════════════════════════════════════════════════

  {
    id: 'CBR-BR-001',
    countryCode: 'BR',
    categoryId: 'BEN-STAT',
    name: 'INSS – Employer Social Security',
    type: 'statutory',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.20,
    minAmountMonthly: null,
    maxBaseMonthly: null,
    maxAmountMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: 'Lei 8.212/91',
    approvedBy: 'BR Finance Controller',
    lastModified: '2024-12-01',
    notes: '20% employer INSS on total compensation.',
  },
  {
    id: 'CBR-BR-002',
    countryCode: 'BR',
    categoryId: 'BEN-STAT',
    name: 'FGTS – Severance Fund',
    type: 'statutory',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.08,
    minAmountMonthly: null,
    maxBaseMonthly: null,
    maxAmountMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: 'Lei 8.036/90',
    approvedBy: 'BR Finance Controller',
    lastModified: '2024-12-01',
    notes: '8% of gross salary deposited monthly.',
  },
  {
    id: 'CBR-BR-003',
    countryCode: 'BR',
    categoryId: 'BEN-PTO',
    name: '13th Salary + Vacation Bonus',
    type: 'statutory',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.111,
    minAmountMonthly: null,
    maxAmountMonthly: null,
    maxBaseMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: 'CLT Art. 129-153',
    approvedBy: 'BR Finance Controller',
    lastModified: '2024-12-01',
    notes: '13th salary (8.33%) + 1/3 vacation bonus (2.78%) = ~11.1% monthly accrual.',
  },

  // ════════════════════════════════════════════════════════════════════════
  // SINGAPORE (SG)
  // ════════════════════════════════════════════════════════════════════════

  {
    id: 'CBR-SG-001',
    countryCode: 'SG',
    categoryId: 'BEN-STAT',
    name: 'CPF – Employer Contribution',
    type: 'statutory',
    contributionSplit: { employer: 52, employee: 48 },
    baseField: 'basePay',
    rate: 0.17,
    minAmountMonthly: null,
    maxBaseMonthly: 4460,  // S$6,000/mo ÷ 1.345
    maxAmountMonthly: null,
    tiers: [
      { condition: { field: 'employeeAge', operator: '>=', value: 55 }, rate: 0.145, label: '55-60: reduced CPF' },
      { condition: { field: 'employeeAge', operator: '>=', value: 60 }, rate: 0.105, label: '60-65: further reduced' },
    ],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 2,
    status: 'Active',
    regulatoryRef: 'CPF Act (Cap. 36)',
    approvedBy: 'SG Finance Controller',
    lastModified: '2025-01-05',
    notes: '17% employer for ≤55, reducing with age. Ordinary wage ceiling S$6,000/mo.',
  },
  {
    id: 'CBR-SG-002',
    countryCode: 'SG',
    categoryId: 'BEN-STAT',
    name: 'Skills Development Levy (SDL)',
    type: 'statutory',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.0025,
    minAmountMonthly: 2,
    maxAmountMonthly: 8.15,  // S$11.25/mo ÷ 1.345
    maxBaseMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: 'Skills Development Levy Act',
    approvedBy: 'SG Finance Controller',
    lastModified: '2024-12-01',
    notes: '0.25% of monthly remuneration, min S$2, max S$11.25.',
  },

  // ════════════════════════════════════════════════════════════════════════
  // AUSTRALIA (AU)
  // ════════════════════════════════════════════════════════════════════════

  {
    id: 'CBR-AU-001',
    countryCode: 'AU',
    categoryId: 'BEN-STAT',
    name: 'Superannuation Guarantee (SG)',
    type: 'statutory',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.115,
    minAmountMonthly: null,
    maxBaseMonthly: 5083,  // A$62,270 quarterly max base ÷ 3 ÷ (AUD→USD)
    maxAmountMonthly: null,
    tiers: [],
    effectiveDate: '2025-07-01',
    endDate: null,
    version: 3,
    status: 'Active',
    regulatoryRef: 'Superannuation Guarantee (Administration) Act 1992',
    approvedBy: 'AU Finance Controller',
    lastModified: '2025-02-01',
    notes: '11.5% from 1 Jul 2025, increasing to 12% from 1 Jul 2025 (v3 pre-staged).',
  },
  {
    id: 'CBR-AU-002',
    countryCode: 'AU',
    categoryId: 'BEN-STAT',
    name: 'Payroll Tax (State Average)',
    type: 'statutory',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.0485,
    minAmountMonthly: null,
    maxBaseMonthly: null,
    maxAmountMonthly: null,
    tiers: [],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: 'State Payroll Tax Acts',
    approvedBy: 'AU Finance Controller',
    lastModified: '2024-12-01',
    notes: 'Blended rate across NSW (5.45%), VIC (4.85%), QLD (4.75%). Exempt below state thresholds.',
  },
  {
    id: 'CBR-AU-003',
    countryCode: 'AU',
    categoryId: 'BEN-PTO',
    name: 'Annual Leave + Long Service Leave Accrual',
    type: 'statutory',
    contributionSplit: { employer: 100, employee: 0 },
    baseField: 'basePay',
    rate: 0.094,
    minAmountMonthly: null,
    maxAmountMonthly: null,
    maxBaseMonthly: null,
    tiers: [
      { condition: { field: 'yearsOfService', operator: '>=', value: 10 }, rate: 0.107, label: '10+ yrs: LSL accrual' },
    ],
    effectiveDate: '2025-01-01',
    endDate: null,
    version: 1,
    status: 'Active',
    regulatoryRef: 'Fair Work Act 2009 / State LSL Acts',
    approvedBy: 'AU Finance Controller',
    lastModified: '2024-12-01',
    notes: '20 days AL (7.7%) + LSL accrual (~1.67%). LSL typically vests at 7-10yr.',
  },
];

// ─── Helper Functions ───────────────────────────────────────────────────

/**
 * Get all active benefit rules for a given country
 */
export function getRulesForCountry(countryCode) {
  return countryBenefitRules.filter(
    r => r.countryCode === countryCode && r.status === 'Active'
  );
}

/**
 * Get rules grouped by country
 */
export function getRulesGroupedByCountry() {
  const groups = {};
  for (const rule of countryBenefitRules) {
    if (!groups[rule.countryCode]) groups[rule.countryCode] = [];
    groups[rule.countryCode].push(rule);
  }
  return groups;
}

/**
 * Calculate the applicable rate for an employee, considering tier conditions.
 * Returns the highest matching tier rate, or the base rate if no tiers match.
 */
export function getApplicableRate(rule, employee, asOfDate = null) {
  if (rule.status !== 'Active') return 0;
  if (asOfDate && rule.effectiveDate > asOfDate) return 0;
  if (asOfDate && rule.endDate && rule.endDate < asOfDate) return 0;

  let rate = rule.rate;

  // Evaluate tiers — highest matching rate wins
  if (rule.tiers && rule.tiers.length > 0) {
    for (const tier of rule.tiers) {
      if (evaluateCondition(tier.condition, employee)) {
        rate = Math.max(rate, tier.rate);
      }
    }
  }

  return rate;
}

/**
 * Calculate the employer's monthly benefit cost for one employee under one rule.
 * Applies: rate × min(base, maxBase) → clamp to [min, max] → employer split
 */
export function calculateRuleCost(rule, monthlyBase, employee) {
  const rate = getApplicableRate(rule, employee);
  if (rate === 0) return { employer: 0, employee: 0, total: 0, rate, appliedBase: 0 };

  // Apply base cap
  let appliedBase = monthlyBase;
  if (rule.maxBaseMonthly !== null) {
    appliedBase = Math.min(monthlyBase, rule.maxBaseMonthly);
  }

  let totalAmount = Math.round(appliedBase * rate);

  // Apply min/max amount caps
  if (rule.minAmountMonthly !== null) {
    totalAmount = Math.max(totalAmount, rule.minAmountMonthly);
  }
  if (rule.maxAmountMonthly !== null) {
    totalAmount = Math.min(totalAmount, rule.maxAmountMonthly);
  }

  const employerShare = Math.round(totalAmount * (rule.contributionSplit.employer / 100));
  const employeeShare = totalAmount - employerShare;

  return {
    employer: employerShare,
    employee: employeeShare,
    total: totalAmount,
    rate,
    appliedBase: Math.round(appliedBase),
  };
}

/**
 * Calculate all benefit costs for an employee based on their country's rules
 */
export function calculateAllBenefits(employee, monthlyBaseUSD) {
  const rules = getRulesForCountry(employee.countryCode);
  const results = [];
  let totalEmployerCost = 0;
  let totalEmployeeCost = 0;

  for (const rule of rules) {
    const cost = calculateRuleCost(rule, monthlyBaseUSD, employee);
    results.push({
      ruleId: rule.id,
      ruleName: rule.name,
      categoryId: rule.categoryId,
      type: rule.type,
      ...cost,
    });
    totalEmployerCost += cost.employer;
    totalEmployeeCost += cost.employee;
  }

  return {
    details: results,
    totalEmployerCost,
    totalEmployeeCost,
    totalCost: totalEmployerCost + totalEmployeeCost,
  };
}

/**
 * Evaluate a conditional tier against an employee's attributes
 */
function evaluateCondition(condition, employee) {
  if (!condition) return true;

  const { field, operator, value } = condition;
  let empValue;

  switch (field) {
    case 'yearsOfService': {
      const start = new Date(employee.startDate);
      const now = new Date('2026-03-01');
      empValue = (now - start) / (365.25 * 24 * 60 * 60 * 1000);
      break;
    }
    case 'jobLevel':
      empValue = employee.jobLevel;
      break;
    case 'jobFamily':
      empValue = employee.jobFamily;
      break;
    case 'costCenterId':
      empValue = employee.costCenterId;
      break;
    case 'companyCodeId':
      empValue = employee.companyCodeId;
      break;
    case 'employeeAge':
      empValue = 35; // Default placeholder for demo
      break;
    default:
      return false;
  }

  switch (operator) {
    case '>=': return empValue >= value;
    case '<=': return empValue <= value;
    case '>': return empValue > value;
    case '<': return empValue < value;
    case '==': return empValue === value;
    case '!=': return empValue !== value;
    default: return false;
  }
}

/**
 * Summary statistics for a country's benefit rules
 */
export function getCountryBenefitSummary(countryCode) {
  const rules = getRulesForCountry(countryCode);
  const statutory = rules.filter(r => r.type === 'statutory');
  const sponsored = rules.filter(r => r.type === 'employer-sponsored');

  return {
    countryCode,
    totalRules: rules.length,
    statutoryCount: statutory.length,
    sponsoredCount: sponsored.length,
    totalStatutoryRate: statutory.reduce((s, r) => s + r.rate, 0),
    totalSponsoredRate: sponsored.reduce((s, r) => s + r.rate, 0),
    totalRate: rules.reduce((s, r) => s + r.rate, 0),
    rulesWithTiers: rules.filter(r => r.tiers && r.tiers.length > 0).length,
    rulesWithCaps: rules.filter(r => r.maxAmountMonthly || r.maxBaseMonthly).length,
  };
}
