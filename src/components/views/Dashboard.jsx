import React, { useMemo, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
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
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Users,
  DollarSign,
  Zap,
  ArrowUp,
  ArrowDown,
  Globe,
  ChevronRight,
  BarChart3,
  Table,
  Clock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import FlagIcon from '../FlagIcon';
import {
  formatUSD, formatLocalCurrency, formatFxRate, formatFxRateCompact,
  getCurrencyInfo, getFxRateSummary,
} from '../../utils/currency.js';

const COLORS = {
  direct: '#3b82f6',
  benefits: '#10b981',
  overhead: '#f59e0b',
  palette: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'],
};

const formatCurrency = (value) => formatUSD(value);

const formatRate = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '$0.00/hr';
  return `$${parseFloat(value).toFixed(2)}/hr`;
};

const KPICard = ({ title, value, subtitle, change, icon: Icon, iconBgColor }) => {
  const hasChange = change !== null && change !== undefined && !isNaN(change);
  const isPositive = hasChange && change >= 0;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-gray-600 font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${iconBgColor}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {hasChange && (
        <div className="flex items-center gap-1">
          {isPositive ? (
            <ArrowUp className="w-4 h-4 text-red-600" />
          ) : (
            <ArrowDown className="w-4 h-4 text-green-600" />
          )}
          <span className={`text-sm font-medium ${isPositive ? 'text-red-600' : 'text-green-600'}`}>
            {change > 0 ? '+' : ''}{change.toFixed(2)}/hr vs prior period
          </span>
        </div>
      )}
    </div>
  );
};

const COUNTRY_NAME = { US: 'USA', IN: 'India', GB: 'UK', DE: 'Germany', JP: 'Japan', AU: 'Australia', SG: 'Singapore', BR: 'Brazil' };
const getCountryName = (code) => COUNTRY_NAME[code] || code;

