import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  BookOpen,
  Info,
  CheckCircle,
  Users,
  Clock,
  DollarSign,
  Building2,
  Sliders,
  ArrowRight,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  Layers,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

/* ───────────────────────────────────────────────────────────
   Overhead Allocation Policies — read-only reference page.
   Shows how the ERP allocates overhead costs to employees
   and cost centers. No CRUD — allocations happen upstream.
   ─────────────────────────────────────────────────────────── */

const METHOD_META = {
  headcount: {
    label: 'Headcount (Equal Split)',
    icon: Users,
    color: 'blue',
    plainEnglish: 'Split the bill equally — every employee pays the same share.',
    formula: 'Employee Share = Total Pool ÷ Headcount',
    description:
      'Overhead costs are divided equally among all active employees in the allocation scope. Each employee receives the same share regardless of role, salary, or hours worked.',
    example:
      'A $120,000 IT support pool across 400 employees = $300 per employee per period.',
    bestFor: 'Shared services where usage is roughly uniform — IT help desk, HR admin, general office supplies.',
  },
  'labor-hour': {
    label: 'Labor Hour (Pay-as-you-use)',
    icon: Clock,
    color: 'emerald',
    plainEnglish: 'The more hours you work, the bigger your share of the cost.',
    formula: 'Employee Share = (Employee Hours ÷ Total Hours) × Total Pool',
    description:
      'Costs are allocated proportionally to each employee\'s productive labor hours. Employees who work more hours absorb a larger share of the overhead.',
    example:
      'An employee logging 180 hrs in a month when total dept hours are 9,000 receives 2% of the pool.',
    bestFor: 'Operations, manufacturing support, or any overhead that scales with utilization.',
  },
  'percent-of-payroll': {
    label: 'Percent of Payroll (Salary-based)',
    icon: DollarSign,
    color: 'violet',
    plainEnglish: 'Higher salaries pay a larger share — costs scale with what people earn.',
    formula: 'Employee Share = (Employee Salary ÷ Total Payroll) × Total Pool',
    description:
      'Costs are distributed in proportion to each employee\'s base salary as a fraction of total payroll. Higher-paid employees absorb more overhead.',
    example:
      'An employee earning $10,000/mo when total payroll is $2M absorbs 0.5% of the pool.',
    bestFor: 'Payroll taxes, employer-side insurance, retirement matching — costs that naturally correlate with compensation.',
  },
  'cost-center-proportional': {
    label: 'Cost Center Proportional (Two-Step)',
    icon: Building2,
    color: 'amber',
    plainEnglish: 'Bigger teams (by spend) pay a bigger share, then split it inside the team.',
    formula: 'CC Share = (CC Direct Cost ÷ Total Direct Cost) × Total Pool, then split within CC',
    description:
      'The overhead pool is first allocated to cost centers based on each center\'s share of total direct costs, then distributed to employees within each cost center (typically by headcount).',
    example:
      'A cost center with $500K of $5M total direct costs absorbs 10% of the overhead pool.',
    bestFor: 'Facility costs, depreciation, corporate G&A — overheads that should track with operational scale.',
  },
  custom: {
    label: 'Custom Formula',
    icon: Sliders,
    color: 'rose',
    plainEnglish: 'A special rule set up by Finance for unusual cases (regulatory, executive, etc.).',
    formula: 'Defined per rule — see ERP configuration',
    description:
      'A bespoke allocation formula configured in the ERP. These are typically used for one-off or regulatory-specific allocations that don\'t fit standard methods.',
    example:
      'A regulatory compliance overhead allocated 60% to the US entity and 40% to the EU entity based on a board-approved split.',
    bestFor: 'Regulatory, inter-company, or executive-mandated distributions.',
  },
};

const COLOR_MAP = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-800', dot: 'bg-violet-500' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-800', dot: 'bg-rose-500' },
};

