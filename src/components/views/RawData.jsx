import React, { useState, useMemo } from 'react';
import { Database } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { benefitCategories, overheadCategories } from '../../data/orgHierarchy';
import { formatByCountry } from '../../utils/currency';
import { useEmployeeFilters } from '../../hooks/useEmployeeFilters';
import FilterBar from '../FilterBar';
import DataTable from '../DataTable';
import PageHeader from '../PageHeader';
import FlagIcon from '../FlagIcon';
import StatusBadge from '../StatusBadge';

const TABS = [
  { id: 'employees', label: 'Employee Master' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'benefits', label: 'Benefits' },
  { id: 'overhead', label: 'Overhead' },
];

const fmtLocal = (usd, row) => formatByCountry(usd, row._countryCode);

const fmtCountry = (name, row) => (
  <span className="inline-flex items-center gap-2">
    <FlagIcon code={row._countryCode} size={18} />
    <span>{name}</span>
  </span>
);

const fmtStatus = (s) => <StatusBadge status={s} />;

export default function RawData() {
  const { employees, costData, selectedPeriod, employeeMap } = useApp();
  const [activeTab, setActiveTab] = useState('employees');

  const filters = useEmployeeFilters(employees);
  const { filteredEmployees } = filters;

  const filteredEmpIds = useMemo(
    () => new Set(filteredEmployees.map((e) => e.id)),
    [filteredEmployees]
  );

  const periodCosts = useMemo(
    () =>
      costData.filter(
        (c) => c.period === selectedPeriod && filteredEmpIds.has(c.employeeId)
      ),
    [costData, selectedPeriod, filteredEmpIds]
  );

  // Employee Master
  const employeeRows = useMemo(
    () => filteredEmployees.map((e) => ({ ...e, _countryCode: e.countryCode })),
    [filteredEmployees]
  );
  const employeeColumns = [
    { key: 'id', label: 'Employee ID' },
    { key: 'fullName', label: 'Name' },
    { key: 'jobTitle', label: 'Title' },
    { key: 'jobFamily', label: 'Job Family' },
    { key: 'departmentName', label: 'Department' },
    { key: 'countryName', label: 'Country', format: fmtCountry },
    { key: 'status', label: 'Status', format: fmtStatus },
    { key: 'fte', label: 'FTE' },
    { key: 'baseSalaryUSD', label: 'Base Salary (Local)', format: fmtLocal },
  ];

  // Payroll
  const payrollRows = useMemo(
    () =>
      periodCosts.map((c) => {
        const emp = employeeMap[c.employeeId] || {};
        return {
          _countryCode: emp.countryCode,
          employeeId: c.employeeId,
          fullName: emp.fullName,
          period: c.period,
          countryName: emp.countryName,
          currency: c.localCurrency,
          payroll: c.direct?.payroll,
          bonus: c.direct?.bonus,
          shiftDifferential: c.direct?.shiftDifferential,
          overtime: c.direct?.overtime,
          total: c.direct?.total,
        };
      }),
    [periodCosts, employeeMap]
  );
  const payrollColumns = [
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'fullName', label: 'Name' },
    { key: 'period', label: 'Period' },
    { key: 'countryName', label: 'Country', format: fmtCountry },
    { key: 'currency', label: 'Currency' },
    { key: 'payroll', label: 'Base Pay', format: fmtLocal },
    { key: 'bonus', label: 'Bonus', format: fmtLocal },
    { key: 'shiftDifferential', label: 'Shift Diff', format: fmtLocal },
    { key: 'overtime', label: 'Overtime', format: fmtLocal },
    { key: 'total', label: 'Total Direct', format: fmtLocal },
  ];

  // Benefits
  const benefitRows = useMemo(
    () =>
      periodCosts.map((c) => {
        const emp = employeeMap[c.employeeId] || {};
        const row = {
          _countryCode: emp.countryCode,
          employeeId: c.employeeId,
          fullName: emp.fullName,
          period: c.period,
          countryName: emp.countryName,
          currency: c.localCurrency,
        };
        for (const bc of benefitCategories) row[bc.id] = c.benefits?.[bc.id] ?? 0;
        row.total = c.benefits?.total;
        return row;
      }),
    [periodCosts, employeeMap]
  );
  const benefitColumns = [
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'fullName', label: 'Name' },
    { key: 'countryName', label: 'Country', format: fmtCountry },
    { key: 'currency', label: 'Currency' },
    ...benefitCategories.map((bc) => ({ key: bc.id, label: bc.name, format: fmtLocal })),
    { key: 'total', label: 'Total Benefits', format: fmtLocal },
  ];

  // Overhead — by Cost Center rollup
  const overheadByCC = useMemo(() => {
    const map = {};
    for (const c of periodCosts) {
      const emp = employeeMap[c.employeeId] || {};
      const key = emp.costCenterId || 'UNKNOWN';
      if (!map[key]) {
        map[key] = {
          _countryCode: emp.countryCode,
          costCenterId: emp.costCenterId,
          costCenterName: emp.costCenterName,
          departmentName: emp.departmentName,
          countryName: emp.countryName,
          currency: c.localCurrency,
          headcount: 0,
          total: 0,
        };
        for (const oc of overheadCategories) map[key][oc.id] = 0;
      }
      map[key].headcount += 1;
      for (const oc of overheadCategories) map[key][oc.id] += c.overhead?.[oc.id] ?? 0;
      map[key].total += c.overhead?.total ?? 0;
    }
    return Object.values(map);
  }, [periodCosts, employeeMap]);

  const overheadCCColumns = [
    { key: 'costCenterId', label: 'Cost Center ID' },
    { key: 'costCenterName', label: 'Cost Center' },
    { key: 'departmentName', label: 'Department' },
    { key: 'countryName', label: 'Country', format: fmtCountry },
    { key: 'currency', label: 'Currency' },
    { key: 'headcount', label: 'Headcount' },
    ...overheadCategories.map((oc) => ({ key: oc.id, label: oc.name, format: fmtLocal })),
    { key: 'total', label: 'Total Overhead', format: fmtLocal },
  ];

  return (
    <div className="p-8 max-w-[1600px] w-full mx-auto">
      <PageHeader
        icon={Database}
        title="Raw Data"
        subtitle={`Source records as received — period ${selectedPeriod}, displayed in local currency`}
      />

      <FilterBar filters={filters} />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="border-b border-gray-200 px-6">
          <nav className="flex gap-1">
            {TABS.map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'employees' && <DataTable rows={employeeRows} columns={employeeColumns} />}
          {activeTab === 'payroll' && <DataTable rows={payrollRows} columns={payrollColumns} />}
          {activeTab === 'benefits' && <DataTable rows={benefitRows} columns={benefitColumns} />}
          {activeTab === 'overhead' && <DataTable rows={overheadByCC} columns={overheadCCColumns} />}
        </div>
      </div>
    </div>
  );
}
