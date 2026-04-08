import React, { useState, useMemo } from 'react';
import {
  ChevronUp, ChevronDown, Download, Filter, X,
  ChevronLeft, ChevronRight, TrendingUp, DollarSign
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import FlagIcon from '../FlagIcon';
import {
  formatUSD, formatLocalCurrency, formatLocalCurrencyFull,
  formatLocalRate, formatFxRate, getCurrencyInfo,
} from '../../utils/currency.js';
import { useEmployeeFilters } from '../../hooks/useEmployeeFilters';
import FilterBar from '../FilterBar';
import { exportCSV } from '../../utils/csvExport';

// Helper: Format currency (USD)
function formatCurrency(val) {
  return formatUSD(val);
}

// Helper: Get country flag emoji
function getCountryFlag(code) {
  const codeUpper = code.toUpperCase();
  const codePoints = codeUpper
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Trend sparkline component - simple inline SVG
function BurdenRateTrend({ employeeId, costData, periods, selectedPeriod }) {
  // Get all periods in order, then filter to include current and previous
  const allPeriods = periods.slice().reverse(); // Most recent first

  const costs = allPeriods
    .map(period => {
      const cost = costData.find(c => c.employeeId === employeeId && c.period === period);
      return cost ? cost.burdenRate : null;
    })
    .filter(v => v !== null);

  if (costs.length === 0) return <span className="text-gray-400 text-sm">No data</span>;

  const max = Math.max(...costs);
  const min = Math.min(...costs);
  const range = max === min ? 1 : max - min;

  // Normalize values for sparkline (0-100)
  const normalized = costs.map(v => ((v - min) / range) * 100);

  const width = 60;
  const height = 24;
  const points = normalized
    .map((v, i) => `${(i / (normalized.length - 1 || 1)) * width},${height - (v / 100) * (height - 4)}`)
    .join(' ');

  return (
    <svg width={width} height={height} className="inline-block" viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function EmployeeRoster() {
  const {
    employees,
    costData,
    selectedPeriod,
    countries,
    jobCodes,
    departments,
    companyCodes,
    periods,
  } = useApp();

  // Shared filter state (search, country, vertical, job family, status)
  const filters = useEmployeeFilters(employees);
  const {
    searchText, filterCountry, filterCompanyCode, filterJobFamily, filterStatus,
    filteredEmployees, hasFilters,
  } = filters;

  const [sortField, setSortField] = useState('id');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState(null);

  const ROWS_PER_PAGE = 25;

  // Get cost data for current period
  const currentCosts = useMemo(() => {
    const map = {};
    costData
      .filter(c => c.period === selectedPeriod)
      .forEach(c => {
        map[c.employeeId] = c;
      });
    return map;
  }, [costData, selectedPeriod]);

  // Sort the filtered employees provided by the shared hook
  const filteredAndSorted = useMemo(() => {
    const result = [...filteredEmployees];
    result.sort((a, b) => {
      let aVal, bVal;

      if (sortField === 'id') {
        aVal = a.id;
        bVal = b.id;
      } else if (sortField === 'name') {
        aVal = a.fullName;
        bVal = b.fullName;
      } else if (sortField === 'jobTitle') {
        aVal = a.jobTitle;
        bVal = b.jobTitle;
      } else if (sortField === 'department') {
        aVal = a.departmentName;
        bVal = b.departmentName;
      } else if (sortField === 'country') {
        aVal = a.countryName;
        bVal = b.countryName;
      } else if (sortField === 'baseSalary') {
        aVal = a.baseSalaryUSD;
        bVal = b.baseSalaryUSD;
      } else if (sortField === 'burdenRate') {
        aVal = currentCosts[a.id]?.burdenRate || 0;
        bVal = currentCosts[b.id]?.burdenRate || 0;
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [filteredEmployees, sortField, sortDir, currentCosts]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSorted.length / ROWS_PER_PAGE);
  const paginatedEmployees = filteredAndSorted.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchText, filterCountry, filterJobFamily, filterCompanyCode, filterStatus]);

  // Handle sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Get org path for employee
  const getOrgPath = (emp) => {
    return {
      dept: emp.departmentName,
      cc: emp.costCenterName,
      corp: emp.corporateName,
      country: emp.countryName,
      companyCode: emp.companyCodeName,
    };
  };

  // Export CSV — uses shared utility
  const handleExportCSV = () => {
    const rows = filteredAndSorted.map((emp) => {
      const cost = currentCosts[emp.id] || {};
      const ci = getCurrencyInfo(emp.countryCode);
      return {
        id: emp.id,
        fullName: emp.fullName,
        jobTitle: emp.jobTitle,
        departmentName: emp.departmentName,
        costCenterName: emp.costCenterName,
        countryName: emp.countryName,
        currency: ci.currency,
        baseLocal: Math.round(emp.baseSalaryUSD * ci.fxFromUSD),
        baseUSD: emp.baseSalaryUSD,
        fx: ci.fxFromUSD,
        burdenRate: cost.burdenRate || 0,
        status: emp.status,
        jobCode: emp.jobCode,
        jobLevel: emp.jobLevel,
        jobFamily: emp.jobFamily,
      };
    });
    exportCSV({
      filename: `employee-roster-${selectedPeriod}`,
      columns: [
        { key: 'id', label: 'Employee ID' },
        { key: 'fullName', label: 'Name' },
        { key: 'jobTitle', label: 'Position Title' },
        { key: 'departmentName', label: 'Department' },
        { key: 'costCenterName', label: 'Cost Center' },
        { key: 'countryName', label: 'Country' },
        { key: 'currency', label: 'Currency' },
        { key: 'baseLocal', label: 'Base Salary (Local)' },
        { key: 'baseUSD', label: 'Base Salary (USD)' },
        { key: 'fx', label: 'FX Rate' },
        { key: 'burdenRate', label: 'Burden Rate ($/hr)' },
        { key: 'status', label: 'Status' },
        { key: 'jobCode', label: 'Job Code' },
        { key: 'jobLevel', label: 'Job Level' },
        { key: 'jobFamily', label: 'Job Family' },
      ],
      rows,
    });
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <div className="w-4 h-4" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Employee Roster</h1>
              <p className="text-gray-600 mt-1">
                Viewing {filteredAndSorted.length} of {employees.length} employees for {selectedPeriod}
              </p>
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Filter Bar (shared) */}
        <FilterBar filters={filters} />

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('id')}
                      className="flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900"
                    >
                      ID
                      <SortIcon field="id" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900"
                    >
                      Name
                      <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('jobTitle')}
                      className="flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900"
                    >
                      Position Title
                      <SortIcon field="jobTitle" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('department')}
                      className="flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900"
                    >
                      Department
                      <SortIcon field="department" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">
                    Cost Center
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('country')}
                      className="flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900"
                    >
                      Country
                      <SortIcon field="country" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-right">
                    <button
                      onClick={() => handleSort('baseSalary')}
                      className="flex items-center gap-2 ml-auto font-semibold text-gray-700 hover:text-gray-900"
                    >
                      Base Salary
                      <SortIcon field="baseSalary" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-right">
                    <button
                      onClick={() => handleSort('burdenRate')}
                      className="flex items-center gap-2 ml-auto font-semibold text-gray-700 hover:text-gray-900"
                    >
                      Burden Rate
                      <SortIcon field="burdenRate" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedEmployees.map((emp, idx) => {
                  const cost = currentCosts[emp.id];
                  const isExpanded = expandedEmployeeId === emp.id;

                  return (
                    <React.Fragment key={emp.id}>
                      <tr
                        onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
                        className={`border-b border-gray-200 cursor-pointer transition ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        } hover:bg-blue-50`}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-blue-600">
                          {emp.id}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                          {emp.fullName}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {emp.jobTitle}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {emp.departmentName}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {emp.costCenterName}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <span className="mr-2"><FlagIcon code={emp.countryCode} size={18} /></span>
                          {emp.countryName}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-900 font-medium">
                          <div>{formatLocalCurrencyFull(emp.baseSalaryUSD, getCurrencyInfo(emp.countryCode).symbol, getCurrencyInfo(emp.countryCode).fxFromUSD)}</div>
                          {emp.countryCode !== 'US' && (
                            <div className="text-xs text-gray-400">{formatCurrency(emp.baseSalaryUSD)}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-900 font-medium">
                          {cost ? (() => {
                            const ci = getCurrencyInfo(emp.countryCode);
                            const localRate = cost.burdenRate * ci.fxFromUSD;
                            return (
                              <>
                                <div>{ci.symbol}{localRate.toFixed(2)}/hr</div>
                                {emp.countryCode !== 'US' && (
                                  <div className="text-xs text-gray-400">${cost.burdenRate.toFixed(2)}/hr</div>
                                )}
                              </>
                            );
                          })() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {(() => {
                            const s = emp.status;
                            const cls = s === 'Active' ? 'bg-green-100 text-green-800'
                              : s === 'Terminated' ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800';
                            return (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{s}</span>
                                {s === 'Terminated' && emp.terminationDate && (
                                  <span className="text-[10px] text-gray-500">{emp.terminationDate}</span>
                                )}
                                {s === 'On Leave' && emp.leaveType && (
                                  <span className="text-[10px] text-gray-500">{emp.leaveType}</span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                      </tr>

                      {/* Expanded Detail Row */}
                      {isExpanded && (
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <td colSpan="9" className="px-6 py-6">
                            <div className="grid grid-cols-2 gap-8">
                              {/* Left: Org Path & Employee Details */}
                              <div>
                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                  <Filter className="w-4 h-4" />
                                  Organization Path
                                </h3>
                                <div className="space-y-2 text-sm text-gray-700 font-medium">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Corporate:</span>
                                    <span>{emp.corporateName}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Country:</span>
                                    <span className="inline-flex items-center gap-1.5"><FlagIcon code={emp.countryCode} size={16} /> {emp.countryName}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Vertical:</span>
                                    <span>{emp.companyCodeName}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Department:</span>
                                    <span>{emp.departmentName}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Cost Center:</span>
                                    <span>{emp.costCenterName}</span>
                                  </div>
                                </div>

                                <h3 className="font-semibold text-gray-900 mb-4 mt-6 flex items-center gap-2">
                                  <DollarSign className="w-4 h-4" />
                                  Employee Details
                                </h3>
                                <div className="space-y-2 text-sm text-gray-700 font-medium">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Job Code:</span>
                                    <span>{emp.jobCode}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Job Level:</span>
                                    <span>{emp.jobLevel}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Job Family:</span>
                                    <span>{emp.jobFamily}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">FTE:</span>
                                    <span>{emp.fte === 1.0 ? 'Full-time' : `${emp.fte * 100}%`}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Email:</span>
                                    <span className="text-blue-600">{emp.email}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Start Date:</span>
                                    <span>{emp.startDate}</span>
                                  </div>
                                </div>

                                {/* Lifecycle events */}
                                {(emp.status === 'Terminated' || emp.status === 'On Leave' || (emp.assignmentHistory && emp.assignmentHistory.length > 1)) && (
                                  <>
                                    <h3 className="font-semibold text-gray-900 mb-3 mt-6 flex items-center gap-2">
                                      <Filter className="w-4 h-4" />
                                      Lifecycle
                                    </h3>
                                    <div className="space-y-2 text-sm text-gray-700">
                                      {emp.status === 'Terminated' && (
                                        <div className="bg-red-50 border border-red-200 rounded p-3">
                                          <div className="font-medium text-red-900 mb-1">Terminated</div>
                                          <div className="flex justify-between"><span className="text-red-700">Date:</span><span>{emp.terminationDate}</span></div>
                                          <div className="flex justify-between"><span className="text-red-700">Reason:</span><span>{emp.terminationReason}</span></div>
                                        </div>
                                      )}
                                      {emp.status === 'On Leave' && (
                                        <div className="bg-amber-50 border border-amber-200 rounded p-3">
                                          <div className="font-medium text-amber-900 mb-1">{emp.leaveType} ({emp.leaveStatus})</div>
                                          <div className="flex justify-between"><span className="text-amber-700">From:</span><span>{emp.leaveStart}</span></div>
                                          <div className="flex justify-between"><span className="text-amber-700">Expected Return:</span><span>{emp.leaveEnd}</span></div>
                                        </div>
                                      )}
                                      {emp.assignmentHistory && emp.assignmentHistory.length > 1 && (
                                        <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                          <div className="font-medium text-blue-900 mb-2">Assignment History</div>
                                          <div className="space-y-1.5">
                                            {emp.assignmentHistory.map((a, i) => (
                                              <div key={i} className="text-xs text-blue-800 flex justify-between gap-2">
                                                <span>{a.effectiveFrom} → {a.effectiveTo || 'present'}</span>
                                                <span className="text-blue-600">{a.reason}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Right: Cost Breakdown */}
                              <div>
                                {cost ? (() => {
                                  const ci = getCurrencyInfo(emp.countryCode);
                                  const isUSD = emp.countryCode === 'US';
                                  const sym = ci.symbol;
                                  const fx = ci.fxFromUSD;
                                  const fmtL = (v) => formatLocalCurrencyFull(v, sym, fx);
                                  return (
                                  <>
                                    <div className="flex items-center justify-between mb-4">
                                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4" />
                                        Cost Breakdown ({selectedPeriod})
                                      </h3>
                                      {!isUSD && (
                                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">
                                          1 USD = {fx} {ci.currency}
                                        </span>
                                      )}
                                    </div>

                                    <div className="space-y-3 mb-6">
                                      <div className="bg-white rounded border border-gray-200 p-3">
                                        <div className="flex justify-between mb-1">
                                          <span className="text-sm text-gray-600">Total Burden Cost:</span>
                                          <div className="text-right">
                                            <span className="font-semibold text-gray-900">{fmtL(cost.totalCostToCompany)}</span>
                                            {!isUSD && <div className="text-xs text-gray-400">{formatCurrency(cost.totalCostToCompany)}</div>}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="space-y-2 text-sm">
                                        <div className="bg-blue-50 rounded border border-blue-200 p-3">
                                          <div className="font-medium text-blue-900 mb-2">Direct Costs</div>
                                          <div className="space-y-1 text-blue-800">
                                            <div className="flex justify-between">
                                              <span className="text-xs">Payroll:</span>
                                              <span>{fmtL(cost.direct.payroll)}</span>
                                            </div>
                                            {cost.direct.bonus > 0 && (
                                              <div className="flex justify-between">
                                                <span className="text-xs">Bonus:</span>
                                                <span>{fmtL(cost.direct.bonus)}</span>
                                              </div>
                                            )}
                                            {cost.direct.shiftDifferential > 0 && (
                                              <div className="flex justify-between">
                                                <span className="text-xs">Shift Diff:</span>
                                                <span>{fmtL(cost.direct.shiftDifferential)}</span>
                                              </div>
                                            )}
                                            {cost.direct.overtime > 0 && (
                                              <div className="flex justify-between">
                                                <span className="text-xs">Overtime:</span>
                                                <span>{fmtL(cost.direct.overtime)}</span>
                                              </div>
                                            )}
                                            <div className="flex justify-between font-medium border-t border-blue-300 pt-1 mt-1">
                                              <span>Total:</span>
                                              <span>{fmtL(cost.direct.total)}</span>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="bg-green-50 rounded border border-green-200 p-3">
                                          <div className="font-medium text-green-900 mb-1">Benefits</div>
                                          <div className="flex justify-between text-green-800">
                                            <span className="text-xs">Total:</span>
                                            <span>{fmtL(cost.benefits.total)}</span>
                                          </div>
                                        </div>

                                        <div className="bg-orange-50 rounded border border-orange-200 p-3">
                                          <div className="font-medium text-orange-900 mb-1">Overhead</div>
                                          <div className="flex justify-between text-orange-800">
                                            <span className="text-xs">Total:</span>
                                            <span>{fmtL(cost.overhead.total)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Burden Rate Trend */}
                                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                                      Burden Rate Trend
                                    </h4>
                                    <div className="bg-white rounded border border-gray-200 p-3">
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs text-gray-600">Last 6 periods</span>
                                        <BurdenRateTrend
                                          employeeId={emp.id}
                                          costData={costData}
                                          periods={periods}
                                          selectedPeriod={selectedPeriod}
                                        />
                                      </div>
                                      <div className="text-sm font-medium text-gray-900">
                                        Current: ${cost.burdenRate.toFixed(2)}/hr
                                      </div>
                                      <div className="text-xs text-gray-600">
                                        Productive Hours: {cost.productiveHours.toFixed(1)}
                                      </div>
                                    </div>
                                  </>
                                  );
                                })() : (
                                  <div className="text-gray-500">No cost data available for this period</div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-600">
            Showing {Math.min((currentPage - 1) * ROWS_PER_PAGE + 1, filteredAndSorted.length)} to{' '}
            {Math.min(currentPage * ROWS_PER_PAGE, filteredAndSorted.length)} of {filteredAndSorted.length}{' '}
            employees
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>

            <div className="flex items-center px-3 py-2 text-sm font-medium text-gray-700">
              Page {currentPage} of {totalPages || 1}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
