import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Users,
  Database,
  AlertCircle,
  CheckCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BarChart3,
  PieChart as PieChartIcon,
  Download,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatUSD, getCurrencyInfo, formatLocalCurrencyFull } from '../../utils/currency.js';
import FlagIcon from '../FlagIcon';

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];
const TAB_COLORS = { direct: '#3b82f6', benefits: '#10b981', overheads: '#f59e0b' };

const fmt = (v) => formatUSD(v);
const fmtExact = (v) => (v == null ? '$0' : `$${Math.round(v).toLocaleString()}`);

// ─── Summary Card ───
const SummaryCard = ({ title, value, change, icon: Icon, color }) => (
  <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
    <div className="flex items-start justify-between mb-4">
      <div>
        <p className="text-sm text-gray-600 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      </div>
      <div className={`p-3 rounded-lg text-white ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
    <span className={`text-xs font-medium ${change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
      {change >= 0 ? '+' : ''}{change.toFixed(1)}% vs prior
    </span>
  </div>
);

// ─── Integration Status ───
const IntegrationStatusItem = ({ name, status, lastSync }) => {
  const cfg = {
    connected: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Connected' },
    warning:   { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Warning' },
    offline:   { icon: AlertCircle, color: 'text-red-600',   bg: 'bg-red-50',   label: 'Offline' },
  }[status] || { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Offline' };
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border border-gray-200 ${cfg.bg}`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${cfg.color}`} />
        <div>
          <p className="text-sm font-medium text-gray-900">{name}</p>
          <p className="text-xs text-gray-600">{lastSync}</p>
        </div>
      </div>
      <span className={`text-xs font-medium px-3 py-1 rounded-full ${cfg.color} bg-white border`}>
        {cfg.label}
      </span>
    </div>
  );
};

// ─── Unified Cost Tab ───
// Each tab uses the same layout:
//   1. Category summary cards (top row)
//   2. Distribution chart (pie + bar side by side)
//   3. Searchable, paginated employee table with per-category columns
function UnifiedCostTab({
  costData,
  employees,
  categories,
  extractCategories,
  extractTotal,
  accentColor,
  typeLabel,
  currencyInfo,      // { symbol, fxFromUSD, currency }
  showEmployeeDetail = true,
}) {
  const fx = currencyInfo?.fxFromUSD || 1;
  const sym = currencyInfo?.symbol || '$';
  const fmtL = (v) => `${sym}${Math.round((v || 0) * fx).toLocaleString()}`;
  const fmtLShort = (v) => {
    const local = (v || 0) * fx;
    if (local >= 1_000_000) return `${sym}${(local / 1_000_000).toFixed(1)}M`;
    if (local >= 1_000) return `${sym}${(local / 1_000).toFixed(1)}K`;
    return `${sym}${Math.round(local)}`;
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState('total');
  const [sortDir, setSortDir] = useState('desc');
  const [chartType, setChartType] = useState('pie');
  const pageSize = 20;

  const employeeMap = useMemo(() => {
    const map = {};
    for (const emp of employees) map[emp.id] = emp;
    return map;
  }, [employees]);

  // Aggregate by category (for summary cards + chart)
  const categoryTotals = useMemo(() => {
    const totals = {};
    for (const cat of categories) totals[cat.id] = { id: cat.id, name: cat.name, total: 0 };
    for (const cost of costData) {
      const cats = extractCategories(cost);
      for (const [catId, amount] of Object.entries(cats)) {
        if (totals[catId]) totals[catId].total += (typeof amount === 'number' ? amount : 0);
      }
    }
    return Object.values(totals).sort((a, b) => b.total - a.total);
  }, [costData, categories, extractCategories]);

  const grandTotal = categoryTotals.reduce((s, c) => s + c.total, 0);

  // Aggregate by employee (for table)
  const employeeCosts = useMemo(() => {
    const map = {};
    for (const cost of costData) {
      if (!map[cost.employeeId]) {
        const emp = employeeMap[cost.employeeId];
        map[cost.employeeId] = {
          employeeId: cost.employeeId,
          name: emp ? emp.fullName : 'Unknown',
          countryCode: emp?.countryCode || 'US',
          total: 0,
          cats: {},
        };
        for (const cat of categories) map[cost.employeeId].cats[cat.id] = 0;
      }
      const entry = map[cost.employeeId];
      entry.total += extractTotal(cost);
      const cats = extractCategories(cost);
      for (const [catId, amount] of Object.entries(cats)) {
        if (entry.cats[catId] !== undefined) entry.cats[catId] += (typeof amount === 'number' ? amount : 0);
      }
    }
    return Object.values(map);
  }, [costData, employeeMap, categories, extractCategories, extractTotal]);

  // Filter
  const filtered = useMemo(() => {
    if (!searchTerm) return employeeCosts;
    const term = searchTerm.toLowerCase();
    return employeeCosts.filter(e =>
      e.name.toLowerCase().includes(term) || e.employeeId.toLowerCase().includes(term)
    );
  }, [employeeCosts, searchTerm]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal, bVal;
      if (sortField === 'name') { aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); }
      else if (sortField === 'id') { aVal = a.employeeId; bVal = b.employeeId; }
      else if (sortField === 'total') { aVal = a.total; bVal = b.total; }
      else { aVal = a.cats[sortField] || 0; bVal = b.cats[sortField] || 0; }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="w-4 h-4 inline-block" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 inline-block" />
      : <ChevronDown className="w-3.5 h-3.5 inline-block" />;
  };

  // Shorten category names for display
  const shortName = (name) => {
    if (name.length <= 18) return name;
    // Take first part before '&', '/', or '('
    const short = name.split(/[&/(]/)[0].trim();
    return short.length > 18 ? short.slice(0, 16) + '...' : short;
  };

  return (
    <div className="space-y-6">
      {/* ─── Category Summary Cards ─── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {typeLabel} by Category
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {categoryTotals.map((cat, i) => {
            const pct = grandTotal > 0 ? ((cat.total / grandTotal) * 100).toFixed(1) : '0';
            return (
              <div key={cat.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                  <p className="text-xs text-gray-600 font-medium truncate" title={cat.name}>{cat.name}</p>
                </div>
                <p className="text-lg font-bold text-gray-900">{fmtLShort(cat.total)}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                  </div>
                  <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Distribution Chart ─── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">{typeLabel} Distribution</h3>
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setChartType('pie')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                chartType === 'pie' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              <PieChartIcon className="w-3.5 h-3.5" /> Pie
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                chartType === 'bar' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Bar
            </button>
          </div>
        </div>

        {chartType === 'pie' ? (
          <div className="flex items-center">
            <ResponsiveContainer width="55%" height={260}>
              <PieChart>
                <Pie
                  data={categoryTotals}
                  cx="50%" cy="50%"
                  innerRadius={65} outerRadius={105}
                  paddingAngle={2}
                  dataKey="total"
                  nameKey="name"
                >
                  {categoryTotals.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                  formatter={(v) => [fmtL(v)]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full lg:w-[45%] space-y-2.5 pl-4">
              {categoryTotals.map((cat, i) => {
                const pct = grandTotal > 0 ? ((cat.total / grandTotal) * 100).toFixed(1) : 0;
                return (
                  <div key={cat.id} className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                    <span className="text-sm text-gray-700 flex-1 truncate">{cat.name}</span>
                    <span className="text-sm font-medium text-gray-900 w-20 text-right">{fmtLShort(cat.total)}</span>
                    <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-gray-200">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-bold text-gray-900 flex-1">Total</span>
                  <span className="text-sm font-bold text-gray-900">{fmtLShort(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryTotals} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                height={70}
                tickFormatter={shortName}
              />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={fmtLShort} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                formatter={(v) => [fmtL(v)]}
              />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} name={typeLabel}>
                {categoryTotals.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ─── Employee Detail Table ─── */}
      {showEmployeeDetail && (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Employee {typeLabel} Detail</h3>
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 w-72">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('id')} className="flex items-center gap-1 font-semibold text-gray-600 hover:text-gray-900">
                    ID <SortIcon field="id" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('name')} className="flex items-center gap-1 font-semibold text-gray-600 hover:text-gray-900">
                    Employee <SortIcon field="name" />
                  </button>
                </th>
                {categories.map((cat, i) => (
                  <th key={cat.id} className="px-3 py-3 text-right">
                    <button onClick={() => handleSort(cat.id)} className="flex items-center gap-1 ml-auto font-semibold text-gray-600 hover:text-gray-900">
                      <span className="truncate max-w-[100px]" title={cat.name}>{shortName(cat.name)}</span>
                      <SortIcon field={cat.id} />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 text-right">
                  <button onClick={() => handleSort('total')} className="flex items-center gap-1 ml-auto font-semibold text-gray-600 hover:text-gray-900">
                    Total <SortIcon field="total" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paged.map((emp, idx) => (
                <tr key={emp.employeeId} className={`hover:bg-blue-50/50 ${idx % 2 !== 0 ? 'bg-gray-50/30' : ''}`}>
                  <td className="px-4 py-2.5 font-medium text-blue-600 font-mono text-xs">{emp.employeeId}</td>
                  <td className="px-4 py-2.5 text-gray-900 font-medium">{emp.name}</td>
                  {categories.map((cat) => (
                    <td key={cat.id} className="px-3 py-2.5 text-right font-mono text-gray-700">
                      {emp.cats[cat.id] > 0 ? fmtL(emp.cats[cat.id]) : <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right font-mono font-semibold" style={{ color: accentColor }}>
                    {fmtL(emp.total)}
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={categories.length + 3} className="px-6 py-12 text-center text-gray-400">No results found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Showing {sorted.length === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-2 text-sm font-medium">{page + 1} / {totalPages || 1}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

// ─── Main Component ───
export default function CostIngestion() {
  const { costData, selectedPeriod, employees, overheadCategories, benefitCategories, kpis, periods, companyCodes, countries } = useApp();
  const [activeTab, setActiveTab] = useState('direct');

  // ── Cascading filters: Country (mandatory, default US) → Vertical → Job Family ──
  const [filterCountry, setFilterCountry] = useState('US');
  const [filterCompanyCode, setFilterCompanyCode] = useState('');
  const [filterJobFamily, setFilterJobFamily] = useState('');

  // Distinct countries (from employees)
  const countryOptions = useMemo(() => {
    const set = new Map();
    employees.forEach(e => { if (!set.has(e.countryCode)) set.set(e.countryCode, e.countryName); });
    return Array.from(set.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  // Vertical options scoped to selected country
  const verticalOptions = useMemo(() => {
    if (!filterCountry) return [];
    return (companyCodes || []).filter(cc => cc.countryCode === filterCountry);
  }, [companyCodes, filterCountry]);

  // Job family options scoped to country + vertical
  const jobFamilyOptions = useMemo(() => {
    if (!filterCountry || !filterCompanyCode) return [];
    const families = new Set(
      employees
        .filter(e => e.countryCode === filterCountry && e.companyCodeId === filterCompanyCode)
        .map(e => e.jobFamily)
    );
    return Array.from(families).sort();
  }, [employees, filterCountry, filterCompanyCode]);

  const handleCountryChange = (val) => {
    if (!val) return; // country is mandatory
    setFilterCountry(val);
    setFilterCompanyCode('');
    setFilterJobFamily('');
  };
  const currencyInfo = useMemo(() => getCurrencyInfo(filterCountry), [filterCountry]);
  const handleVerticalChange = (val) => {
    setFilterCompanyCode(val);
    setFilterJobFamily('');
  };
  const clearFilters = () => { setFilterCompanyCode(''); setFilterJobFamily(''); };
  const hasFilters = true; // country is always set

  // Build the filtered employee set
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      if (filterCountry && e.countryCode !== filterCountry) return false;
      if (filterCompanyCode && e.companyCodeId !== filterCompanyCode) return false;
      if (filterJobFamily && e.jobFamily !== filterJobFamily) return false;
      return true;
    });
  }, [employees, filterCountry, filterCompanyCode, filterJobFamily]);

  const filteredEmployeeIds = useMemo(() => new Set(filteredEmployees.map(e => e.id)), [filteredEmployees]);

  // Period costs — also restricted to filtered employees
  const periodCosts = useMemo(() => {
    return costData.filter(c => c.period === selectedPeriod && (!hasFilters || filteredEmployeeIds.has(c.employeeId)));
  }, [costData, selectedPeriod, filteredEmployeeIds, hasFilters]);

  // Filtered KPI totals (USD aggregates restricted to filtered employees)
  const filteredKpis = useMemo(() => {
    let d = 0, b = 0, o = 0;
    for (const c of periodCosts) {
      d += c.direct.total; b += c.benefits.total; o += c.overhead.total;
    }
    return { totalDirect: d, totalBenefits: b, totalOverhead: o };
  }, [periodCosts]);

  // Prior period change %
  const priorPeriodIdx = periods.indexOf(selectedPeriod) - 1;
  let directChange = 0, benefitsChange = 0, overheadChange = 0;
  if (priorPeriodIdx >= 0) {
    const priorPeriod = periods[priorPeriodIdx];
    const priorCosts = costData.filter(c => priorPeriod === c.period && filteredEmployeeIds.has(c.employeeId));
    const priorDirect = priorCosts.reduce((s, c) => s + c.direct.total, 0);
    const priorBenefits = priorCosts.reduce((s, c) => s + c.benefits.total, 0);
    const priorOverhead = priorCosts.reduce((s, c) => s + c.overhead.total, 0);
    directChange = priorDirect > 0 ? ((filteredKpis.totalDirect - priorDirect) / priorDirect) * 100 : 0;
    benefitsChange = priorBenefits > 0 ? ((filteredKpis.totalBenefits - priorBenefits) / priorBenefits) * 100 : 0;
    overheadChange = priorOverhead > 0 ? ((filteredKpis.totalOverhead - priorOverhead) / priorOverhead) * 100 : 0;
  }

  // Helper: format USD value into the selected country's local currency
  const fmtLocal = (v) => `${currencyInfo.symbol}${Math.round((v || 0) * currencyInfo.fxFromUSD).toLocaleString()}`;

  // Direct cost "categories" — payroll, bonus, shift diff, overtime
  const directCategories = [
    { id: 'payroll',          name: 'Payroll' },
    { id: 'bonus',            name: 'Bonus' },
    { id: 'shiftDifferential', name: 'Shift Differential' },
    { id: 'overtime',         name: 'Overtime' },
  ];

  const tabs = [
    { id: 'direct',    label: 'Direct Costs', color: 'blue' },
    { id: 'benefits',  label: 'Benefits',     color: 'green' },
    { id: 'overheads', label: 'Overheads',    color: 'amber' },
  ];

  const tabBorderColors = {
    direct: 'border-blue-600 text-blue-600',
    benefits: 'border-green-600 text-green-600',
    overheads: 'border-amber-600 text-amber-600',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cost Ingestion & Management</h1>
        <p className="text-gray-600 mt-2">Period: <span className="font-semibold text-gray-800">{selectedPeriod}</span> — View and validate cost data by category</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
            <select
              value={filterCountry}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {countryOptions.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Vertical</label>
            <select
              value={filterCompanyCode}
              onChange={(e) => handleVerticalChange(e.target.value)}
              disabled={!filterCountry}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <option value="">{filterCountry ? 'All Verticals' : 'Select country first'}</option>
              {verticalOptions.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Job Family</label>
            <select
              value={filterJobFamily}
              onChange={(e) => setFilterJobFamily(e.target.value)}
              disabled={!filterCountry || !filterCompanyCode}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <option value="">{filterCompanyCode ? 'All Job Families' : 'Select vertical first'}</option>
              {jobFamilyOptions.map(jf => (
                <option key={jf} value={jf}>{jf}</option>
              ))}
            </select>
          </div>
          {(filterCompanyCode || filterJobFamily) && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Clear
            </button>
          )}
          <div className="text-sm text-gray-600 ml-2 flex items-center gap-2">
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded font-medium">
              Currency: {currencyInfo.currency} ({currencyInfo.symbol})
            </span>
          </div>
          <div className="text-sm text-gray-600 ml-auto">
            <span className="font-semibold text-gray-900">{filteredEmployees.length}</span> of {employees.length} employees
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard title="Total Direct Costs" value={fmtLocal(filteredKpis.totalDirect)} change={directChange} icon={DollarSign} color="bg-blue-600" />
        <SummaryCard title="Total Benefits Costs" value={fmtLocal(filteredKpis.totalBenefits)} change={benefitsChange} icon={Users} color="bg-green-600" />
        <SummaryCard title="Total Overhead Costs" value={fmtLocal(filteredKpis.totalOverhead)} change={overheadChange} icon={TrendingUp} color="bg-amber-600" />
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-4 px-6 text-center font-medium border-b-2 transition-colors ${
                activeTab === tab.id ? tabBorderColors[tab.id] : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'direct' && (
            <UnifiedCostTab
              costData={periodCosts}
              employees={filteredEmployees}
              currencyInfo={currencyInfo}
              categories={directCategories}
              extractCategories={(c) => c.direct}
              extractTotal={(c) => c.direct.total}
              accentColor={TAB_COLORS.direct}
              typeLabel="Direct Costs"
              showEmployeeDetail={false}
            />
          )}
          {activeTab === 'benefits' && (
            <UnifiedCostTab
              costData={periodCosts}
              employees={filteredEmployees}
              currencyInfo={currencyInfo}
              categories={benefitCategories}
              extractCategories={(c) => {
                const obj = {};
                for (const cat of benefitCategories) {
                  obj[cat.id] = c.benefits[cat.id] || 0;
                }
                return obj;
              }}
              extractTotal={(c) => c.benefits.total}
              accentColor={TAB_COLORS.benefits}
              typeLabel="Benefits"
            />
          )}
          {activeTab === 'overheads' && (
            <UnifiedCostTab
              costData={periodCosts}
              employees={filteredEmployees}
              currencyInfo={currencyInfo}
              categories={overheadCategories}
              extractCategories={(c) => {
                const obj = {};
                for (const cat of overheadCategories) {
                  obj[cat.id] = c.overhead[cat.id] || 0;
                }
                return obj;
              }}
              extractTotal={(c) => c.overhead.total}
              accentColor={TAB_COLORS.overheads}
              typeLabel="Overhead"
            />
          )}
        </div>
      </div>

    </div>
  );
}