export default function AllocationRules() {
  const { allocationRules, overheadCategories } = useApp();
  const [expandedMethod, setExpandedMethod] = useState(null);
  const [expandedPolicy, setExpandedPolicy] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  // Fallback policies (mirrors what generateAllocationRules produces)
  const defaultPolicies = [
    {
      id: 1,
      name: 'IT Infrastructure Allocation',
      costCategory: 'IT Support',
      method: 'labor-hour',
      description: 'IT infrastructure costs are allocated based on productive labor hours logged per employee. Departments with higher utilization absorb a proportionally larger share of IT overhead.',
      effectiveDate: '2024-01-15',
      endDate: null,
      status: 'Active',
      version: 3,
      approvedBy: 'Sarah Johnson',
      createdAt: '2023-10-01',
      source: 'SAP ERP — Cost Center Accounting (CO-CCA)',
    },
    {
      id: 2,
      name: 'HR Services Distribution',
      costCategory: 'HR Services',
      method: 'headcount',
      description: 'HR administrative costs are divided equally across all active headcount. Each employee receives the same allocation regardless of seniority or department.',
      effectiveDate: '2024-02-01',
      endDate: null,
      status: 'Active',
      version: 2,
      approvedBy: 'Sarah Johnson',
      createdAt: '2023-11-15',
      source: 'SAP ERP — Cost Center Accounting (CO-CCA)',
    },
    {
      id: 3,
      name: 'Facility Cost Distribution',
      costCategory: 'Facilities',
      method: 'cost-center-proportional',
      description: 'Facility expenses (rent, utilities, maintenance) are allocated to cost centers in proportion to their share of total direct costs, then distributed within each cost center by headcount.',
      effectiveDate: '2024-03-01',
      endDate: null,
      status: 'Active',
      version: 1,
      approvedBy: 'Michael Chen',
      createdAt: '2024-02-01',
      source: 'SAP ERP — Real Estate Management',
    },
    {
      id: 4,
      name: 'Payroll Tax Allocation',
      costCategory: 'Payroll Taxes',
      method: 'percent-of-payroll',
      description: 'Employer-side payroll taxes are allocated as a percentage of each employee\'s gross compensation. Higher-paid employees absorb a proportionally larger share.',
      effectiveDate: '2024-01-01',
      endDate: null,
      status: 'Active',
      version: 2,
      approvedBy: 'Sarah Johnson',
      createdAt: '2023-09-01',
      source: 'ADP Payroll → SAP Interface',
    },
    {
      id: 5,
      name: 'Depreciation Allocation',
      costCategory: 'Depreciation',
      method: 'cost-center-proportional',
      description: 'Asset depreciation is allocated to cost centers based on asset assignment records in the ERP fixed-asset module, then distributed to employees within each cost center.',
      effectiveDate: '2024-01-01',
      endDate: null,
      status: 'Active',
      version: 1,
      approvedBy: 'Michael Chen',
      createdAt: '2023-12-01',
      source: 'SAP ERP — Asset Accounting (FI-AA)',
    },
    {
      id: 6,
      name: 'Corporate G&A Allocation',
      costCategory: 'Corporate G&A',
      method: 'headcount',
      description: 'Corporate general & administrative overhead (executive office, legal, finance) is spread evenly across all active employees as a flat per-head charge.',
      effectiveDate: '2024-01-01',
      endDate: null,
      status: 'Active',
      version: 3,
      approvedBy: 'Sarah Johnson',
      createdAt: '2023-08-15',
      source: 'SAP ERP — Profit Center Accounting',
    },
    {
      id: 7,
      name: 'Shared Services Allocation',
      costCategory: 'Shared Services',
      method: 'custom',
      description: 'Regional shared-service center costs are allocated using a blended formula: 50% headcount, 30% labor hours, 20% revenue contribution. This was mandated by the CFO for FY2024.',
      effectiveDate: '2024-01-01',
      endDate: null,
      status: 'Active',
      version: 1,
      approvedBy: 'CFO Office',
      createdAt: '2023-12-15',
      source: 'SAP ERP — Custom Allocation Cycle',
    },
  ];

  const policies = allocationRules && allocationRules.length > 0 ? allocationRules : defaultPolicies;

  // Sort policies
  const sortedPolicies = useMemo(() => {
    return [...policies].sort((a, b) => {
      const aVal = a[sortConfig.key] || '';
      const bVal = b[sortConfig.key] || '';
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [policies, sortConfig]);

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  // Stats
  const stats = useMemo(() => {
    const byMethod = {};
    policies.forEach((p) => {
      const m = p.method;
      byMethod[m] = (byMethod[m] || 0) + 1;
    });
    const active = policies.filter((p) => p.status === 'Active').length;
    const categories = new Set(policies.map((p) => p.costCategory)).size;
    return { total: policies.length, active, categories, byMethod };
  }, [policies]);

  const getMethodMeta = (method) => METHOD_META[method] || METHOD_META.custom;
  const getColors = (method) => COLOR_MAP[getMethodMeta(method).color] || COLOR_MAP.blue;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start gap-4 mb-3">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <BookOpen size={28} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-slate-900">Overhead Allocation Policies</h1>
              <p className="text-lg text-slate-600 mt-1">
                Understand how shared company costs (rent, IT, HR, G&A) get assigned to each employee in your burden rate.
              </p>
            </div>
          </div>
        </div>

        {/* ─── What is overhead allocation? (plain-English explainer) ─── */}
        <div className="mb-8 bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <HelpCircle size={20} className="text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">What is overhead allocation?</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">1</div>
                <h3 className="font-semibold text-slate-900">Costs are pooled</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Shared expenses your company pays — like office rent, IT systems, HR, and corporate G&A — are grouped into <strong>cost pools</strong> in the ERP.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">2</div>
                <h3 className="font-semibold text-slate-900">A method splits the pool</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Each pool follows an <strong>allocation method</strong> (a fairness rule) to decide how much of it lands on each employee — by headcount, hours worked, salary, or cost center.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">3</div>
                <h3 className="font-semibold text-slate-900">It rolls into burden</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Each employee's allocated overhead is added to their direct salary and benefits to produce their <strong>true cost-to-company</strong> — the burden rate you see in reports.
              </p>
            </div>
          </div>
          <div className="px-6 py-3 bg-amber-50 border-t border-amber-200 flex items-start gap-2">
            <Lightbulb size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900">
              <strong>Why this matters:</strong> Two engineers with the same salary can have very different burden rates depending on which cost center they belong to and which allocation methods apply.
              This page shows you the rules behind those numbers so you can explain them with confidence.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800">
          <Info size={16} className="flex-shrink-0" />
          <span>
            <strong>Read-only view.</strong> Allocation rules are configured and executed in the ERP system.
            This page is a transparency layer — to change a rule, contact your Finance/Controlling team.
          </span>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-indigo-500">
            <p className="text-slate-500 text-sm font-medium mb-1">Total Policies</p>
            <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <p className="text-slate-500 text-sm font-medium mb-1">Active</p>
            <p className="text-3xl font-bold text-slate-900">{stats.active}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-amber-500">
            <p className="text-slate-500 text-sm font-medium mb-1">Cost Categories Covered</p>
            <p className="text-3xl font-bold text-slate-900">{stats.categories}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-slate-400">
            <p className="text-slate-500 text-sm font-medium mb-1">Allocation Methods Used</p>
            <p className="text-3xl font-bold text-slate-900">{Object.keys(stats.byMethod).length}</p>
          </div>
        </div>

        {/* ─── Allocation Methods Reference ─── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Layers size={20} className="text-indigo-600" />
              The 5 Allocation Methods
            </h2>
            <span className="text-xs text-slate-500">Click any card to see the formula and an example</span>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            These are the "fairness rules" your ERP uses to decide how a shared cost gets split across employees. Each method answers the same question — <em>how should we divide this bill?</em> — in a different way.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.entries(METHOD_META).map(([key, meta]) => {
              const colors = COLOR_MAP[meta.color];
              const Icon = meta.icon;
              const isOpen = expandedMethod === key;
              const count = stats.byMethod[key] || 0;
              return (
                <div
                  key={key}
                  className={`bg-white rounded-lg shadow-md border ${isOpen ? colors.border : 'border-transparent'} overflow-hidden transition-all duration-200`}
                >
                  <button
                    onClick={() => setExpandedMethod(isOpen ? null : key)}
                    className="w-full px-5 py-4 flex items-start gap-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className={`p-2 rounded-lg ${colors.bg} flex-shrink-0`}>
                      <Icon size={20} className={colors.text} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900">{meta.label}</div>
                      <p className="text-xs text-slate-600 mt-1 leading-snug italic">
                        "{meta.plainEnglish}"
                      </p>
                      <div className="text-xs text-slate-400 mt-2">
                        {count} {count === 1 ? 'policy' : 'policies'} use this method
                      </div>
                    </div>
                    {isOpen ? <ChevronUp size={18} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={18} className="text-slate-400 flex-shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className={`px-5 pb-5 pt-3 border-t ${colors.border} ${colors.bg}`}>
                      <div className="mb-3">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">How it works</div>
                        <p className="text-sm text-slate-700 leading-relaxed">{meta.description}</p>
                      </div>
                      <div className="space-y-2.5">
                        <div className="text-xs">
                          <div className="font-bold text-slate-500 uppercase tracking-wide mb-1">The math</div>
                          <code className="block bg-white/90 px-3 py-2 rounded text-slate-800 border border-slate-200">{meta.formula}</code>
                        </div>
                        <div className="text-xs">
                          <div className="font-bold text-slate-500 uppercase tracking-wide mb-1">A real example</div>
                          <p className="text-slate-700 bg-white/60 px-3 py-2 rounded border border-slate-200">{meta.example}</p>
                        </div>
                        <div className="text-xs">
                          <div className="font-bold text-slate-500 uppercase tracking-wide mb-1">When to use it</div>
                          <p className="text-slate-700">{meta.bestFor}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Active Policies ─── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle size={20} className="text-green-600" />
              Active Policies in Your Company
            </h2>
            <span className="text-xs text-slate-500">Click any row to see full details</span>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            These are the actual rules currently running against your overhead costs. Each policy ties one cost category (like "Facilities" or "Payroll Taxes") to one of the methods above.
          </p>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left">
                      <button onClick={() => handleSort('name')} className="flex items-center gap-1 font-semibold text-slate-700 hover:text-indigo-600 transition-colors text-sm">
                        Policy Name
                        {sortConfig.key === 'name' && <span className="text-indigo-500">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <button onClick={() => handleSort('costCategory')} className="flex items-center gap-1 font-semibold text-slate-700 hover:text-indigo-600 transition-colors text-sm">
                        Overhead Category
                        {sortConfig.key === 'costCategory' && <span className="text-indigo-500">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-700 text-sm">Method</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-700 text-sm">Effective Since</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-700 text-sm">Version</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-700 text-sm">Approved By</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPolicies.length > 0 ? (
                    sortedPolicies.map((policy) => {
                      const meta = getMethodMeta(policy.method);
                      const colors = getColors(policy.method);
                      const isOpen = expandedPolicy === policy.id;
                      return (
                        <React.Fragment key={policy.id}>
                          <tr
                            className={`border-b border-slate-100 hover:bg-slate-50/70 transition-colors cursor-pointer ${isOpen ? 'bg-slate-50' : ''}`}
                            onClick={() => setExpandedPolicy(isOpen ? null : policy.id)}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                <span className="font-medium text-slate-900">{policy.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600 text-sm">{policy.costCategory}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${colors.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                                {meta.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600 text-sm">{policy.effectiveDate}</td>
                            <td className="px-6 py-4">
                              <span className="inline-block bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-1 rounded">
                                v{policy.version}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600 text-sm">
                              {policy.approvedBy ? (
                                <div className="flex items-center gap-1.5">
                                  <CheckCircle size={14} className="text-green-500" />
                                  {policy.approvedBy}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>
                          </tr>

                          {/* Expanded Detail */}
                          {isOpen && (
                            <tr className="border-b border-slate-200">
                              <td colSpan="6" className="px-6 py-5 bg-slate-50/80">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                  {/* Description */}
                                  <div className="md:col-span-2">
                                    <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Description</h5>
                                    <p className="text-sm text-slate-700 leading-relaxed">{policy.description}</p>
                                  </div>

                                  {/* Metadata */}
                                  <div>
                                    <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Details</h5>
                                    <div className="space-y-2 text-sm text-slate-600">
                                      {policy.source && (
                                        <div className="flex items-start gap-2">
                                          <ExternalLink size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                          <span><span className="font-medium text-slate-700">Source:</span> {policy.source}</span>
                                        </div>
                                      )}
                                      <div className="flex items-start gap-2">
                                        <Clock size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                        <span><span className="font-medium text-slate-700">Created:</span> {policy.createdAt}{policy.createdBy ? ` by ${policy.createdBy}` : ''}</span>
                                      </div>
                                      {policy.endDate && (
                                        <div className="flex items-start gap-2">
                                          <Clock size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                          <span><span className="font-medium text-slate-700">End Date:</span> {policy.endDate}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* How it flows */}
                                <div className="mt-4 pt-4 border-t border-slate-200">
                                  <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Allocation Flow</h5>
                                  <div className="flex items-center gap-2 text-sm text-slate-600 flex-wrap">
                                    <span className="px-3 py-1 bg-white rounded-md border border-slate-200 font-medium">ERP Cost Pool</span>
                                    <ArrowRight size={16} className="text-slate-400" />
                                    <span className={`px-3 py-1 rounded-md border font-medium ${colors.bg} ${colors.border} ${colors.text}`}>
                                      {meta.label} Method
                                    </span>
                                    <ArrowRight size={16} className="text-slate-400" />
                                    <span className="px-3 py-1 bg-white rounded-md border border-slate-200 font-medium">Employee Burden</span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                        <BookOpen size={40} className="mx-auto mb-3 text-slate-300" />
                        <p className="text-lg font-medium mb-1">No allocation policies loaded</p>
                        <p className="text-sm">Policies will appear here once overhead cost data is imported from the ERP.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="bg-white rounded-lg shadow-md p-5 border border-slate-200">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-700">How to update allocation policies:</span>{' '}
              Overhead allocation rules are maintained in the ERP system (e.g., SAP CO-CCA allocation cycles, Oracle GL allocation rules).
              Changes made in the ERP will be reflected here after the next data feed. Contact your Finance/Controlling team
              to request policy modifications.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
