import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Globe, BarChart3, Table } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import FlagIcon from '../FlagIcon';
import { formatUSD, formatLocalCurrency, getCurrencyInfo, getFxRateSummary } from '../../utils/currency.js';

const COLORS = {
  palette: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'],
};

const formatCurrency = (value) => formatUSD(value);
const formatRate = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '$0.00/hr';
  return `$${parseFloat(value).toFixed(2)}/hr`;
};

const CountryDistribution = () => {
  const { selectedPeriod, costData, employeeMap } = useApp();
  const [countryView, setCountryView] = useState('chart');
  const [selectedCountry, setSelectedCountry] = useState(null);

  const { jobFamilies, countryDetails, grandTotal } = useMemo(() => {
    if (!costData || !employeeMap) return { jobFamilies: [], countryDetails: [], grandTotal: 0 };
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

    return { jobFamilies: families, countryDetails: details, grandTotal: gt };
  }, [costData, employeeMap, selectedPeriod]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Total Burden Cost by Country</h2>
              <p className="text-sm text-gray-500">Job family breakup across {countryDetails.length} countries — {selectedPeriod} — Aggregated in USD</p>
            </div>
          </div>
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setCountryView('chart')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                countryView === 'chart' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Chart
            </button>
            <button
              onClick={() => setCountryView('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                countryView === 'table' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Table className="w-3.5 h-3.5" /> Table
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100">
        <div className="flex gap-3 overflow-x-auto pb-1">
          {countryDetails.map((c) => {
            const pct = grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : 0;
            const isSelected = selectedCountry === c.code;
            const localTotal = formatLocalCurrency(c.total, c.currencySymbol, c.fxFromUSD);
            const isUSD = c.code === 'US';
            return (
              <button
                key={c.code}
                onClick={() => setSelectedCountry(isSelected ? null : c.code)}
                className={`flex-shrink-0 rounded-lg border px-4 py-3 text-left transition ${
                  isSelected
                    ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                    : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm'
                }`}
                style={{ minWidth: '160px' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <FlagIcon code={c.code} size={20} />
                  <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                </div>
                <div className="text-lg font-bold text-gray-900">{localTotal}</div>
                {!isUSD && (
                  <div className="text-xs text-blue-600 font-medium">{formatCurrency(c.total)} USD</div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">{pct}%</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500">{c.employeeCount} emp</span>
                  {!isUSD && (
                    <>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-400">{c.currencySymbol}{c.fxFromUSD}/$</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6">
        {countryView === 'chart' ? (
          <>
            {(() => {
              const pieData = countryDetails.map((c, i) => ({
                name: c.name,
                value: c.total,
                code: c.code,
                fill: COLORS.palette[i % COLORS.palette.length],
              }));
              const filteredPie = selectedCountry
                ? pieData.filter(d => d.code === selectedCountry)
                : pieData;
              return (
                <div className="flex items-center">
                  <ResponsiveContainer width="60%" height={340}>
                    <PieChart>
                      <Pie
                        data={filteredPie}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={140}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value, percent }) => `${name} ${formatCurrency(value)} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                      >
                        {filteredPie.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                        formatter={(value) => [formatCurrency(value)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full lg:w-[40%] space-y-3 pl-4">
                    {filteredPie.map((item) => {
                      const pct = grandTotal > 0 ? ((item.value / grandTotal) * 100).toFixed(1) : 0;
                      return (
                        <div key={item.code} className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.fill }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <FlagIcon code={item.code} size={16} />
                              <span className="text-sm font-medium text-gray-800 truncate">{item.name}</span>
                            </div>
                            <div className="text-xs text-gray-500">{formatCurrency(item.value)} ({pct}%)</div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-3 border-t border-gray-200">
                      <div className="text-sm font-bold text-gray-900">
                        Total: {formatCurrency(grandTotal)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {selectedCountry && (() => {
              const detail = countryDetails.find(c => c.code === selectedCountry);
              if (!detail) return null;
              const familyEntries = Object.entries(detail.families).sort((a, b) => b[1].total - a[1].total);
              const isUSD = detail.code === 'US';
              const sym = detail.currencySymbol;
              const fx = detail.fxFromUSD;
              const fmtLocal = (v) => formatLocalCurrency(v, sym, fx);
              return (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FlagIcon code={detail.code} size={24} />
                      <h3 className="text-base font-semibold text-gray-900">{detail.name} — Job Family Breakdown</h3>
                    </div>
                    {!isUSD && (
                      <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg">
                        <span className="text-xs text-blue-700 font-medium">FX Rate:</span>
                        <span className="text-xs text-blue-900 font-semibold">1 USD = {fx} {detail.currencyCode}</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                    <div className="bg-blue-50 rounded-lg px-4 py-3">
                      <div className="text-xs text-blue-600 font-medium">Direct Costs</div>
                      <div className="text-base font-bold text-blue-800 mt-1">{fmtLocal(detail.directTotal)}</div>
                      {!isUSD && <div className="text-xs text-blue-500 mt-0.5">{formatCurrency(detail.directTotal)}</div>}
                    </div>
                    <div className="bg-green-50 rounded-lg px-4 py-3">
                      <div className="text-xs text-green-600 font-medium">Benefits</div>
                      <div className="text-base font-bold text-green-800 mt-1">{fmtLocal(detail.benefitTotal)}</div>
                      {!isUSD && <div className="text-xs text-green-500 mt-0.5">{formatCurrency(detail.benefitTotal)}</div>}
                    </div>
                    <div className="bg-amber-50 rounded-lg px-4 py-3">
                      <div className="text-xs text-amber-600 font-medium">Overhead</div>
                      <div className="text-base font-bold text-amber-800 mt-1">{fmtLocal(detail.overheadTotal)}</div>
                      {!isUSD && <div className="text-xs text-amber-500 mt-0.5">{formatCurrency(detail.overheadTotal)}</div>}
                    </div>
                    <div className="bg-purple-50 rounded-lg px-4 py-3">
                      <div className="text-xs text-purple-600 font-medium">Avg Burden Rate</div>
                      <div className="text-base font-bold text-purple-800 mt-1">{formatRate(detail.avgBurdenRate)}</div>
                      <div className="text-xs text-purple-500 mt-0.5">USD/hr</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {familyEntries.map(([family, data]) => {
                      const pct = detail.total > 0 ? (data.total / detail.total) * 100 : 0;
                      return (
                        <div key={family} className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS.palette[jobFamilies.indexOf(family) % COLORS.palette.length] }} />
                          <span className="text-sm font-medium text-gray-800 w-32">{family}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: COLORS.palette[jobFamilies.indexOf(family) % COLORS.palette.length] }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-24 text-right">{fmtLocal(data.total)}</span>
                          {!isUSD && <span className="text-xs text-gray-400 w-16 text-right">{formatCurrency(data.total)}</span>}
                          <span className="text-xs text-gray-400 w-12 text-right">{pct.toFixed(1)}%</span>
                          <span className="text-xs text-gray-400 w-16 text-right">{data.count} emp</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <div className="overflow-x-auto">
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold text-blue-800">Exchange Rates (Apr 2026)</span>
                <span className="text-xs text-blue-600">— Aggregated totals in USD</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {getFxRateSummary().map(fx => (
                  <span key={fx.code} className="text-xs text-blue-700">
                    {fx.symbol}1 = ${fx.fxToUSD.toFixed(fx.fxToUSD < 0.1 ? 4 : 2)} USD
                  </span>
                ))}
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-3">Country</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase py-3 px-3">Local CTC</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase py-3 px-3">USD CTC</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase py-3 px-3">FX Rate</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase py-3 px-3">% Share</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase py-3 px-3">Emp</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase py-3 px-3">Rate $/hr</th>
                  {jobFamilies.map(f => (
                    <th key={f} className="text-right text-xs font-semibold text-gray-500 uppercase py-3 px-2" style={{ minWidth: '80px' }}>{f}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {countryDetails.map((c, idx) => {
                  const pct = grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : 0;
                  const isUSD = c.code === 'US';
                  return (
                    <tr key={c.code} className={`border-b border-gray-50 ${idx % 2 !== 0 ? 'bg-gray-50/50' : ''}`}>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <FlagIcon code={c.code} size={18} />
                          <div>
                            <span className="text-sm font-medium text-gray-900">{c.name}</span>
                            <div className="text-xs text-gray-400">{c.currencyCode}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm font-semibold text-gray-900 py-3 px-3 text-right">
                        {formatLocalCurrency(c.total, c.currencySymbol, c.fxFromUSD)}
                      </td>
                      <td className="text-sm text-gray-600 py-3 px-3 text-right">{formatCurrency(c.total)}</td>
                      <td className="text-xs text-gray-500 py-3 px-3 text-right font-mono">
                        {isUSD ? '—' : `${c.fxFromUSD}`}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-12 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-10">{pct}%</span>
                        </div>
                      </td>
                      <td className="text-sm text-gray-600 py-3 px-3 text-right">{c.employeeCount}</td>
                      <td className="text-sm font-medium text-gray-800 py-3 px-3 text-right">{formatRate(c.avgBurdenRate)}</td>
                      {jobFamilies.map(f => (
                        <td key={f} className="text-xs text-gray-500 py-3 px-2 text-right">
                          {c.families[f] ? formatCurrency(c.families[f].total) : '—'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <td className="py-3 px-3 text-sm text-gray-900">Total (USD)</td>
                  <td className="py-3 px-3 text-xs text-gray-500 text-right italic">mixed</td>
                  <td className="py-3 px-3 text-sm text-gray-900 text-right">{formatCurrency(grandTotal)}</td>
                  <td className="py-3 px-3"></td>
                  <td className="py-3 px-3 text-xs text-gray-500 text-right">100%</td>
                  <td className="py-3 px-3 text-sm text-gray-900 text-right">{countryDetails.reduce((s, c) => s + c.employeeCount, 0)}</td>
                  <td className="py-3 px-3"></td>
                  {jobFamilies.map(f => (
                    <td key={f} className="py-3 px-2 text-xs text-gray-700 text-right">
                      {formatCurrency(countryDetails.reduce((s, c) => s + (c.families[f]?.total || 0), 0))}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CountryDistribution;
