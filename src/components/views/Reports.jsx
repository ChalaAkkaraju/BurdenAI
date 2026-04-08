import React, { useState, useMemo } from 'react';
import CountryDistribution from './CountryDistribution';
import { useApp } from '../../context/AppContext';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, LabelList, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { ChevronRight, Download, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatUSD, getFxRateSummary, getCurrencyInfo, formatLocalCurrency } from '../../utils/currency.js';
import FlagIcon from '../FlagIcon';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];

const NAME_TO_CODE = {
  'United States': 'US', 'India': 'IN', 'United Kingdom': 'GB', 'Germany': 'DE',
  'Japan': 'JP', 'Australia': 'AU', 'Singapore': 'SG', 'Brazil': 'BR',
};
const getCodeFromName = (name) => NAME_TO_CODE[name] || name;

const fmt = (value) => formatUSD(value);

const fmtRate = (v) => (v != null ? `$${parseFloat(v).toFixed(2)}/hr` : '—');

export default function Reports() {
  const {
    periodData, summaryByCountry, selectedPeriod,
    costData, employeeMap, periods
  } = useApp();

  const [activeTab, setActiveTab] = useState('hierarchy');
  const [countrySubView, setCountrySubView] = useState('composition');

  // ── Periods are strings like '2026-03' — build sorted list ──
  const sortedPeriods = useMemo(() =>
    [...(periods || [])].sort((a, b) => a.localeCompare(b)),
  [periods]);

  // ════════════════════ TAB 1 — HIERARCHY DRILL-DOWN ════════════════════
  const hierarchyLevels = [
    { field: 'countryCode',   nameField: 'countryName',       label: 'Country' },
    { field: 'companyCodeId', nameField: 'companyCodeName',   label: 'Vertical' },
    { field: 'departmentId',  nameField: 'departmentName',    label: 'Department' },
    { field: 'costCenterId',  nameField: 'costCenterName',    label: 'Cost Center' },
    { field: 'jobCode',       nameField: 'jobCodeName',       label: 'Job Code' },
  ];

  const [drillPath, setDrillPath] = useState([{ label: 'Corporate', key: null, field: null }]);

  const hierarchyData = useMemo(() => {
    if (!costData || !employeeMap) return [];
    const levelIdx = drillPath.length - 1;
    const nextLevel = hierarchyLevels[levelIdx];
    if (!nextLevel) return [];

    // Filter cost records for selected period, then by drill path filters
    let filtered = costData.filter(c => c.period === selectedPeriod);

    for (let i = 1; i < drillPath.length; i++) {
      const pathItem = drillPath[i];
      filtered = filtered.filter(c => {
        const emp = employeeMap[c.employeeId];
        return emp && emp[pathItem.field] === pathItem.key;
      });
    }

    // Group by the next level field
    const groups = {};
    for (const record of filtered) {
      const emp = employeeMap[record.employeeId];
      if (!emp) continue;
      const key = emp[nextLevel.field] || 'Unknown';
      const name = emp[nextLevel.nameField] || key;
      if (!groups[key]) {
        groups[key] = {
          key, name, employees: new Set(),
          directTotal: 0, benefitTotal: 0, overheadTotal: 0,
          totalCTC: 0, totalHours: 0,
        };
      }
      const g = groups[key];
      g.employees.add(record.employeeId);
      g.directTotal += record.direct.total;
      g.benefitTotal += record.benefits.total;
      g.overheadTotal += record.overhead.total;
      g.totalCTC += record.totalCostToCompany;
      g.totalHours += record.productiveHours;
    }

    return Object.values(groups).map(g => ({
      ...g,
      employeeCount: g.employees.size,
      avgBurdenRate: g.totalHours > 0 ? Math.round((g.totalCTC / g.totalHours) * 100) / 100 : 0,
    })).sort((a, b) => b.totalCTC - a.totalCTC);
  }, [costData, employeeMap, selectedPeriod, drillPath]);

  const canDrill = drillPath.length - 1 < hierarchyLevels.length - 1;

  const drillDown = (row) => {
    if (!canDrill) return;
    const levelIdx = drillPath.length - 1;
    const level = hierarchyLevels[levelIdx];
    setDrillPath([...drillPath, { label: row.name, key: row.key, field: level.field }]);
  };

  const breadcrumbClick = (index) => setDrillPath(drillPath.slice(0, index + 1));

  // ════════════════════ TAB 2 — TREND ANALYSIS ════════════════════
  const trendData = useMemo(() => {
    if (!periodData || periodData.length === 0) return [];
    const sorted = [...periodData].sort((a, b) => a.period.localeCompare(b.period));
    return sorted.map((p, idx) => {
      const totalCTC = p.totalCostToCompany;
      const prev = idx > 0 ? sorted[idx - 1].totalCostToCompany : null;
      const momChange = prev !== null ? totalCTC - prev : null;
      const momPct = prev && prev !== 0 ? ((momChange / prev) * 100).toFixed(1) : null;
      return {
        period: p.period,
        totalCTC,
        directTotal: p.directTotal,
        benefitTotal: p.benefitTotal,
        overheadTotal: p.overheadTotal,
        avgBurdenRate: p.avgBurdenRate,
        employeeCount: p.employeeCount,
        momChange,
        momPct,
      };
    });
  }, [periodData]);

  // ════════════════════ TAB 3 — VARIANCE ANALYSIS ════════════════════
  const latestIdx = sortedPeriods.length - 1;
  const [p1Idx, setP1Idx] = useState(Math.max(0, latestIdx - 1));
  const [p2Idx, setP2Idx] = useState(latestIdx);

  const periodLookup = useMemo(() => {
    const map = {};
    (periodData || []).forEach(p => { map[p.period] = p; });
    return map;
  }, [periodData]);

  const varianceRows = useMemo(() => {
    const per1 = sortedPeriods[p1Idx];
    const per2 = sortedPeriods[p2Idx];
    const d1 = periodLookup[per1];
    const d2 = periodLookup[per2];
    if (!d1 || !d2) return [];

    const row = (label, f, isCurrency = true) => {
      const v1 = d1[f] || 0;
      const v2 = d2[f] || 0;
      const delta = v2 - v1;
      const pct = v1 !== 0 ? (delta / v1) * 100 : 0;
      return { label, v1, v2, delta, pct, isCurrency };
    };

    return [
      row('Total Burden Cost', 'totalCostToCompany'),
      row('Direct Costs', 'directTotal'),
      row('Benefits', 'benefitTotal'),
      row('Overhead', 'overheadTotal'),
      row('Avg Burden Rate', 'avgBurdenRate', false),
      row('Employee Count', 'employeeCount', false),
    ];
  }, [sortedPeriods, p1Idx, p2Idx, periodLookup]);

  // Attribution: decompose period-over-period CTC delta into buckets
  const varianceAttribution = useMemo(() => {
    const per1 = sortedPeriods[p1Idx];
    const per2 = sortedPeriods[p2Idx];
    if (!per1 || !per2 || !costData || !employeeMap) return null;

    const byEmp1 = {};
    const byEmp2 = {};
    for (const c of costData) {
      if (c.period === per1) byEmp1[c.employeeId] = c.totalCostToCompany;
      else if (c.period === per2) byEmp2[c.employeeId] = c.totalCostToCompany;
    }

    let newHires = 0, terminations = 0, leaveDelta = 0, sameStoreRate = 0;
    let newHireCount = 0, termCount = 0, leaveCount = 0, moveCount = 0;

    const all = new Set([...Object.keys(byEmp1), ...Object.keys(byEmp2)]);
    for (const id of all) {
      const c1 = byEmp1[id];
      const c2 = byEmp2[id];
      const emp = employeeMap[id];
      if (c1 == null && c2 != null) {
        newHires += c2; newHireCount++;
      } else if (c1 != null && c2 == null) {
        terminations -= c1; termCount++;
      } else if (c1 != null && c2 != null) {
        const delta = c2 - c1;
        // Leave transition = employee on leave in one period but not the other
        const onLeaveNow = emp && emp.status === 'On Leave' &&
          emp.leaveStart && emp.leaveStart <= `${per2}-31` &&
          (!emp.leaveEnd || emp.leaveEnd >= `${per2}-01`);
        const onLeaveThen = emp && emp.status === 'On Leave' &&
          emp.leaveStart && emp.leaveStart <= `${per1}-31` &&
          (!emp.leaveEnd || emp.leaveEnd >= `${per1}-01`);
        if (onLeaveNow !== onLeaveThen) {
          leaveDelta += delta; leaveCount++;
        } else {
          sameStoreRate += delta;
        }
        // Count moves: assignments that changed effective between per1 and per2
        if (emp && emp.assignmentHistory && emp.assignmentHistory.length > 1) {
          const p1End = `${per1}-31`;
          const p2End = `${per2}-31`;
          const moved = emp.assignmentHistory.some(a =>
            a.effectiveFrom > p1End && a.effectiveFrom <= p2End
          );
          if (moved) moveCount++;
        }
      }
    }

    const total = newHires + terminations + leaveDelta + sameStoreRate;
    return {
      buckets: [
        { label: 'New Hires',          value: newHires,       count: newHireCount, color: 'bg-blue-500' },
        { label: 'Terminations',       value: terminations,   count: termCount,    color: 'bg-red-500' },
        { label: 'Leave Transitions',  value: leaveDelta,     count: leaveCount,   color: 'bg-amber-500' },
        { label: 'Same-Store Rate Δ',  value: sameStoreRate,  count: null,         color: 'bg-emerald-500' },
      ],
      total,
      moveCount,
    };
  }, [sortedPeriods, p1Idx, p2Idx, costData, employeeMap]);

  const comparisonChartData = useMemo(() => {
    const per1 = sortedPeriods[p1Idx];
    const per2 = sortedPeriods[p2Idx];
    const d1 = periodLookup[per1];
    const d2 = periodLookup[per2];
    if (!d1 || !d2) return [];
    return [
      { category: 'Direct',   [per1]: d1.directTotal,  [per2]: d2.directTotal },
      { category: 'Benefits', [per1]: d1.benefitTotal,  [per2]: d2.benefitTotal },
      { category: 'Overhead', [per1]: d1.overheadTotal, [per2]: d2.overheadTotal },
    ];
  }, [sortedPeriods, p1Idx, p2Idx, periodLookup]);

  // ════════════════════ TAB 4 — COST COMPOSITION ════════════════════
  const compositionData = useMemo(() => {
    if (!summaryByCountry || summaryByCountry.length === 0) return [];
    return summaryByCountry.map(item => ({
      code: item.key,
      name: item.label || item.key,
      Direct: item.directTotal || 0,
      Benefits: item.benefitTotal || 0,
      Overhead: item.overheadTotal || 0,
      total: item.totalCostToCompany || 0,
      employeeCount: item.employeeCount || 0,
      avgBurdenRate: item.avgBurdenRate || 0,
    })).sort((a, b) => b.total - a.total);
  }, [summaryByCountry]);

  const compositionGrandTotal = compositionData.reduce((s, r) => s + r.total, 0);

  // ════════════════════ TAB 5 — RATE COMPARISON (Country × Job Family) ════════════════════
  const [rateViewMode, setRateViewMode] = useState('chart'); // 'chart' | 'heatmap'
  const [selectedFamily, setSelectedFamily] = useState(null); // filter chart to one family

  const { rateMatrix, rateCountries, rateFamilies, rateGlobalAvg } = useMemo(() => {
    if (!costData || !employeeMap) return { rateMatrix: {}, rateCountries: [], rateFamilies: [], rateGlobalAvg: {} };
    const filtered = costData.filter(c => c.period === selectedPeriod);

    // Accumulate by country × family
    const cells = {}; // { 'US|Engineering': { totalCost, totalHours, empSet } }
    const countrySet = new Set();
    const familySet = new Set();

    for (const r of filtered) {
      const emp = employeeMap[r.employeeId];
      if (!emp) continue;
      const country = emp.countryName || emp.countryCode;
      const family = emp.jobFamily || 'Other';
      countrySet.add(country);
      familySet.add(family);

      const key = `${country}|${family}`;
      if (!cells[key]) cells[key] = { totalCost: 0, totalHours: 0, emps: new Set(), country, family };
      cells[key].totalCost += r.totalCostToCompany;
      cells[key].totalHours += r.productiveHours;
      cells[key].emps.add(r.employeeId);
    }

    // Build matrix: { country: { family: { rate, cost, hours, count } } }
    const matrix = {};
    const countries = Array.from(countrySet).sort();
    const families = Array.from(familySet).sort();

    // Also compute global avg per family (across all countries)
    const globalAcc = {};

    for (const cell of Object.values(cells)) {
      if (!matrix[cell.country]) matrix[cell.country] = {};
      const rate = cell.totalHours > 0 ? Math.round((cell.totalCost / cell.totalHours) * 100) / 100 : 0;
      matrix[cell.country][cell.family] = {
        rate, totalCost: cell.totalCost, totalHours: cell.totalHours, count: cell.emps.size,
      };
      if (!globalAcc[cell.family]) globalAcc[cell.family] = { totalCost: 0, totalHours: 0 };
      globalAcc[cell.family].totalCost += cell.totalCost;
      globalAcc[cell.family].totalHours += cell.totalHours;
    }

    const globalAvg = {};
    for (const [f, acc] of Object.entries(globalAcc)) {
      globalAvg[f] = acc.totalHours > 0 ? Math.round((acc.totalCost / acc.totalHours) * 100) / 100 : 0;
    }

    return { rateMatrix: matrix, rateCountries: countries, rateFamilies: families, rateGlobalAvg: globalAvg };
  }, [costData, employeeMap, selectedPeriod]);

  // Chart data: grouped bar — each bar group is a job family, bars are countries
  const rateChartData = useMemo(() => {
    const displayFamilies = selectedFamily ? [selectedFamily] : rateFamilies;
    return displayFamilies.map(family => {
      const row = { family };
      rateCountries.forEach(country => {
        row[country] = rateMatrix[country]?.[family]?.rate || 0;
      });
      row['Global Avg'] = rateGlobalAvg[family] || 0;
      return row;
    });
  }, [rateFamilies, rateCountries, rateMatrix, rateGlobalAvg, selectedFamily]);

  // Find min/max rates for heatmap coloring
  const { rateMin, rateMax } = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const country of rateCountries) {
      for (const family of rateFamilies) {
        const r = rateMatrix[country]?.[family]?.rate;
        if (r && r > 0) { min = Math.min(min, r); max = Math.max(max, r); }
      }
    }
    return { rateMin: min === Infinity ? 0 : min, rateMax: max === -Infinity ? 0 : max };
  }, [rateMatrix, rateCountries, rateFamilies]);

  const getHeatmapColor = (rate) => {
    if (!rate || rate === 0) return 'bg-gray-50 text-gray-400';
    const range = rateMax - rateMin || 1;
    const pct = (rate - rateMin) / range;
    if (pct < 0.25) return 'bg-green-50 text-green-800';
    if (pct < 0.50) return 'bg-yellow-50 text-yellow-800';
    if (pct < 0.75) return 'bg-orange-50 text-orange-800';
    return 'bg-red-50 text-red-800';
  };

  const getHeatmapBg = (rate) => {
    if (!rate || rate === 0) return '#f9fafb';
    const range = rateMax - rateMin || 1;
    const pct = (rate - rateMin) / range;
    // Interpolate from green (#dcfce7) through yellow (#fef9c3) to red (#fee2e2)
    if (pct < 0.5) {
      const t = pct * 2;
      const r = Math.round(220 + t * (254 - 220));
      const g = Math.round(252 + t * (249 - 252));
      const b = Math.round(231 + t * (195 - 231));
      return `rgb(${r},${g},${b})`;
    } else {
      const t = (pct - 0.5) * 2;
      const r = Math.round(254 + t * (254 - 254));
      const g = Math.round(249 + t * (226 - 249));
      const b = Math.round(195 + t * (226 - 195));
      return `rgb(${r},${g},${b})`;
    }
  };

  // ════════════════════ RENDER ════════════════════
  const tabs = [
    { id: 'hierarchy',       label: 'Hierarchy Drill-Down' },
    { id: 'trends',          label: 'Trend Analysis' },
    { id: 'variance',        label: 'Variance Analysis' },
    { id: 'countryAnalytics', label: 'Country Analytics' },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-gray-600 mt-2">
          Period: <span className="font-semibold text-gray-800">{selectedPeriod}</span> — Comprehensive cost analysis and trend reporting
          <span className="text-gray-400"> · All aggregated values in USD</span>
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-1 font-medium border-b-2 transition text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ TAB 1: Hierarchy Drill-Down ═══ */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm bg-white p-4 rounded-lg border border-gray-200">
            {drillPath.map((item, idx) => (
              <React.Fragment key={idx}>
                <button
                  onClick={() => breadcrumbClick(idx)}
                  className={`px-2 py-1 rounded font-medium transition ${
                    idx === drillPath.length - 1
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-blue-600 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </button>
                {idx < drillPath.length - 1 && <ChevronRight size={14} className="text-gray-400" />}
              </React.Fragment>
            ))}
            {drillPath.length > 1 && hierarchyLevels[drillPath.length - 1] && (
              <span className="ml-auto text-xs text-gray-400 italic">
                Showing: {hierarchyLevels[drillPath.length - 1].label}
              </span>
            )}
          </div>

          {/* Chart */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Total Burden Cost</h2>
            {hierarchyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hierarchyData} barCategoryGap="15%" barGap={6} maxBarSize={90}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={fmt} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                    formatter={(value, name) => {
                      if (name === 'avgBurdenRate') return [fmtRate(value), 'Burden Rate'];
                      return [fmt(value), name === 'totalCTC' ? 'Total Burden Cost' : name];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="totalCTC" fill={COLORS[0]} radius={[6, 6, 0, 0]} name="Total Burden Cost">
                    <LabelList dataKey="totalCTC" position="inside" fill="#fff" fontSize={13} fontWeight="bold" formatter={(v) => fmt(v)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">No data at this level</div>
            )}
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Employees</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Direct</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Benefits</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Overhead</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Burden Cost</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Burden Rate</th>
                  {canDrill && <th className="px-3 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {hierarchyData.map((row, idx) => (
                  <tr
                    key={row.key}
                    onClick={() => drillDown(row)}
                    className={`${canDrill ? 'cursor-pointer hover:bg-blue-50' : ''} ${idx % 2 !== 0 ? 'bg-gray-50/50' : ''}`}
                  >
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-600">{row.employeeCount}</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-600">{fmt(row.directTotal)}</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-600">{fmt(row.benefitTotal)}</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-600">{fmt(row.overheadTotal)}</td>
                    <td className="px-6 py-3 text-right text-sm font-semibold text-gray-900">{fmt(row.totalCTC)}</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-700">{fmtRate(row.avgBurdenRate)}</td>
                    {canDrill && (
                      <td className="px-3 py-3 text-right">
                        <ChevronRight size={16} className="text-gray-400" />
                      </td>
                    )}
                  </tr>
                ))}
                {hierarchyData.length === 0 && (
                  <tr><td colSpan={canDrill ? 8 : 7} className="px-6 py-12 text-center text-gray-400">No data available</td></tr>
                )}
              </tbody>
              {hierarchyData.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr className="font-semibold">
                    <td className="px-6 py-3 text-sm text-gray-900">Total</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-900">{hierarchyData.reduce((s, r) => s + r.employeeCount, 0)}</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-900">{fmt(hierarchyData.reduce((s, r) => s + r.directTotal, 0))}</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-900">{fmt(hierarchyData.reduce((s, r) => s + r.benefitTotal, 0))}</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-900">{fmt(hierarchyData.reduce((s, r) => s + r.overheadTotal, 0))}</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-900">{fmt(hierarchyData.reduce((s, r) => s + r.totalCTC, 0))}</td>
                    <td className="px-6 py-3 text-right text-sm"></td>
                    {canDrill && <td className="px-3 py-3"></td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ═══ TAB 2: Trend Analysis ═══ */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          {/* Dual-axis chart */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Burden Rate & Cost Trend (60 Months)</h2>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#9ca3af" interval={5} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke={COLORS[0]} tickFormatter={(v) => fmtRate(v)} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke={COLORS[1]} tickFormatter={fmt} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                    formatter={(value, name) =>
                      name === 'Burden Rate' ? [fmtRate(value)] : [fmt(value)]
                    }
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="stepAfter" dataKey="avgBurdenRate" stroke={COLORS[0]} strokeWidth={2} dot={false} name="Burden Rate" />
                  <Line yAxisId="right" type="monotone" dataKey="totalCTC" stroke={COLORS[1]} strokeWidth={2} dot={false} name="Total Burden Cost" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">No trend data available</div>
            )}
          </div>

          {/* Period table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Period</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Burden Cost</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Direct</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Benefits</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Overhead</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">MoM Change</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Burden Rate</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Employees</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trendData.map((row, idx) => (
                    <tr key={row.period} className={`${row.period === selectedPeriod ? 'bg-blue-50' : idx % 2 !== 0 ? 'bg-gray-50/50' : ''}`}>
                      <td className="px-6 py-2.5 text-sm font-medium text-gray-900">
                        {row.period}
                        {row.period === selectedPeriod && <span className="ml-2 text-xs text-blue-600 font-normal">(current)</span>}
                      </td>
                      <td className="px-6 py-2.5 text-right text-sm font-semibold text-gray-900">{fmt(row.totalCTC)}</td>
                      <td className="px-6 py-2.5 text-right text-sm text-gray-600">{fmt(row.directTotal)}</td>
                      <td className="px-6 py-2.5 text-right text-sm text-gray-600">{fmt(row.benefitTotal)}</td>
                      <td className="px-6 py-2.5 text-right text-sm text-gray-600">{fmt(row.overheadTotal)}</td>
                      <td className="px-6 py-2.5 text-right text-sm">
                        {row.momChange !== null ? (
                          <span className={row.momChange >= 0 ? 'text-red-600' : 'text-green-600'}>
                            {row.momChange >= 0 ? '+' : ''}{fmt(row.momChange)}
                            {row.momPct && <span className="text-xs ml-1">({row.momPct}%)</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-2.5 text-right text-sm text-gray-700">{fmtRate(row.avgBurdenRate)}</td>
                      <td className="px-6 py-2.5 text-right text-sm text-gray-600">{row.employeeCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 3: Variance Analysis ═══ */}
      {activeTab === 'variance' && (
        <div className="space-y-6">
          {/* Period Selectors */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Select Periods to Compare</h2>
            <div className="flex items-end gap-6">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Base Period</label>
                <select
                  value={p1Idx}
                  onChange={(e) => setP1Idx(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                >
                  {sortedPeriods.map((p, i) => (
                    <option key={p} value={i}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="pb-2.5 text-gray-400 font-bold text-lg">vs</div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Comparison Period</label>
                <select
                  value={p2Idx}
                  onChange={(e) => setP2Idx(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                >
                  {sortedPeriods.map((p, i) => (
                    <option key={p} value={i}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Variance Summary Cards */}
          {varianceRows.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {varianceRows.slice(0, 3).map((row) => {
                const up = row.delta >= 0;
                return (
                  <div key={row.label} className="bg-white p-5 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-500 font-medium">{row.label}</p>
                    <div className="flex items-baseline gap-3 mt-2">
                      <span className="text-2xl font-bold text-gray-900">{row.isCurrency ? fmt(row.v2) : row.v2.toLocaleString()}</span>
                      <span className={`flex items-center text-sm font-medium ${up ? 'text-red-600' : 'text-green-600'}`}>
                        {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {up ? '+' : ''}{row.pct.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">from {row.isCurrency ? fmt(row.v1) : row.v1.toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Attribution Breakdown */}
          {varianceAttribution && (
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-semibold text-gray-900">Variance Attribution</h2>
                <span className="text-xs text-gray-500">
                  Net Δ: <span className={`font-bold ${varianceAttribution.total >= 0 ? 'text-red-600' : 'text-green-600'}`}>{varianceAttribution.total >= 0 ? '+' : ''}{fmt(varianceAttribution.total)}</span>
                  {varianceAttribution.moveCount > 0 && <span className="ml-3 text-gray-500">{varianceAttribution.moveCount} cost-center moves</span>}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-4">What drove the change in Total Burden Cost between {sortedPeriods[p1Idx]} and {sortedPeriods[p2Idx]}?</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {varianceAttribution.buckets.map(b => {
                  const absTotal = Math.abs(varianceAttribution.total) || 1;
                  const pct = Math.min(100, Math.abs(b.value) / absTotal * 100);
                  const up = b.value > 0;
                  return (
                    <div key={b.label} className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-6 rounded-full ${b.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-600 font-medium truncate">{b.label}</div>
                          {b.count != null && <div className="text-[10px] text-gray-400">{b.count} employees</div>}
                        </div>
                      </div>
                      <div className={`text-lg font-bold ${up ? 'text-red-600' : b.value < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        {up ? '+' : ''}{fmt(b.value)}
                      </div>
                      <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full ${b.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comparison Chart */}
          {comparisonChartData.length > 0 && (
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost Comparison</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={fmt} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                    formatter={(v) => [fmt(v)]}
                  />
                  <Legend />
                  <Bar dataKey={sortedPeriods[p1Idx]} fill={COLORS[0]} radius={[6, 6, 0, 0]}>
                    <LabelList dataKey={sortedPeriods[p1Idx]} position="inside" fill="#fff" fontSize={13} fontWeight="bold" formatter={(v) => fmt(v)} />
                  </Bar>
                  <Bar dataKey={sortedPeriods[p2Idx]} fill={COLORS[1]} radius={[6, 6, 0, 0]}>
                    <LabelList dataKey={sortedPeriods[p2Idx]} position="inside" fill="#fff" fontSize={13} fontWeight="bold" formatter={(v) => fmt(v)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Variance Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Metric</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{sortedPeriods[p1Idx]}</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{sortedPeriods[p2Idx]}</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Variance</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Change %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {varianceRows.map((row, idx) => {
                  const up = row.delta > 0;
                  const fmtVal = row.isCurrency ? fmt : (v) => typeof v === 'number' ? v.toLocaleString() : v;
                  return (
                    <tr key={row.label} className={idx % 2 !== 0 ? 'bg-gray-50/50' : ''}>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{row.label}</td>
                      <td className="px-6 py-3 text-right text-sm text-gray-600">{fmtVal(row.v1)}</td>
                      <td className="px-6 py-3 text-right text-sm text-gray-900 font-semibold">{fmtVal(row.v2)}</td>
                      <td className={`px-6 py-3 text-right text-sm font-medium ${up ? 'text-red-600' : row.delta < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        {up ? '+' : ''}{fmtVal(row.delta)}
                      </td>
                      <td className={`px-6 py-3 text-right text-sm font-medium ${up ? 'text-red-600' : row.delta < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        {up ? '+' : ''}{row.pct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ TAB 4: Cost Composition ═══ */}
      {activeTab === 'countryAnalytics' && (
        <div className="mb-4 flex gap-2">
          {[
            { id: 'composition', label: 'Composition' },
            { id: 'distribution', label: 'Distribution' },
            { id: 'rateMatrix', label: 'Rate Matrix' },
          ].map(sv => (
            <button
              key={sv.id}
              onClick={() => setCountrySubView(sv.id)}
              className={`px-4 py-2 text-sm rounded-lg border ${countrySubView === sv.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              {sv.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'countryAnalytics' && countrySubView === 'composition' && (
        <div className="space-y-6">
          {/* FX Rate Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-blue-800">Exchange Rates Used (Apr 2026)</span>
              <span className="text-xs text-blue-600">— All values converted to USD for comparison</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {getFxRateSummary().map(fx => (
                <span key={fx.code} className="text-xs text-blue-700">
                  {fx.rateDisplay}
                </span>
              ))}
            </div>
          </div>

          {/* ── Summary KPI Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Burden Cost', value: fmt(compositionGrandTotal), color: 'bg-indigo-500', light: 'bg-indigo-50 text-indigo-700' },
              { label: 'Direct Payroll', value: fmt(compositionData.reduce((s, r) => s + r.Direct, 0)), color: 'bg-blue-500', light: 'bg-blue-50 text-blue-700' },
              { label: 'Benefits', value: fmt(compositionData.reduce((s, r) => s + r.Benefits, 0)), color: 'bg-emerald-500', light: 'bg-emerald-50 text-emerald-700' },
              { label: 'Overhead', value: fmt(compositionData.reduce((s, r) => s + r.Overhead, 0)), color: 'bg-amber-500', light: 'bg-amber-50 text-amber-700' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                <div className={`w-2 h-10 rounded-full ${kpi.color}`} />
                <div>
                  <div className="text-xs font-medium text-gray-500">{kpi.label}</div>
                  <div className="text-lg font-bold text-gray-900">{kpi.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Pie Chart Grid — one donut per country ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-gray-900">Cost Composition by Country</h2>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Direct</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Benefits</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Overhead</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-5">Donut charts showing the Direct / Benefits / Overhead split per country (USD)</p>
            {compositionData.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {compositionData.map(row => {
                  const slices = [
                    { name: 'Direct', value: row.Direct, color: '#3b82f6' },
                    { name: 'Benefits', value: row.Benefits, color: '#10b981' },
                    { name: 'Overhead', value: row.Overhead, color: '#f59e0b' },
                  ];
                  const sharePct = compositionGrandTotal > 0 ? ((row.total / compositionGrandTotal) * 100).toFixed(1) : '0';
                  return (
                    <div key={row.name} className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-blue-200 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <FlagIcon code={row.code} size={22} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-gray-900 truncate">{row.name}</div>
                          <div className="text-[10px] text-gray-500">{row.employeeCount} employees · {sharePct}% share</div>
                        </div>
                      </div>
                      <div className="relative" style={{ height: 150 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={slices}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={38}
                              outerRadius={62}
                              paddingAngle={2}
                              stroke="none"
                            >
                              {slices.map((s) => <Cell key={s.name} fill={s.color} />)}
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: 11 }}
                              formatter={(v, n) => [fmt(v), n]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Center label inside donut */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <div className="text-[10px] text-gray-500 font-medium">Total</div>
                          <div className="text-sm font-bold text-gray-900">{fmt(row.total)}</div>
                        </div>
                      </div>
                      {/* Sub-amount legend */}
                      <div className="mt-3 space-y-1">
                        {slices.map(s => {
                          const pct = row.total > 0 ? (s.value / row.total * 100).toFixed(0) : 0;
                          return (
                            <div key={s.name} className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1.5 text-gray-600">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                {s.name}
                              </span>
                              <span className="text-gray-900 font-semibold">{fmt(s.value)} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between items-center">
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">Burden Rate</span>
                        <span className="text-xs font-bold text-gray-800">{fmtRate(row.avgBurdenRate)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">No composition data</div>
            )}
          </div>

          {/* ── Detailed Table ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Detailed Breakdown</h2>
              <p className="text-xs text-gray-500">All values in USD — sorted by total cost descending</p>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Country</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-blue-600 uppercase bg-blue-50/50">Direct</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-600 uppercase bg-emerald-50/50">Benefits</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-amber-600 uppercase bg-amber-50/50">Overhead</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase border-l border-gray-200">Total Burden Cost</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Share</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Rate $/hr</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Employees</th>
                </tr>
              </thead>
              <tbody>
                {compositionData.map((row, idx) => {
                  const pct = compositionGrandTotal > 0 ? ((row.total / compositionGrandTotal) * 100).toFixed(1) : '0';
                  return (
                    <tr key={row.name} className={`border-b border-gray-100 hover:bg-blue-50/20 transition-colors ${idx % 2 !== 0 ? 'bg-gray-50/40' : 'bg-white'}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <FlagIcon code={row.code} size={20} />
                          <span className="text-sm font-semibold text-gray-900">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-blue-700 bg-blue-50/20 font-medium">{fmt(row.Direct)}</td>
                      <td className="px-4 py-3 text-right text-sm text-emerald-700 bg-emerald-50/20 font-medium">{fmt(row.Benefits)}</td>
                      <td className="px-4 py-3 text-right text-sm text-amber-700 bg-amber-50/20 font-medium">{fmt(row.Overhead)}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 border-l border-gray-200">{fmt(row.total)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-20 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-600 w-10 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{fmtRate(row.avgBurdenRate)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">{row.employeeCount}</td>
                    </tr>
                  );
                })}
              </tbody>
              {compositionData.length > 0 && (
                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                  <tr className="font-bold">
                    <td className="px-5 py-3 text-sm text-gray-900">Grand Total</td>
                    <td className="px-4 py-3 text-right text-sm text-blue-800">{fmt(compositionData.reduce((s, r) => s + r.Direct, 0))}</td>
                    <td className="px-4 py-3 text-right text-sm text-emerald-800">{fmt(compositionData.reduce((s, r) => s + r.Benefits, 0))}</td>
                    <td className="px-4 py-3 text-right text-sm text-amber-800">{fmt(compositionData.reduce((s, r) => s + r.Overhead, 0))}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900 border-l border-gray-200">{fmt(compositionGrandTotal)}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">100%</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">{compositionData.reduce((s, r) => s + r.employeeCount, 0)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ═══ TAB 5: Rate Comparison — Country × Job Family ═══ */}
      {activeTab === 'countryAnalytics' && countrySubView === 'rateMatrix' && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="bg-white p-5 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Burden Rate by Job Family — Country Comparison</h2>
                <p className="text-sm text-gray-500 mt-1">Compare how the same role family costs differently across geographies · Rates in USD/hr</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Family filter */}
                <select
                  value={selectedFamily || ''}
                  onChange={(e) => setSelectedFamily(e.target.value || null)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                >
                  <option value="">All Job Families</option>
                  {rateFamilies.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                {/* View toggle */}
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setRateViewMode('chart')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                      rateViewMode === 'chart' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Chart
                  </button>
                  <button
                    onClick={() => setRateViewMode('heatmap')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                      rateViewMode === 'heatmap' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Heatmap
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Global Avg Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {rateFamilies.map((family, i) => {
              const avg = rateGlobalAvg[family] || 0;
              // Find min and max country for this family
              let minC = null, maxC = null, minR = Infinity, maxR = -Infinity;
              rateCountries.forEach(c => {
                const r = rateMatrix[c]?.[family]?.rate;
                if (r && r > 0) {
                  if (r < minR) { minR = r; minC = c; }
                  if (r > maxR) { maxR = r; maxC = c; }
                }
              });
              const spread = maxR !== -Infinity && minR !== Infinity ? maxR - minR : 0;
              return (
                <button
                  key={family}
                  onClick={() => setSelectedFamily(selectedFamily === family ? null : family)}
                  className={`text-left p-4 rounded-lg border transition ${
                    selectedFamily === family
                      ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                      : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm font-semibold text-gray-900">{family}</span>
                  </div>
                  <div className="text-xl font-bold text-gray-900">{fmtRate(avg)}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    {minC && <span className="text-green-600">Low: {minC}</span>}
                    {maxC && <span className="text-red-600">High: {maxC}</span>}
                  </div>
                  {spread > 0 && (
                    <div className="text-xs text-gray-400 mt-1">Spread: ${spread.toFixed(2)}/hr</div>
                  )}
                </button>
              );
            })}
          </div>

          {rateViewMode === 'chart' ? (
            /* Grouped Bar Chart */
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                {selectedFamily ? `${selectedFamily} — Rate by Country` : 'Burden Rate by Job Family'}
              </h3>
              <p className="text-sm text-gray-400 mb-4">Grouped by job family, one bar per country + global average</p>
              {rateChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart data={rateChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="family" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                      formatter={(value) => [fmtRate(value)]}
                      labelStyle={{ fontWeight: 'bold' }}
                    />
                    <Legend />
                    {rateCountries.map((country, i) => (
                      <Bar key={country} dataKey={country} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey={country} position="inside" fill="#fff" fontSize={11} fontWeight="bold" formatter={(v) => v > 0 ? `$${parseFloat(v).toFixed(0)}` : ''} />
                      </Bar>
                    ))}
                    <Bar dataKey="Global Avg" fill="#1f2937" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="Global Avg" position="inside" fill="#fff" fontSize={11} fontWeight="bold" formatter={(v) => v > 0 ? `$${parseFloat(v).toFixed(0)}` : ''} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">No data available</div>
              )}
            </div>
          ) : (
            /* Heatmap Table View */
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-900">Rate Heatmap — $/hr</h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  Color intensity indicates rate relative to range ({fmtRate(rateMin)} – {fmtRate(rateMax)})
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-xs text-gray-500">Low</span>
                  <div className="flex h-3 rounded-full overflow-hidden" style={{ width: '160px' }}>
                    <div className="flex-1" style={{ backgroundColor: '#dcfce7' }} />
                    <div className="flex-1" style={{ backgroundColor: '#fef9c3' }} />
                    <div className="flex-1" style={{ backgroundColor: '#fed7aa' }} />
                    <div className="flex-1" style={{ backgroundColor: '#fee2e2' }} />
                  </div>
                  <span className="text-xs text-gray-500">High</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">Job Family</th>
                      {rateCountries.map(c => (
                        <th key={c} className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase"><span className="inline-flex items-center gap-1.5 justify-center"><FlagIcon code={getCodeFromName(c)} size={16} /> {c}</span></th>
                      ))}
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase bg-gray-100">Global Avg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(selectedFamily ? rateFamilies.filter(f => f === selectedFamily) : rateFamilies).map((family, fi) => (
                      <tr key={family}>
                        <td className="px-5 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[rateFamilies.indexOf(family) % COLORS.length] }} />
                            {family}
                          </div>
                        </td>
                        {rateCountries.map(country => {
                          const cell = rateMatrix[country]?.[family];
                          const rate = cell?.rate || 0;
                          const count = cell?.count || 0;
                          const globalAvg = rateGlobalAvg[family] || 0;
                          const diff = rate && globalAvg ? rate - globalAvg : 0;
                          return (
                            <td key={country} className="px-2 py-2 text-center" style={{ minWidth: '100px' }}>
                              {rate > 0 ? (
                                <div className="rounded-lg px-3 py-2" style={{ backgroundColor: getHeatmapBg(rate) }}>
                                  <div className="text-sm font-bold text-gray-900">${rate.toFixed(2)}</div>
                                  <div className="text-xs text-gray-500 mt-0.5">{count} emp</div>
                                  {diff !== 0 && (
                                    <div className={`text-xs font-medium mt-0.5 ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {diff > 0 ? '+' : ''}{diff.toFixed(2)} vs avg
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-center bg-gray-50">
                          <div className="text-sm font-bold text-gray-900">{fmtRate(rateGlobalAvg[family])}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detailed Data Table (always visible below chart/heatmap) */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Detailed Rate Data</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Job Family</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Country</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Burden Rate</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Burden Cost</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Employees</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">vs Global Avg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(selectedFamily ? rateFamilies.filter(f => f === selectedFamily) : rateFamilies).flatMap(family =>
                    rateCountries.map(country => {
                      const cell = rateMatrix[country]?.[family];
                      if (!cell || cell.rate === 0) return null;
                      const globalAvg = rateGlobalAvg[family] || 0;
                      const diff = cell.rate - globalAvg;
                      const diffPct = globalAvg > 0 ? (diff / globalAvg) * 100 : 0;
                      return (
                        <tr key={`${family}-${country}`} className="hover:bg-gray-50/50">
                          <td className="px-5 py-2.5 text-sm font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[rateFamilies.indexOf(family) % COLORS.length] }} />
                              {family}
                            </div>
                          </td>
                          <td className="px-5 py-2.5 text-sm text-gray-700"><span className="inline-flex items-center gap-1.5"><FlagIcon code={getCodeFromName(country)} size={16} /> {country}</span></td>
                          <td className="px-5 py-2.5 text-right text-sm font-semibold text-gray-900">{fmtRate(cell.rate)}</td>
                          <td className="px-5 py-2.5 text-right text-sm text-gray-600">{fmt(cell.totalCost)}</td>
                          <td className="px-5 py-2.5 text-right text-sm text-gray-600">{cell.count}</td>
                          <td className={`px-5 py-2.5 text-right text-sm font-medium ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(2)} ({diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)
                          </td>
                        </tr>
                      );
                    }).filter(Boolean)
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 6: Cost Breakdown (formerly Cost Ingestion) ═══ */}

      {/* ═══ TAB 7: Country Distribution ═══ */}
      {activeTab === 'countryAnalytics' && countrySubView === 'distribution' && <CountryDistribution />}
    </div>
  );
}