const Dashboard = () => {
  const {
    kpis, periodData, summaryByCompanyCode, summaryByCountry, summaryByJobCode,
    selectedPeriod, aggregateByField, costData, employeeMap, employees
  } = useApp();

  // Lifecycle counts for the selected period
  const lifecycleCounts = useMemo(() => {
    if (!employees) return { onLeave: 0, terminatedThisPeriod: 0 };
    const onLeave = employees.filter(e => e.status === 'On Leave').length;
    const terminatedThisPeriod = employees.filter(e =>
      e.status === 'Terminated' && e.terminationDate && e.terminationDate.startsWith(selectedPeriod)
    ).length;
    return { onLeave, terminatedThisPeriod };
  }, [employees, selectedPeriod]);

  const [countryView, setCountryView] = useState('chart');
  const [selectedCountry, setSelectedCountry] = useState(null);

  // Year-end markers for the cost trend chart. For each year present in
  // periodData, find the December period and compute the YTD avg burden rate
  // (sum of CTC ÷ sum of productive hours across that year's months).
  const yearEndMarkers = useMemo(() => {
    const data = periodData || [];
    const maxStack = data.reduce(
      (m, r) => Math.max(m, (r.directTotal || 0) + (r.benefitTotal || 0) + (r.overheadTotal || 0)),
      0
    );
    const byYear = {};
    for (const row of data) {
      const year = (row.period || '').slice(0, 4);
      if (!year) continue;
      if (!byYear[year]) byYear[year] = { ctc: 0, hours: 0, decPeriod: null, decStack: 0 };
      byYear[year].ctc += row.totalCostToCompany || 0;
      byYear[year].hours += row.totalHours || 0;
      if ((row.period || '').endsWith('-12')) {
        byYear[year].decPeriod = row.period;
        byYear[year].decStack =
          (row.directTotal || 0) + (row.benefitTotal || 0) + (row.overheadTotal || 0);
      }
    }
    return Object.entries(byYear)
      .filter(([, v]) => v.decPeriod)
      .map(([year, v]) => ({
        year,
        period: v.decPeriod,
        rate: v.hours > 0 ? v.ctc / v.hours : 0,
        // Fraction (0=top of chart, 1=bottom) where the stacked area top sits.
        topFrac: maxStack > 0 ? 1 - v.decStack / maxStack : 0,
      }));
  }, [periodData]);

  // Cost breakdown for pie chart — use kpis which has totals for current period
  const costBreakdownData = [
    { name: 'Direct Costs', value: kpis?.totalDirect || 0, fill: COLORS.direct },
    { name: 'Benefits', value: kpis?.totalBenefits || 0, fill: COLORS.benefits },
    { name: 'Overhead', value: kpis?.totalOverhead || 0, fill: COLORS.overhead },
  ].filter(d => d.value > 0);

  // Top 10 job codes by burden rate
  const topJobCodes = (summaryByJobCode || [])
    .filter(j => j.avgBurdenRate > 0)
    .sort((a, b) => b.avgBurdenRate - a.avgBurdenRate)
    .slice(0, 10);

  // Job code × country breakdown for top job codes
  const { jobCodeCountryData, jobCodeCountries } = useMemo(() => {
    if (!costData || !employeeMap || topJobCodes.length === 0) return { jobCodeCountryData: [], jobCodeCountries: [] };
    const topKeys = new Set(topJobCodes.map(j => j.key));
    const filtered = costData.filter(c => c.period === selectedPeriod);
    const cells = {}; // 'JC-101|US' -> { totalCost, totalHours, emps }
    const countrySet = new Set();

    for (const r of filtered) {
      const emp = employeeMap[r.employeeId];
      if (!emp || !topKeys.has(emp.jobCode)) continue;
      const country = emp.countryCode || 'Unknown';
      countrySet.add(country);
      const key = `${emp.jobCode}|${country}`;
      if (!cells[key]) cells[key] = { jobCode: emp.jobCode, country, totalCost: 0, totalHours: 0, emps: new Set() };
      cells[key].totalCost += r.totalCostToCompany;
      cells[key].totalHours += r.productiveHours;
      cells[key].emps.add(r.employeeId);
    }

    const countries = Array.from(countrySet).sort();
    const data = topJobCodes.map(jc => {
      const row = { key: jc.key, label: jc.label || jc.key, avgBurdenRate: jc.avgBurdenRate, employeeCount: jc.employeeCount };
      countries.forEach(c => {
        const cell = cells[`${jc.key}|${c}`];
        row[c] = cell && cell.totalHours > 0 ? Math.round((cell.totalCost / cell.totalHours) * 100) / 100 : null;
        row[`${c}_count`] = cell ? cell.emps.size : 0;
      });
      return row;
    });

    return { jobCodeCountryData: data, jobCodeCountries: countries };
  }, [costData, employeeMap, selectedPeriod, topJobCodes]);

  // Aggregate by vertical — combine country-specific verticals
  const verticalChartData = useMemo(() => {
    if (!summaryByCompanyCode || summaryByCompanyCode.length === 0) return [];
    const byVertical = {};
    for (const item of summaryByCompanyCode) {
      const vName = item.label || item.key;
      if (!byVertical[vName]) {
        byVertical[vName] = { name: vName, totalCost: 0, totalHours: 0, employeeCount: 0 };
      }
      byVertical[vName].totalCost += item.totalCostToCompany || 0;
      byVertical[vName].totalHours += item.totalHours || 0;
      byVertical[vName].employeeCount += item.employeeCount || 0;
    }
    return Object.values(byVertical).map(v => ({
      ...v,
      avgBurdenRate: v.totalHours > 0 ? Math.round((v.totalCost / v.totalHours) * 100) / 100 : 0,
    })).sort((a, b) => b.avgBurdenRate - a.avgBurdenRate);
  }, [summaryByCompanyCode]);

  // Aggregate burden rate by job family
  const jobFamilyChartData = useMemo(() => {
    const data = aggregateByField('jobFamily', selectedPeriod);
    if (!data || data.length === 0) return [];
    return data
      .filter(d => d.avgBurdenRate > 0)
      .sort((a, b) => b.avgBurdenRate - a.avgBurdenRate);
  }, [aggregateByField, selectedPeriod]);

  // Cross-aggregate: country × job family with full detail
  const { countryFamilyData, jobFamilies, countryDetails, grandTotal } = useMemo(() => {
    if (!costData || !employeeMap) return { countryFamilyData: [], jobFamilies: [], countryDetails: [], grandTotal: 0 };
    const filtered = costData.filter(c => c.period === selectedPeriod);
    const byCountry = {};
    const familySet = new Set();

    for (const record of filtered) {
      const emp = employeeMap[record.employeeId];
      if (!emp) continue;
      const country = emp.countryName || emp.countryCode;
      const code = emp.countryCode;
      const family = emp.jobFamily || 'Other';
      familySet.add(family);
      const cInfo = getCurrencyInfo(code);
      if (!byCountry[country]) {
        byCountry[country] = {
          name: country, code, total: 0, directTotal: 0, benefitTotal: 0,
          overheadTotal: 0, totalHours: 0, employees: new Set(), families: {},
          currencySymbol: cInfo.symbol, currencyCode: cInfo.currency,
          fxToUSD: cInfo.fxToUSD, fxFromUSD: cInfo.fxFromUSD,
        };
      }
      const c = byCountry[country];
      c[family] = (c[family] || 0) + record.totalCostToCompany;
      c.total += record.totalCostToCompany;
      c.directTotal += record.direct.total;
      c.benefitTotal += record.benefits.total;
      c.overheadTotal += record.overhead.total;
      c.totalHours += record.productiveHours;
      c.employees.add(record.employeeId);
      if (!c.families[family]) c.families[family] = { total: 0, employees: new Set() };
      c.families[family].total += record.totalCostToCompany;
      c.families[family].employees.add(record.employeeId);
    }

    const families = Array.from(familySet).sort();
    let gt = 0;
    const details = Object.values(byCountry).map(c => {
      gt += c.total;
      return {
        name: c.name, code: c.code, total: c.total, directTotal: c.directTotal,
        benefitTotal: c.benefitTotal, overheadTotal: c.overheadTotal,
        totalHours: c.totalHours, employeeCount: c.employees.size,
        avgBurdenRate: c.totalHours > 0 ? Math.round((c.total / c.totalHours) * 100) / 100 : 0,
        currencySymbol: c.currencySymbol, currencyCode: c.currencyCode,
        fxToUSD: c.fxToUSD, fxFromUSD: c.fxFromUSD,
        families: Object.fromEntries(
          Object.entries(c.families).map(([f, v]) => [f, { total: v.total, count: v.employees.size }])
        ),
      };
    }).sort((a, b) => b.total - a.total);

    const chartData = details.map(c => {
      const row = { name: c.name, total: c.total };
      families.forEach(f => { row[f] = byCountry[c.name]?.[f] || 0; });
      return row;
    });

    return { countryFamilyData: chartData, jobFamilies: families, countryDetails: details, grandTotal: gt };
  }, [costData, employeeMap, selectedPeriod]);

  const chartHeight = 300;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Burden Cost</h1>
            <p className="text-gray-500 mt-1 text-sm">Burden cost, rates and drivers for the selected period</p>
          </div>
          <div className="flex items-center gap-3 bg-white border border-blue-200 rounded-xl px-5 py-3 shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Current Period</p>
              <p className="text-lg font-bold text-blue-700">{selectedPeriod}</p>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Burden Cost</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(kpis?.totalCTC || 0)}</p>
                <p className="text-xs text-gray-500 mt-1">{selectedPeriod} period</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-600">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
            {(() => {
              const total = kpis?.totalCTC || 1;
              const direct = kpis?.totalDirect || 0;
              const benefits = kpis?.totalBenefits || 0;
              const overhead = kpis?.totalOverhead || 0;
              const pctDirect = Math.round((direct / total) * 100);
              const pctBenefits = Math.round((benefits / total) * 100);
              const pctOverhead = 100 - pctDirect - pctBenefits;
              const segments = [
                { label: 'Payroll', value: direct, pct: pctDirect, color: COLORS.direct },
                { label: 'Benefits', value: benefits, pct: pctBenefits, color: COLORS.benefits },
                { label: 'Overhead', value: overhead, pct: pctOverhead, color: COLORS.overhead },
              ];
              return (
                <div className="border-t border-gray-100 pt-3">
                  {/* Stacked horizontal bar */}
                  <div className="flex w-full h-3 rounded-full overflow-hidden mb-3">
                    {segments.map((seg) => (
                      <div
                        key={seg.label}
                        style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
                        className="transition-all duration-500"
                      />
                    ))}
                  </div>
                  {/* Legend with values */}
                  <div className="flex justify-between">
                    {segments.map((seg) => (
                      <div key={seg.label} className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                          <span className="text-[10px] text-gray-500">{seg.label}</span>
                        </div>
                        <p className="text-xs font-bold text-gray-900">{formatCurrency(seg.value)}</p>
                        <p className="text-[10px] text-gray-400">{seg.pct}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600 font-medium">Burden Multiplier</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{(kpis?.burdenMultiplier || 0).toFixed(2)}x</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-600">
                <Zap className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 justify-center pb-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.benefits }} />
                      <span className="text-[10px] text-emerald-600">Benefits</span>
                      <span className="text-[11px] font-bold text-emerald-800">{formatCurrency(kpis?.totalBenefits || 0)}</span>
                    </span>
                    <span className="text-xs font-bold text-gray-400">+</span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.overhead }} />
                      <span className="text-[10px] text-amber-600">Overhead</span>
                      <span className="text-[11px] font-bold text-amber-800">{formatCurrency(kpis?.totalOverhead || 0)}</span>
                    </span>
                  </div>
                  <div className="w-full h-0.5 bg-gray-400 rounded-full" />
                  <div className="flex justify-center pt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 border border-blue-200">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.direct }} />
                      <span className="text-[10px] text-blue-600">Payroll</span>
                      <span className="text-[11px] font-bold text-blue-800">{formatCurrency(kpis?.totalDirect || 0)}</span>
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold text-gray-400">=</span>
                  <p className="text-lg font-black text-amber-600">{(kpis?.burdenMultiplier || 0).toFixed(2)}x</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <KPICard
            title="Average Burden Rate"
            value={formatRate(kpis?.avgBurdenRate)}
            subtitle="All-in cost per hour"
            change={kpis?.burdenRateChange}
            icon={TrendingUp}
            iconBgColor="bg-green-600"
          />
          <KPICard
            title="Active Employees"
            value={(kpis?.activeEmployees || 0).toLocaleString()}
            subtitle={`${lifecycleCounts.onLeave} on leave · ${lifecycleCounts.terminatedThisPeriod} left this period`}
            icon={Users}
            iconBgColor="bg-purple-600"
          />
          <KPICard
            title="Productive Hours"
            value={`${Math.round((kpis?.totalHours || 0) / 1000).toLocaleString()}K`}
            subtitle={`${selectedPeriod} period`}
            icon={Clock}
            iconBgColor="bg-cyan-600"
          />
        </div>

        {/* Burden Rate Trend */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          {/* Cost Trend by Period */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Burden Rate Trend</h2>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <AreaChart data={periodData || []}>
                <defs>
                  <linearGradient id="gradDirect" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.direct} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={COLORS.direct} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gradBenefits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.benefits} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={COLORS.benefits} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gradOverhead" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.overhead} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={COLORS.overhead} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="period" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                  formatter={(value) => [formatCurrency(value)]}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Legend />
                <Area type="monotone" dataKey="directTotal" stackId="1" stroke={COLORS.direct} fillOpacity={1} fill="url(#gradDirect)" name="Direct Costs" />
                <Area type="monotone" dataKey="benefitTotal" stackId="1" stroke={COLORS.benefits} fillOpacity={1} fill="url(#gradBenefits)" name="Benefits" />
                <Area type="monotone" dataKey="overheadTotal" stackId="1" stroke={COLORS.overhead} fillOpacity={1} fill="url(#gradOverhead)" name="Overhead" />
                {yearEndMarkers.map((m) => (
                  <ReferenceLine
                    key={m.year}
                    x={m.period}
                    stroke="#dc2626"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    label={(props) => {
                      const { viewBox } = props;
                      const text = `$${m.rate.toFixed(2)}`;
                      const w = text.length * 7 + 12;
                      const x = viewBox.x - w / 2;
                      const rawY = viewBox.y + viewBox.height * m.topFrac - 24;
                      const y = Math.max(viewBox.y + 2, rawY);
                      return (
                        <g>
                          <rect x={x} y={y} width={w} height={20} rx={4} fill="#dc2626" />
                          <text
                            x={viewBox.x}
                            y={y + 14}
                            fill="#ffffff"
                            fontSize={12}
                            fontWeight={700}
                            textAnchor="middle"
                          >
                            {text}
                          </text>
                        </g>
                      );
                    }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Burden Rate By Role — by Country */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Burden Rate By Role and Country</h2>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: '70px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '60px' }} />
                  <col style={{ width: '45px' }} />
                  {jobCodeCountries.map(c => <col key={c} style={{ width: '60px' }} />)}
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="border-b-2 border-gray-200 bg-gray-50">
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase py-2.5 px-1 sticky top-0 left-0 z-30 bg-gray-50 border-r border-gray-200 shadow-[inset_0_-2px_0_0_#d1d5db]">Job Code</th>
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase py-2.5 px-1 sticky top-0 z-20 bg-gray-50 border-r border-gray-200 shadow-[inset_0_-2px_0_0_#d1d5db]">Role</th>
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase py-2.5 px-1 sticky top-0 z-20 bg-blue-50 border-x-2 border-blue-200 shadow-[inset_0_-2px_0_0_#d1d5db]">Avg Rate</th>
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase py-2.5 px-1 sticky top-0 z-20 bg-gray-50 border-r border-gray-200 shadow-[inset_0_-2px_0_0_#d1d5db]">Emp</th>
                    {jobCodeCountries.map((c, ci) => (
                      <th key={c} className={`text-center text-xs font-semibold text-gray-500 py-2.5 px-1 sticky top-0 z-20 ${ci % 2 === 0 ? 'bg-gray-50' : 'bg-slate-100/60'} border-r border-gray-200 shadow-[inset_0_-2px_0_0_#d1d5db]`}>
                        <div className="flex justify-center"><FlagIcon code={c} size={20} /></div>
                        <div className="whitespace-nowrap">{getCountryName(c)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobCodeCountryData.map((jc, index) => {
                    const maxRate = jobCodeCountryData[0]?.avgBurdenRate || 1;
                    const allCountryRates = jobCodeCountryData.flatMap(row => jobCodeCountries.map(c => row[c]).filter(Boolean));
                    const globalMax = Math.max(...allCountryRates, 1);
                    const globalMin = Math.min(...allCountryRates.filter(v => v > 0), 0);
                    return (
                      <tr key={jc.key} className={`border-b border-gray-200 transition-colors hover:bg-blue-50/30 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}`}>
                        <td className={`text-xs text-gray-900 py-2 px-1 font-mono font-medium sticky left-0 border-r border-gray-200 truncate text-center ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>{jc.key}</td>
                        <td className="text-xs text-gray-600 py-2 px-1 truncate border-r border-gray-200 text-center">{jc.label}</td>
                        <td className={`py-2 px-1 text-center border-x-2 border-blue-200 ${index % 2 === 0 ? 'bg-blue-50/80' : 'bg-blue-50'}`}>
                          <span className="text-sm text-gray-900 font-bold whitespace-nowrap">${parseFloat(jc.avgBurdenRate).toFixed(0)}<span className="text-[10px] text-gray-500 font-normal">/hr</span></span>
                        </td>
                        <td className="text-xs text-gray-700 py-2 px-1 text-center font-semibold border-r border-gray-200">{jc.employeeCount}</td>
                        {jobCodeCountries.map((c, ci) => {
                          const rate = jc[c];
                          const count = jc[`${c}_count`] || 0;
                          const colBg = ci % 2 === 0 ? '' : 'bg-slate-50/40';
                          if (!rate) return (
                            <td key={c} className={`py-2 px-1 text-center text-xs text-gray-300 border-r border-gray-100 ${colBg}`}>—</td>
                          );
                          const range = globalMax - globalMin || 1;
                          const pct = (rate - globalMin) / range;
                          const bg = pct < 0.33 ? 'bg-green-100 text-green-800 ring-1 ring-green-200'
                            : pct < 0.66 ? 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200'
                            : 'bg-red-100 text-red-800 ring-1 ring-red-200';
                          return (
                            <td key={c} className={`py-2 px-1 text-center border-r border-gray-100 ${colBg}`}>
                              <div className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${bg}`}>
                                ${parseFloat(rate).toFixed(0)}
                              </div>
                              {count > 0 && <div className="text-[10px] text-gray-400 mt-0.5">{count} emp</div>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {jobCodeCountryData.length === 0 && (
                    <tr><td colSpan={4 + jobCodeCountries.length} className="text-center text-gray-400 py-8">No data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Burden Rate by Job Family + Country + Vertical */}
        <div className="grid grid-cols-1 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 order-3">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Burden Rate by Job Family</h2>
          {jobFamilyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={jobFamilyChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} maxBarSize={60}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}/hr`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                  formatter={(value, name) => {
                    if (name === 'avgBurdenRate') return [formatRate(value), 'Burden Rate'];
                    if (name === 'employeeCount') return [value, 'Employees'];
                    return [formatCurrency(value), name];
                  }}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Legend />
                <Bar dataKey="avgBurdenRate" fill="#8b5cf6" radius={[8, 8, 0, 0]} name="Burden Rate ($/hr)">
                  {jobFamilyChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS.palette[index % COLORS.palette.length]} />
                  ))}
                  <LabelList
                    dataKey="avgBurdenRate"
                    position="inside"
                    fill="#fff"
                    fontSize={14}
                    fontWeight="bold"
                    formatter={(v) => `$${parseFloat(v).toFixed(0)}/hr`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data for this period</div>
          )}
        </div>

        {/* Burden Rate by Country */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 order-2">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Burden Rate by Country</h2>
          {countryDetails.length > 0 ? (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={[...countryDetails].sort((a, b) => b.avgBurdenRate - a.avgBurdenRate)} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} maxBarSize={60}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="code" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}/hr`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                  formatter={(value) => [formatRate(value), 'Burden Rate']}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.name || label}
                />
                <Bar dataKey="avgBurdenRate" radius={[8, 8, 0, 0]} name="Burden Rate ($/hr)">
                  {countryDetails.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS.palette[index % COLORS.palette.length]} />
                  ))}
                  <LabelList
                    dataKey="avgBurdenRate"
                    position="inside"
                    fill="#fff"
                    fontSize={14}
                    fontWeight="bold"
                    formatter={(v) => `$${parseFloat(v).toFixed(0)}/hr`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data for this period</div>
          )}
        </div>

        {/* Burden Rate by Vertical */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 order-1">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Burden Rate by Vertical</h2>
          {verticalChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={verticalChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} barCategoryGap="20%" maxBarSize={60}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 12 }} interval={0} />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}/hr`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                  formatter={(value) => [formatRate(value), 'Burden Rate']}
                />
                <Bar dataKey="avgBurdenRate" fill={COLORS.direct} radius={[8, 8, 0, 0]} name="avgBurdenRate">
                  {verticalChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS.palette[index % COLORS.palette.length]} />
                  ))}
                  <LabelList dataKey="avgBurdenRate" position="inside" fill="#fff" fontSize={14} fontWeight="bold"
                    formatter={(v) => `$${parseFloat(v).toFixed(0)}/hr`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data for this period</div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
