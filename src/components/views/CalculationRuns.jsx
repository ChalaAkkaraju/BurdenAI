import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
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
  Play,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  RefreshCw,
  X,
  AlertTriangle,
  TrendingUp,
  Zap,
  Activity,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { countries as ALL_COUNTRIES } from '../../data/orgHierarchy';

// Default annual inflation rates (%) by country × component
const DEFAULT_INFLATION = {
  US: { salary: 4.0, benefits: 7.0, overhead: 3.0 },
  GB: { salary: 4.5, benefits: 6.5, overhead: 3.5 },
  DE: { salary: 3.5, benefits: 5.5, overhead: 2.5 },
  IN: { salary: 9.0, benefits: 8.0, overhead: 6.0 },
  JP: { salary: 2.5, benefits: 3.0, overhead: 1.5 },
  BR: { salary: 6.5, benefits: 7.5, overhead: 5.0 },
  SG: { salary: 4.0, benefits: 5.0, overhead: 3.0 },
  AU: { salary: 4.0, benefits: 6.0, overhead: 3.0 },
};

const buildDefaultInflation = () => {
  const out = {};
  ALL_COUNTRIES.forEach((c) => {
    out[c.code] = DEFAULT_INFLATION[c.code] || { salary: 4.0, benefits: 6.0, overhead: 3.0 };
  });
  return out;
};

const COLORS = {
  direct: '#3b82f6',
  benefits: '#10b981',
  overhead: '#f59e0b',
  palette: ['#3b82f6', '#10b981', '#f59e0b'],
};

// Helper functions
const formatCurrency = (value) => {
  if (value === null || value === undefined) return '$0';
  const absValue = Math.abs(value);
  if (absValue >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (absValue >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
};

const formatDuration = (startedAt, completedAt) => {
  if (!startedAt || !completedAt) return '-';
  const start = new Date(startedAt);
  const end = new Date(completedAt);
  const diffMs = end - start;
  const diffSecs = Math.floor(diffMs / 1000);
  const mins = Math.floor(diffSecs / 60);
  const secs = diffSecs % 60;
  return `${mins}m ${secs}s`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Status Badge Component
const StatusBadge = ({ status }) => {
  const baseClasses = 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold';

  switch (status) {
    case 'Completed':
      return (
        <span className={`${baseClasses} bg-green-100 text-green-700`}>
          <CheckCircle className="w-3 h-3" />
          Completed
        </span>
      );
    case 'Running':
      return (
        <span className={`${baseClasses} bg-blue-100 text-blue-700`}>
          <Activity className="w-3 h-3 animate-pulse" />
          Running
        </span>
      );
    case 'Failed':
      return (
        <span className={`${baseClasses} bg-red-100 text-red-700`}>
          <AlertCircle className="w-3 h-3" />
          Failed
        </span>
      );
    case 'Queued':
      return (
        <span className={`${baseClasses} bg-amber-100 text-amber-700`}>
          <Clock className="w-3 h-3" />
          Queued
        </span>
      );
    default:
      return <span className={baseClasses}>{status}</span>;
  }
};

// Stat Card Component
const StatCard = ({ title, value, subtitle, icon: Icon }) => (
  <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-600 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className="p-3 bg-blue-50 rounded-lg">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
    </div>
  </div>
);

// New Calculation Dialog
const NewCalculationDialog = ({ isOpen, onClose, onExecute, periods }) => {
  const [selectedPeriod, setSelectedPeriod] = useState(periods[periods.length - 1] || '');
  const [calculationType, setCalculationType] = useState('Monthly Close');
  const [notes, setNotes] = useState('');
  const [horizonYears, setHorizonYears] = useState(3);
  const [inflation, setInflation] = useState(buildDefaultInflation);

  const isForecast = calculationType === 'Forecast';

  const handleInflationChange = (code, component, value) => {
    const num = parseFloat(value);
    setInflation((prev) => ({
      ...prev,
      [code]: { ...prev[code], [component]: isNaN(num) ? 0 : num },
    }));
  };

  const handleExecute = () => {
    onExecute({
      period: selectedPeriod,
      type: calculationType,
      notes,
      horizonYears: isForecast ? horizonYears : null,
      inflation: isForecast ? inflation : null,
    });
    setNotes('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={`bg-white rounded-lg shadow-lg w-full ${isForecast ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">{isForecast ? 'New Forecast Run' : 'New Calculation Run'}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{isForecast ? 'Baseline Period' : 'Period'}</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {periods.map((period) => (
                <option key={period} value={period}>
                  {period}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Calculation Type
            </label>
            <select
              value={calculationType}
              onChange={(e) => setCalculationType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option>Monthly Close</option>
              <option>Ad Hoc</option>
              <option>Restatement</option>
              <option>Forecast</option>
            </select>
            {isForecast && (
              <p className="text-xs text-gray-500 mt-1">
                Projects baseline period forward using country × component inflation rates. Forecast runs are kept separate from actuals.
              </p>
            )}
          </div>

          {isForecast && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Forecast Horizon</label>
                <select
                  value={horizonYears}
                  onChange={(e) => setHorizonYears(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={1}>1 year</option>
                  <option value={2}>2 years</option>
                  <option value={3}>3 years</option>
                  <option value={5}>5 years</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Annual Inflation by Country &amp; Component (%)
                </label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left text-xs font-semibold text-gray-700 py-2 px-3">Country</th>
                        <th className="text-right text-xs font-semibold text-gray-700 py-2 px-3">Salary %</th>
                        <th className="text-right text-xs font-semibold text-gray-700 py-2 px-3">Benefits %</th>
                        <th className="text-right text-xs font-semibold text-gray-700 py-2 px-3">Overhead %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ALL_COUNTRIES.map((c) => (
                        <tr key={c.code} className="border-t border-gray-100">
                          <td className="py-2 px-3 text-gray-900">{c.name}</td>
                          {['salary', 'benefits', 'overhead'].map((comp) => (
                            <td key={comp} className="py-1 px-2">
                              <input
                                type="number"
                                step="0.1"
                                value={inflation[c.code]?.[comp] ?? 0}
                                onChange={(e) => handleInflationChange(c.code, comp, e.target.value)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 mt-1">Compounded annually. Defaults reflect Apr 2026 finance assumptions and can be edited per country.</p>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this calculation run..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-24"
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            {isForecast ? 'Run Forecast' : 'Execute'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Run Details Panel
const RunDetailsPanel = ({ run, costData, employees, onClose }) => {
  if (!run) return null;

  // Mock cost breakdown for the selected run
  const runCosts = costData.filter((c) => c.period === run.period);
  const totalDirect = runCosts.reduce((sum, c) => sum + c.direct.total, 0);
  const totalBenefits = runCosts.reduce((sum, c) => sum + c.benefits.total, 0);
  const totalOverhead = runCosts.reduce((sum, c) => sum + c.overhead.total, 0);

  const costBreakdownData = [
    { name: 'Direct', value: totalDirect, fill: COLORS.direct },
    { name: 'Benefits', value: totalBenefits, fill: COLORS.benefits },
    { name: 'Overhead', value: totalOverhead, fill: COLORS.overhead },
  ];

  // Mock reconciliation
  const calculatedTotal = run.totalCostToCompany;
  const expectedTotal = calculatedTotal * 0.98; // Mock 2% variance
  const variance = calculatedTotal - expectedTotal;
  const variancePercent = ((variance / expectedTotal) * 100).toFixed(2);

  // Mock exceptions
  const mockExceptions = [
    {
      id: 1,
      severity: 'warning',
      message: '3 employees missing job code mapping',
      count: 3,
    },
    {
      id: 2,
      severity: 'warning',
      message: 'FX rate for BRL not updated',
      count: 1,
    },
    {
      id: 3,
      severity: 'info',
      message: '2 cost centers with no allocation rule',
      count: 2,
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white w-full md:w-96 h-screen shadow-lg overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Run Details</h2>
            <p className="text-sm text-gray-600">{run.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Metadata */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Run Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Period</span>
                <span className="font-medium text-gray-900">{run.period}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Type</span>
                <span className="font-medium text-gray-900">{run.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <div>
                  <StatusBadge status={run.status} />
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Started</span>
                <span className="font-medium text-gray-900 text-right text-xs">
                  {formatDate(run.startedAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duration</span>
                <span className="font-medium text-gray-900">{formatDuration(run.startedAt, run.completedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Employees</span>
                <span className="font-medium text-gray-900">{run.employeeCount}</span>
              </div>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Cost Breakdown</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={costBreakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {costBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                  }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs mt-2">
              <div className="bg-blue-50 rounded p-2">
                <p className="text-gray-600">Direct</p>
                <p className="font-bold text-gray-900">{formatCurrency(totalDirect)}</p>
              </div>
              <div className="bg-green-50 rounded p-2">
                <p className="text-gray-600">Benefits</p>
                <p className="font-bold text-gray-900">{formatCurrency(totalBenefits)}</p>
              </div>
              <div className="bg-amber-50 rounded p-2">
                <p className="text-gray-600">Overhead</p>
                <p className="font-bold text-gray-900">{formatCurrency(totalOverhead)}</p>
              </div>
            </div>
          </div>

          {/* Reconciliation */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Reconciliation</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Calculated Total</span>
                <span className="font-medium text-gray-900">{formatCurrency(calculatedTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Expected Total</span>
                <span className="font-medium text-gray-900">{formatCurrency(expectedTotal)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="text-gray-600 font-medium">Variance</span>
                <span className={`font-bold ${variance >= 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {formatCurrency(variance)} ({variancePercent}%)
                </span>
              </div>
            </div>
          </div>

          {/* Exceptions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Exceptions & Warnings</h3>
            <div className="space-y-2">
              {mockExceptions.map((exc) => (
                <div
                  key={exc.id}
                  className={`rounded-lg p-3 flex gap-3 ${
                    exc.severity === 'warning'
                      ? 'bg-amber-50 border border-amber-200'
                      : 'bg-blue-50 border border-blue-200'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {exc.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <div className="text-sm">
                    <p className={exc.severity === 'warning' ? 'text-amber-900' : 'text-blue-900'}>
                      {exc.message}
                    </p>
                    {exc.count && (
                      <p className={`text-xs mt-1 ${exc.severity === 'warning' ? 'text-amber-700' : 'text-blue-700'}`}>
                        Affected: {exc.count}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Component
const CalculationRuns = () => {
  const {
    calculationRuns,
    setCalculationRuns,
    addAuditEntry,
    periodData,
    periods,
    costData,
    employees,
    employeeMap,
  } = useApp();
  const [showForecasts, setShowForecasts] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runningRunIds, setRunningRunIds] = useState(new Set());

  // Calculate stats
  const totalRuns = calculationRuns.length;
  const lastRun = calculationRuns[0];
  const completedRuns = calculationRuns.filter((r) => r.status === 'Completed');
  const validDurations = completedRuns
    .map((r) => {
      const start = new Date(r.startedAt).getTime();
      const end = new Date(r.completedAt).getTime();
      const diff = end - start;
      return Number.isFinite(diff) && diff > 0 ? diff / 1000 : null;
    })
    .filter((d) => d !== null);
  const avgDuration =
    validDurations.length > 0
      ? validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length
      : 0;

  const avgDurationFormatted = (() => {
    const mins = Math.floor(avgDuration / 60);
    const secs = Math.floor(avgDuration % 60);
    return `${mins}m ${secs}s`;
  })();

  const computeForecast = (baselinePeriod, horizon, inflation) => {
    const baseRows = costData.filter((c) => c.period === baselinePeriod);
    // Sum baseline by country & component
    const byCountry = {};
    baseRows.forEach((row) => {
      const emp = employeeMap?.[row.employeeId] || employees.find((e) => e.id === row.employeeId);
      const cc = emp?.countryCode || 'US';
      if (!byCountry[cc]) byCountry[cc] = { salary: 0, benefits: 0, overhead: 0 };
      byCountry[cc].salary += row.direct?.total || 0;
      byCountry[cc].benefits += row.benefits?.total || 0;
      byCountry[cc].overhead += row.overhead?.total || 0;
    });
    const baselineTotal = Object.values(byCountry).reduce(
      (s, v) => s + v.salary + v.benefits + v.overhead,
      0
    );
    const baseYear = parseInt(String(baselinePeriod).slice(0, 4), 10) || new Date().getFullYear();
    const years = [];
    for (let y = 1; y <= horizon; y++) {
      let total = 0;
      Object.entries(byCountry).forEach(([cc, comp]) => {
        const rates = inflation[cc] || { salary: 4, benefits: 6, overhead: 3 };
        total += comp.salary * Math.pow(1 + rates.salary / 100, y);
        total += comp.benefits * Math.pow(1 + rates.benefits / 100, y);
        total += comp.overhead * Math.pow(1 + rates.overhead / 100, y);
      });
      years.push({ year: baseYear + y, period: `${baseYear + y} (Forecast)`, totalCostToCompany: total });
    }
    return { baselineTotal, years };
  };

  const handleNewCalculation = (data) => {
    const isForecast = data.type === 'Forecast';
    let forecastYears = null;
    let forecastTotal = 0;
    if (isForecast) {
      const fc = computeForecast(data.period, data.horizonYears, data.inflation);
      forecastYears = fc.years;
      forecastTotal = forecastYears[forecastYears.length - 1]?.totalCostToCompany || 0;
    }
    const newRun = {
      id: `${isForecast ? 'FCT' : 'RUN'}-${String(calculationRuns.length + 1).padStart(3, '0')}`,
      period: data.period,
      status: 'Running',
      startedAt: new Date().toISOString(),
      completedAt: null,
      employeeCount: employees.filter((e) => e.status === 'Active').length,
      totalCostToCompany: 0,
      initiatedBy: 'pranav@burdencorp.com',
      type: data.type,
      notes: data.notes,
      isForecast,
      forecastYears,
      inflationConfig: isForecast ? data.inflation : null,
      horizonYears: data.horizonYears || null,
    };

    // Add to runs with Running status
    setCalculationRuns((prev) => [newRun, ...prev]);
    setRunningRunIds((prev) => new Set([...prev, newRun.id]));

    // Simulate completion after 2 seconds
    setTimeout(() => {
      setCalculationRuns((prev) =>
        prev.map((run) =>
          run.id === newRun.id
            ? {
                ...run,
                status: 'Completed',
                completedAt: new Date().toISOString(),
                totalCostToCompany: isForecast
                  ? forecastTotal
                  : costData
                      .filter((c) => c.period === run.period)
                      .reduce((sum, c) => sum + c.totalCostToCompany, 0) || 0,
              }
            : run
        )
      );
      setRunningRunIds((prev) => {
        const updated = new Set(prev);
        updated.delete(newRun.id);
        return updated;
      });

      // Add audit entry
      addAuditEntry({
        action: 'Calculation Run Completed',
        target: newRun.id,
        details: `${data.type} calculation for ${data.period} - ${newRun.employeeCount} employees processed`,
        category: 'Calculation',
      });
    }, 2000);
  };

  // Prepare trend data — actuals plus optional forecast extension from latest forecast run
  const latestForecast = calculationRuns.find((r) => r.isForecast && r.forecastYears);
  const actualsTrend = (periodData || []).map((pd) => ({
    period: pd.period,
    actual: pd.totalCostToCompany,
    forecast: null,
  }));
  let trendData = actualsTrend;
  if (latestForecast && actualsTrend.length > 0) {
    const lastActual = actualsTrend[actualsTrend.length - 1];
    // Bridge point so the dashed line connects visually
    const forecastSeries = [
      { period: lastActual.period, actual: lastActual.actual, forecast: lastActual.actual },
      ...latestForecast.forecastYears.map((fy) => ({
        period: fy.period,
        actual: null,
        forecast: fy.totalCostToCompany,
      })),
    ];
    trendData = [
      ...actualsTrend.slice(0, -1),
      ...forecastSeries,
    ];
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Calculation Runs</h1>
            <p className="text-gray-600 mt-1">
              Period-based burden calculation execution and monitoring
            </p>
          </div>
          <button
            onClick={() => setIsDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <Play className="w-4 h-4" />
            Run New Calculation
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Runs"
            value={totalRuns}
            subtitle="All periods"
            icon={Activity}
          />
          <StatCard
            title="Last Run Status"
            value={lastRun ? lastRun.status : '-'}
            subtitle={lastRun ? formatDate(lastRun.startedAt) : 'No runs'}
            icon={CheckCircle}
          />
          <StatCard
            title="Avg Processing Time"
            value={avgDurationFormatted}
            subtitle="Across completed runs"
            icon={Clock}
          />
        </div>

        {/* Trend Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Total Burden Cost Trend</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="period" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                }}
                formatter={(value) => formatCurrency(value)}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actuals"
                stroke={COLORS.direct}
                strokeWidth={2}
                dot={{ fill: COLORS.direct, r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                name="Forecast"
                stroke="#a855f7"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ fill: '#a855f7', r: 4 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Run History Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Run History</h2>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showForecasts}
                onChange={(e) => setShowForecasts(e.target.checked)}
                className="rounded"
              />
              Show forecast runs
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-700 py-3 px-6">Run ID</th>
                  <th className="text-left text-xs font-semibold text-gray-700 py-3 px-6">Period</th>
                  <th className="text-left text-xs font-semibold text-gray-700 py-3 px-6">Type</th>
                  <th className="text-left text-xs font-semibold text-gray-700 py-3 px-6">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-700 py-3 px-6">Started</th>
                  <th className="text-right text-xs font-semibold text-gray-700 py-3 px-6">Duration</th>
                  <th className="text-right text-xs font-semibold text-gray-700 py-3 px-6">Employees</th>
                  <th className="text-right text-xs font-semibold text-gray-700 py-3 px-6">Total Burden Cost</th>
                  <th className="text-left text-xs font-semibold text-gray-700 py-3 px-6">Initiated By</th>
                  <th className="text-right text-xs font-semibold text-gray-700 py-3 px-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {calculationRuns.filter((r) => showForecasts || !r.isForecast).map((run) => (
                  <tr key={run.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="text-sm font-medium text-blue-600 py-4 px-6">{run.id}</td>
                    <td className="text-sm text-gray-900 py-4 px-6">{run.period}</td>
                    <td className="text-sm text-gray-700 py-4 px-6">
                      {run.type}
                      {run.isForecast && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
                          {run.horizonYears}Y
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="text-sm text-gray-700 py-4 px-6">{formatDate(run.startedAt)}</td>
                    <td className="text-sm text-gray-700 py-4 px-6 text-right font-medium">
                      {formatDuration(run.startedAt, run.completedAt)}
                    </td>
                    <td className="text-sm text-gray-700 py-4 px-6 text-right">
                      {run.employeeCount}
                    </td>
                    <td className="text-sm font-semibold text-gray-900 py-4 px-6 text-right">
                      {formatCurrency(run.totalCostToCompany)}
                    </td>
                    <td className="text-sm text-gray-600 py-4 px-6">{run.initiatedBy}</td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedRun(run)}
                          className="p-1 hover:bg-gray-200 rounded transition text-gray-600 hover:text-gray-900"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1 hover:bg-gray-200 rounded transition text-gray-600 hover:text-gray-900"
                          title="Re-run"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <NewCalculationDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onExecute={handleNewCalculation}
        periods={periods}
      />
      <RunDetailsPanel
        run={selectedRun}
        costData={costData}
        employees={employees}
        onClose={() => setSelectedRun(null)}
      />
    </div>
  );
};

export default CalculationRuns;
