import React, { useState, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Copy,
  Archive,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Clock,
  FileText,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import {
  countryBenefitRules,
  getRulesForCountry,
  getCountryBenefitSummary,
  calculateAllBenefits,
  getApplicableRate,
  calculateRuleCost,
} from '../../data/countryBenefitRules';
import { getCurrencyInfo } from '../../utils/currency.js';
import FlagIcon from '../FlagIcon';

const BenefitsConfig = () => {
  const { countries, employees, addAuditEntry } = useApp();

  // State
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [activeTab, setActiveTab] = useState('rules');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [rules, setRules] = useState(countryBenefitRules);
  const [filterType, setFilterType] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');

  // Cost Simulation state — simBaseSalary is in LOCAL currency
  const [simJobLevel, setSimJobLevel] = useState(3);
  const [simYearsService, setSimYearsService] = useState(5);
  const [simBaseSalary, setSimBaseSalary] = useState(5000);

  // Currency info for the selected country
  const currencyInfo = useMemo(() => getCurrencyInfo(selectedCountry), [selectedCountry]);
  const sym = currencyInfo.symbol || '$';
  const fx = currencyInfo.fxFromUSD || 1;
  const fxToUSD = currencyInfo.fxToUSD || 1;
  const isUSD = selectedCountry === 'US';
  const curCode = currencyInfo.currency || 'USD';

  // Format a local currency value with the country's symbol
  const fmtLocal = (v) => `${sym}${Math.round(v).toLocaleString()}`;
  const fmtLocalExact = (v) => `${sym}${v.toFixed(2)}`;

  // Typical monthly base salary by job level (USD), adjusted for tenure.
  // Each year of service adds ~2% to reflect merit raises / progression.
  const salaryByLevelUSD = { 1: 4000, 2: 7000, 3: 10000, 4: 16000, 5: 22000 };
  const getSalaryForProfile = (level, years) => {
    const baseUSD = salaryByLevelUSD[level] || 10000;
    const tenureMultiplier = 1 + (years || 0) * 0.02; // +2% per year of service
    return Math.round(baseUSD * tenureMultiplier * fx / 100) * 100;
  };

  // Convert local salary → USD for internal calculations
  const simBaseSalaryUSD = simBaseSalary * fxToUSD;

  // When country changes, auto-convert the salary to the new currency
  const prevCountryRef = React.useRef(selectedCountry);
  React.useEffect(() => {
    if (prevCountryRef.current !== selectedCountry) {
      const prevInfo = getCurrencyInfo(prevCountryRef.current);
      const prevFxToUSD = prevInfo.fxToUSD || 1;
      const usdAmount = simBaseSalary * prevFxToUSD;
      const newInfo = getCurrencyInfo(selectedCountry);
      const newFxFromUSD = newInfo.fxFromUSD || 1;
      const converted = Math.round(usdAmount * newFxFromUSD / 100) * 100;
      setSimBaseSalary(converted);
      prevCountryRef.current = selectedCountry;
    }
  }, [selectedCountry]);

  // Modal form state
  const [formData, setFormData] = useState({
    id: '',
    countryCode: 'US',
    categoryId: '',
    name: '',
    type: 'statutory',
    contributionSplit: { employer: 50, employee: 50 },
    baseField: 'basePay',
    rate: 0,
    minAmountMonthly: null,
    maxAmountMonthly: null,
    maxBaseMonthly: null,
    regulatoryRef: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    endDate: null,
    version: 1,
    status: 'Active',
    approvedBy: '',
    lastModified: new Date().toISOString().split('T')[0],
    notes: '',
    tiers: [],
  });

  const [tierFormData, setTierFormData] = useState({
    field: 'yearsOfService',
    operator: '>=',
    value: '',
    rate: 0,
    label: '',
  });

  // Country flags
  const countryFlags = {
    US: '🇺🇸',
    IN: '🇮🇳',
    GB: '🇬🇧',
    DE: '🇩🇪',
    JP: '🇯🇵',
    BR: '🇧🇷',
    SG: '🇸🇬',
    AU: '🇦🇺',
  };

  const chartColors = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#f97316',
    '#ec4899',
  ];

  // Get rules for selected country with correct filtering
  const selectedCountryRules = useMemo(() => {
    const countryRules = rules.filter(
      r => r.countryCode === selectedCountry && r.status === 'Active'
    );
    return countryRules.filter((rule) => {
      if (filterType !== 'All' && rule.type !== filterType) return false;
      if (filterCategory !== 'All' && rule.categoryId !== filterCategory) return false;
      return true;
    });
  }, [selectedCountry, rules, filterType, filterCategory]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set();
    rules.forEach((rule) => {
      if (rule.categoryId) cats.add(rule.categoryId);
    });
    return Array.from(cats).sort();
  }, [rules]);

  // Country summary cards - corrected to use country.code
  const countrySummary = useMemo(() => {
    return countries.map((country) => {
      const countryRules = rules.filter(
        r => r.countryCode === country.code && r.status === 'Active'
      );
      const summary = getCountryBenefitSummary(country.code);

      return {
        code: country.code,
        name: country.name,
        totalRules: countryRules.length,
        statutory: summary.statutoryCount,
        sponsored: summary.sponsoredCount,
        totalRate: (summary.totalRate * 100).toFixed(2),
      };
    });
  }, [countries, rules]);

  // Cost simulation calculation — uses USD base salary internally
  const simulationResults = useMemo(() => {
    const applicable = rules.filter(
      r => r.countryCode === selectedCountry && r.status === 'Active'
    );

    const mockEmployee = {
      countryCode: selectedCountry,
      jobLevel: simJobLevel,
      yearsOfService: simYearsService,
      startDate: new Date(new Date().setFullYear(new Date().getFullYear() - simYearsService)).toISOString(),
    };

    // calculateRuleCost expects a USD-equivalent base; convert local → USD
    const baseUSD = simBaseSalary * fxToUSD;

    const results = applicable.map((rule) => {
      const cost = calculateRuleCost(rule, baseUSD, mockEmployee);

      return {
        id: rule.id,
        name: rule.name,
        type: rule.type,
        categoryId: rule.categoryId,
        baseRate: (rule.rate * 100).toFixed(2),
        appliedRate: (cost.rate * 100).toFixed(2),
        appliedBaseUSD: cost.appliedBase,
        appliedBaseLocal: cost.appliedBase * fx,
        employerCostUSD: cost.employer,
        employeeCostUSD: cost.employee,
        totalCostUSD: cost.total,
        employerCostLocal: cost.employer * fx,
        employeeCostLocal: cost.employee * fx,
        totalCostLocal: cost.total * fx,
      };
    });

    const totalEmployerUSD = results.reduce((sum, r) => sum + r.employerCostUSD, 0);
    const totalEmployeeUSD = results.reduce((sum, r) => sum + r.employeeCostUSD, 0);
    const totalEmployerLocal = totalEmployerUSD * fx;
    const totalEmployeeLocal = totalEmployeeUSD * fx;
    const totalBurdenRate = baseUSD > 0
      ? ((totalEmployerUSD / baseUSD) * 100).toFixed(2)
      : '0.00';

    return {
      results,
      totalEmployerCost: totalEmployerUSD,
      totalEmployeeCost: totalEmployeeUSD,
      totalEmployerLocal: totalEmployerLocal,
      totalEmployeeLocal: totalEmployeeLocal,
      totalBurdenRate,
    };
  }, [selectedCountry, simJobLevel, simYearsService, simBaseSalary, rules, fxToUSD, fx]);

  // Cost distribution by category (in local currency)
  const costDistribution = useMemo(() => {
    const dist = {};
    simulationResults.results.forEach((result) => {
      const cat = result.categoryId || 'Other';
      if (!dist[cat]) dist[cat] = 0;
      dist[cat] += result.employerCostLocal;
    });
    return Object.entries(dist).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }));
  }, [simulationResults]);

  // Version history mock data
  const versionHistory = useMemo(() => {
    const allHistory = {
      US: [
        { date: '2026-03-20', name: '401(k) Employer Match', change: 'Tier thresholds updated', version: '3.1', changedBy: 'VP Total Rewards' },
        { date: '2026-03-15', name: 'FICA – Social Security', change: 'Wage base limit updated for 2026', version: '2.2', changedBy: 'Compliance Team' },
        { date: '2026-03-10', name: 'Medical Insurance', change: 'Employer contribution cap increased', version: '2.1', changedBy: 'HR Director' },
        { date: '2026-01-05', name: 'FUTA', change: 'Annual rate confirmed for 2026', version: '1.4', changedBy: 'Payroll Manager' },
      ],
      AU: [
        { date: '2026-02-28', name: 'Superannuation Guarantee', change: 'Rate increased to 11.5%', version: '3.0', changedBy: 'AU Finance Controller' },
        { date: '2026-01-15', name: 'Workers Compensation', change: 'Premium rates adjusted for FY2026', version: '2.3', changedBy: 'AU HR Lead' },
        { date: '2025-11-20', name: 'Payroll Tax (NSW)', change: 'Threshold updated per state revenue office', version: '1.5', changedBy: 'Compliance Team' },
      ],
      IN: [
        { date: '2026-02-20', name: 'Provident Fund (EPF)', change: 'Wage ceiling revised', version: '2.4', changedBy: 'India HR Lead' },
        { date: '2026-02-10', name: 'ESI', change: 'Eligibility criteria revised', version: '2.1', changedBy: 'India HR Lead' },
        { date: '2025-12-01', name: 'Professional Tax', change: 'State slab rates updated', version: '1.3', changedBy: 'Compliance Team' },
      ],
      GB: [
        { date: '2026-02-10', name: 'National Insurance', change: 'Threshold adjustment for new tax year', version: '1.8', changedBy: 'Compliance Team' },
        { date: '2026-01-20', name: 'Workplace Pension', change: 'Auto-enrolment qualifying earnings updated', version: '2.0', changedBy: 'UK Benefits Manager' },
        { date: '2025-11-05', name: 'Apprenticeship Levy', change: 'Pay bill calculation method clarified', version: '1.2', changedBy: 'UK Finance Controller' },
      ],
      DE: [
        { date: '2026-03-01', name: 'Sozialversicherung', change: 'Contribution ceiling (BBG) updated for 2026', version: '2.5', changedBy: 'DE Payroll Lead' },
        { date: '2026-01-10', name: 'Krankenversicherung', change: 'Supplementary rate adjusted', version: '1.9', changedBy: 'Compliance Team' },
        { date: '2025-12-15', name: 'Pflegeversicherung', change: 'Childless surcharge rate increased', version: '1.6', changedBy: 'DE HR Manager' },
      ],
      BR: [
        { date: '2026-02-15', name: 'INSS', change: 'Salary brackets updated for 2026', version: '2.2', changedBy: 'BR Payroll Lead' },
        { date: '2026-01-08', name: 'FGTS', change: 'Monthly deposit rate confirmed at 8%', version: '1.1', changedBy: 'Compliance Team' },
        { date: '2025-11-30', name: '13th Salary', change: 'Calculation methodology clarified', version: '1.4', changedBy: 'BR HR Manager' },
      ],
      JP: [
        { date: '2026-03-05', name: 'Shakai Hoken', change: 'Standard remuneration tiers revised', version: '2.7', changedBy: 'JP Benefits Lead' },
        { date: '2026-01-25', name: 'Kosei Nenkin', change: 'Employer pension contribution rate updated', version: '2.1', changedBy: 'Compliance Team' },
        { date: '2025-12-10', name: 'Koyou Hoken', change: 'Employment insurance rate adjusted', version: '1.5', changedBy: 'JP HR Manager' },
      ],
      SG: [
        { date: '2026-02-05', name: 'CPF', change: 'Contribution rates updated for age bands', version: '3.2', changedBy: 'SG Payroll Lead' },
        { date: '2026-01-12', name: 'Skills Development Levy', change: 'Levy cap confirmed for 2026', version: '1.3', changedBy: 'Compliance Team' },
        { date: '2025-11-18', name: 'Foreign Worker Levy', change: 'Tier rates adjusted', version: '1.7', changedBy: 'SG HR Manager' },
      ],
    };
    return allHistory[selectedCountry] || [];
  }, [selectedCountry]);

  // Modal handlers
  const openNewRuleModal = () => {
    setEditingRule(null);
    setFormData({
      id: `CBR-${selectedCountry}-${Date.now()}`,
      countryCode: selectedCountry,
      categoryId: '',
      name: '',
      type: 'statutory',
      contributionSplit: { employer: 50, employee: 50 },
      baseField: 'basePay',
      rate: 0,
      minAmountMonthly: null,
      maxAmountMonthly: null,
      maxBaseMonthly: null,
      regulatoryRef: '',
      effectiveDate: new Date().toISOString().split('T')[0],
      endDate: null,
      version: 1,
      status: 'Active',
      approvedBy: '',
      lastModified: new Date().toISOString().split('T')[0],
      notes: '',
      tiers: [],
    });
    setShowModal(true);
  };

  const openEditRuleModal = (rule) => {
    setEditingRule(rule.id);
    setFormData({
      ...rule,
      rate: rule.rate,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRule(null);
    setTierFormData({
      field: 'yearsOfService',
      operator: '>=',
      value: '',
      rate: 0,
      label: '',
    });
  };

  const handleSaveRule = () => {
    if (editingRule) {
      const updatedRules = rules.map(r =>
        r.id === editingRule ? { ...formData } : r
      );
      setRules(updatedRules);
    } else {
      setRules([...rules, formData]);
    }
    addAuditEntry({
      action: editingRule ? 'UPDATE_BENEFIT_RULE' : 'CREATE_BENEFIT_RULE',
      entity: 'BenefitRule',
      entityId: formData.id,
      details: { ruleName: formData.name, country: formData.countryCode },
    });
    closeModal();
  };

  const handleAddTier = () => {
    if (tierFormData.value && tierFormData.rate) {
      const newTier = {
        condition: {
          field: tierFormData.field,
          operator: tierFormData.operator,
          value: tierFormData.value,
        },
        rate: tierFormData.rate,
        label: tierFormData.label,
      };
      setFormData({
        ...formData,
        tiers: [...formData.tiers, newTier],
      });
      setTierFormData({
        field: 'yearsOfService',
        operator: '>=',
        value: '',
        rate: 0,
        label: '',
      });
    }
  };

  const handleRemoveTier = (index) => {
    setFormData({
      ...formData,
      tiers: formData.tiers.filter((_, i) => i !== index),
    });
  };

  const handleDeleteRule = (ruleId) => {
    if (window.confirm('Are you sure you want to delete this rule?')) {
      setRules(rules.filter(r => r.id !== ruleId));
      addAuditEntry({
        action: 'DELETE_BENEFIT_RULE',
        entity: 'BenefitRule',
        entityId: ruleId,
      });
    }
  };

  const handleArchiveRule = (ruleId) => {
    const updatedRules = rules.map(r =>
      r.id === ruleId ? { ...r, status: 'Archived' } : r
    );
    setRules(updatedRules);
    addAuditEntry({
      action: 'ARCHIVE_BENEFIT_RULE',
      entity: 'BenefitRule',
      entityId: ruleId,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Benefits Configuration</h1>
            <p className="text-lg text-slate-600">Manage country-specific benefit rules and compliance</p>
          </div>
          <button
            onClick={openNewRuleModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <Plus size={20} />
            Create New Rule
          </button>
        </div>
      </div>

      {/* Country Summary Cards */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {countrySummary.map((country) => (
            <div
              key={country.code}
              onClick={() => setSelectedCountry(country.code)}
              className={`p-6 rounded-xl cursor-pointer transition-all ${
                selectedCountry === country.code
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-white text-slate-900 shadow-md hover:shadow-lg'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-medium opacity-75 mb-1">
                    <span className="inline-flex items-center gap-1.5"><FlagIcon code={country.code} size={18} /> {country.name}</span>
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Rules:</span>
                  <span className="font-bold">{country.totalRules}</span>
                </div>
                <div className="flex justify-between">
                  <span>Statutory:</span>
                  <span>{country.statutory}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sponsored:</span>
                  <span>{country.sponsored}</span>
                </div>
                <div className="border-t border-current opacity-50 pt-2 mt-2 flex justify-between">
                  <span>Total Rate:</span>
                  <span className="font-bold">{country.totalRate}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-t-xl shadow-md border-b border-slate-200">
          <div className="flex border-b border-slate-200">
            {[
              { id: 'rules', label: 'Rules', icon: FileText },
              { id: 'simulation', label: 'Cost Simulation', icon: BarChart },
              { id: 'history', label: 'Version History', icon: Clock },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-xl shadow-md p-8">
          {/* Rules Tab */}
          {activeTab === 'rules' && (
            <div>
              <div className="flex gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>All</option>
                    <option>statutory</option>
                    <option>employer-sponsored</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="All">All</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                {selectedCountryRules.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="mx-auto mb-4 text-slate-400" size={48} />
                    <p className="text-slate-600">No rules found for this selection</p>
                  </div>
                ) : (
                  selectedCountryRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-slate-900 mb-1">{rule.name}</h3>
                          <div className="flex gap-2 flex-wrap">
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                              rule.type === 'statutory'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {rule.type}
                            </span>
                            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-800">
                              {rule.categoryId}
                            </span>
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                              rule.status === 'Active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {rule.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditRuleModal(rule)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleArchiveRule(rule.id)}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <Archive size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-xs text-slate-600 font-medium">Base Rate</p>
                          <p className="text-lg font-bold text-slate-900">{(rule.rate * 100).toFixed(2)}%</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-xs text-slate-600 font-medium">Employer Split</p>
                          <p className="text-lg font-bold text-slate-900">{rule.contributionSplit.employer}%</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-xs text-slate-600 font-medium">Employee Split</p>
                          <p className="text-lg font-bold text-slate-900">{rule.contributionSplit.employee}%</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-xs text-slate-600 font-medium">Base Field</p>
                          <p className="text-lg font-bold text-slate-900">{rule.baseField}</p>
                        </div>
                      </div>

                      {rule.maxBaseMonthly || rule.maxAmountMonthly || rule.minAmountMonthly ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                          <p className="text-xs font-semibold text-amber-900 mb-2">Caps & Limits</p>
                          <div className="flex gap-4 text-sm text-amber-800">
                            {rule.minAmountMonthly && (
                              <span>Min: ${rule.minAmountMonthly.toFixed(2)}</span>
                            )}
                            {rule.maxAmountMonthly && (
                              <span>Max Amount: ${rule.maxAmountMonthly.toFixed(2)}</span>
                            )}
                            {rule.maxBaseMonthly && (
                              <span>Max Base: ${rule.maxBaseMonthly.toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                      ) : null}

                      {rule.tiers && rule.tiers.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-blue-900 mb-3">Tiers</p>
                          <div className="space-y-2">
                            {rule.tiers.map((tier, idx) => (
                              <div key={idx} className="text-sm text-blue-800 bg-white p-2 rounded">
                                <span className="font-semibold">{tier.label}</span>
                                {' - '}
                                {tier.condition.field} {tier.condition.operator} {tier.condition.value}
                                {' = '}
                                <span className="font-bold">{(tier.rate * 100).toFixed(2)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-slate-500 mt-4 pt-4 border-t border-slate-200">
                        <p>Modified: {rule.lastModified} | Ref: {rule.regulatoryRef || 'N/A'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Cost Simulation Tab */}
          {activeTab === 'simulation' && (
            <div>
              {/* Explanation */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-blue-800">
                    <span className="font-semibold">What-If Simulator:</span> Model benefit costs for a hypothetical employee in <span className="font-semibold">{countries.find(c => c.code === selectedCountry)?.name || selectedCountry}</span>. All amounts shown in <span className="font-semibold">{curCode} ({sym})</span>.
                  </p>
                  {!isUSD && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold ml-3 flex-shrink-0">
                      1 USD = {fx} {curCode}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick presets — salaries converted to local currency */}
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-sm text-slate-500 self-center mr-1">Quick profiles:</span>
                {[
                  { label: 'Junior (L1)', level: 1, years: 1 },
                  { label: 'Mid-Level (L3)', level: 3, years: 5 },
                  { label: 'Senior (L4)', level: 4, years: 10 },
                  { label: 'Executive (L5)', level: 5, years: 15 },
                ].map(p => {
                  return (
                    <button
                      key={p.label}
                      onClick={() => { setSimJobLevel(p.level); setSimYearsService(p.years); setSimBaseSalary(getSalaryForProfile(p.level, p.years)); }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                        simJobLevel === p.level && simYearsService === p.years
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Employee Profile Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8">
                <h3 className="text-base font-semibold text-slate-800 mb-5">Employee Profile</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Job Level */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Job Level</label>
                    <p className="text-xs text-slate-400 mb-3">Seniority tier (1 = entry, 5 = executive). Some benefits vary by level.</p>
                    <div className="flex items-center gap-3">
                      {[1, 2, 3, 4, 5].map(lvl => (
                        <button
                          key={lvl}
                          onClick={() => { setSimJobLevel(lvl); setSimBaseSalary(getSalaryForProfile(lvl, simYearsService)); }}
                          className={`w-10 h-10 rounded-lg text-sm font-bold transition ${
                            simJobLevel === lvl
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {simJobLevel === 1 ? 'Entry-level / Associate' :
                       simJobLevel === 2 ? 'Specialist / Analyst' :
                       simJobLevel === 3 ? 'Senior / Lead IC' :
                       simJobLevel === 4 ? 'Manager / Principal' :
                       'Director / Executive'}
                    </p>
                  </div>

                  {/* Years of Service */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Years of Service</label>
                    <p className="text-xs text-slate-400 mb-3">Tenure at the company. Affects gratuity, PTO accrual, and pension tiers.</p>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={simYearsService}
                      onChange={(e) => { const y = Number(e.target.value); setSimYearsService(y); setSimBaseSalary(getSalaryForProfile(simJobLevel, y)); }}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between mt-2">
                      <span className="text-xs text-slate-400">0 yr</span>
                      <span className="text-lg font-bold text-blue-600">{simYearsService} {simYearsService === 1 ? 'year' : 'years'}</span>
                      <span className="text-xs text-slate-400">30 yr</span>
                    </div>
                  </div>

                  {/* Monthly Base Salary — in local currency */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Monthly Base Salary ({curCode})</label>
                    <p className="text-xs text-slate-400 mb-3">Gross monthly pay before benefits. Benefit rates and caps are applied to this amount.</p>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 font-medium">{sym}</span>
                      <input
                        type="number"
                        min={Math.round(1000 * fx)}
                        max={Math.round(30000 * fx)}
                        step={Math.max(100, Math.round(500 * fx / 100) * 100)}
                        value={simBaseSalary}
                        onChange={(e) => setSimBaseSalary(Number(e.target.value))}
                        className="w-full pl-7 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
                      />
                    </div>
                    <input
                      type="range"
                      min={Math.round(1000 * fx)}
                      max={Math.round(30000 * fx)}
                      step={Math.max(100, Math.round(500 * fx / 100) * 100)}
                      value={simBaseSalary}
                      onChange={(e) => setSimBaseSalary(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mt-2"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-slate-400">{sym}{Math.round(1000 * fx).toLocaleString()}</span>
                      {!isUSD && <span className="text-xs text-blue-500 font-medium">= ${Math.round(simBaseSalary * fxToUSD).toLocaleString()} USD</span>}
                      <span className="text-xs text-slate-400">{sym}{Math.round(30000 * fx).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Summary Metrics */}
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                    <p className="text-sm text-blue-700 font-medium mb-1">Total Employer Cost (Monthly)</p>
                    <p className="text-4xl font-bold text-blue-900">{fmtLocal(simulationResults.totalEmployerLocal)}</p>
                    {!isUSD && <p className="text-sm text-blue-500 mt-1">${simulationResults.totalEmployerCost.toFixed(2)} USD</p>}
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
                    <p className="text-sm text-green-700 font-medium mb-1">Total Employee Cost (Monthly)</p>
                    <p className="text-4xl font-bold text-green-900">{fmtLocal(simulationResults.totalEmployeeLocal)}</p>
                    {!isUSD && <p className="text-sm text-green-500 mt-1">${simulationResults.totalEmployeeCost.toFixed(2)} USD</p>}
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
                    <p className="text-sm text-purple-700 font-medium mb-1">Burden Rate (% of Base)</p>
                    <p className="text-4xl font-bold text-purple-900">{simulationResults.totalBurdenRate}%</p>
                  </div>
                </div>

                {/* Cost Distribution Pie */}
                {costDistribution.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-4">Cost Distribution by Category ({curCode})</p>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={costDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${sym}${Math.round(value).toLocaleString()}`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {costDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${sym}${value.toFixed(2)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Detailed Results Table */}
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-4">Detailed Cost Breakdown ({curCode})</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 border-b border-slate-300">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Rule Name</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Base Rate</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Applied Rate</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Applied Base</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Employer</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Employee</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {simulationResults.results.map((result) => (
                        <tr key={result.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">{result.name}</td>
                          <td className="px-4 py-3 text-slate-600">{result.type}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{result.baseRate}%</td>
                          <td className="px-4 py-3 text-right text-slate-600">{result.appliedRate}%</td>
                          <td className="px-4 py-3 text-right text-slate-600">{fmtLocalExact(result.appliedBaseLocal)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-700">{fmtLocalExact(result.employerCostLocal)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-blue-700">{fmtLocalExact(result.employeeCostLocal)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmtLocalExact(result.totalCostLocal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                      <tr className="font-semibold">
                        <td className="px-4 py-3 text-slate-900" colSpan={5}>Total</td>
                        <td className="px-4 py-3 text-right text-green-700">{fmtLocal(simulationResults.totalEmployerLocal)}</td>
                        <td className="px-4 py-3 text-right text-blue-700">{fmtLocal(simulationResults.totalEmployeeLocal)}</td>
                        <td className="px-4 py-3 text-right text-slate-900">{fmtLocal(simulationResults.totalEmployerLocal + simulationResults.totalEmployeeLocal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Version History Tab */}
          {activeTab === 'history' && (
            <div>
              <div className="space-y-4">
                {versionHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="mx-auto mb-4 text-slate-400" size={48} />
                    <p className="text-slate-600">No version history for this country</p>
                  </div>
                ) : versionHistory.map((entry, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-4 h-4 bg-blue-600 rounded-full border-4 border-white shadow-md"></div>
                      {idx !== versionHistory.length - 1 && (
                        <div className="w-0.5 h-16 bg-slate-300 mt-2"></div>
                      )}
                    </div>
                    <div className="pb-6">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{entry.name}</p>
                            <p className="text-sm text-slate-600 mt-1">{entry.change}</p>
                          </div>
                          <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-800 rounded">
                            v{entry.version}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-3">
                          {entry.date} • By {entry.changedBy}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Rule Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-8 py-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingRule ? 'Edit Rule' : 'Create New Rule'}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="px-8 py-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Rule Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Category ID</label>
                  <input
                    type="text"
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="statutory">Statutory</option>
                    <option value="employer-sponsored">Employer-Sponsored</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Contribution Split */}
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3">Contribution Split (%)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">Employer</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.contributionSplit.employer}
                      onChange={(e) => setFormData({
                        ...formData,
                        contributionSplit: {
                          ...formData.contributionSplit,
                          employer: Number(e.target.value),
                        },
                      })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">Employee</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.contributionSplit.employee}
                      onChange={(e) => setFormData({
                        ...formData,
                        contributionSplit: {
                          ...formData.contributionSplit,
                          employee: Number(e.target.value),
                        },
                      })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Rate & Base */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Rate (decimal, e.g., 0.062)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Base Field</label>
                  <select
                    value={formData.baseField}
                    onChange={(e) => setFormData({ ...formData, baseField: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="basePay">basePay</option>
                    <option value="eligibleEarnings">eligibleEarnings</option>
                    <option value="totalComp">totalComp</option>
                  </select>
                </div>
              </div>

              {/* Caps & Limits */}
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3">Caps & Limits</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">Min Amount (Monthly)</label>
                    <input
                      type="number"
                      value={formData.minAmountMonthly || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        minAmountMonthly: e.target.value ? Number(e.target.value) : null,
                      })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">Max Amount (Monthly)</label>
                    <input
                      type="number"
                      value={formData.maxAmountMonthly || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        maxAmountMonthly: e.target.value ? Number(e.target.value) : null,
                      })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">Max Base (Monthly)</label>
                    <input
                      type="number"
                      value={formData.maxBaseMonthly || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        maxBaseMonthly: e.target.value ? Number(e.target.value) : null,
                      })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Dates & Regulatory */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Effective Date</label>
                  <input
                    type="date"
                    value={formData.effectiveDate}
                    onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">End Date (Optional)</label>
                  <input
                    type="date"
                    value={formData.endDate || ''}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value || null })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Regulatory Reference</label>
                <input
                  type="text"
                  value={formData.regulatoryRef}
                  onChange={(e) => setFormData({ ...formData, regulatoryRef: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="3"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Tiers */}
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3">Tiers (Conditional Overrides)</p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">Field</label>
                      <select
                        value={tierFormData.field}
                        onChange={(e) => setTierFormData({ ...tierFormData, field: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="yearsOfService">yearsOfService</option>
                        <option value="jobLevel">jobLevel</option>
                        <option value="jobFamily">jobFamily</option>
                        <option value="costCenterId">costCenterId</option>
                        <option value="companyCodeId">Vertical</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">Operator</label>
                      <select
                        value={tierFormData.operator}
                        onChange={(e) => setTierFormData({ ...tierFormData, operator: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value=">=">&gt;=</option>
                        <option value="<=">&lt;=</option>
                        <option value=">">&gt;</option>
                        <option value="<">&lt;</option>
                        <option value="==">==</option>
                        <option value="!=">!=</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">Value</label>
                      <input
                        type="number"
                        value={tierFormData.value}
                        onChange={(e) => setTierFormData({ ...tierFormData, value: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">Rate (decimal)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={tierFormData.rate}
                        onChange={(e) => setTierFormData({ ...tierFormData, rate: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="text-xs text-slate-600 mb-1 block">Label</label>
                    <input
                      type="text"
                      value={tierFormData.label}
                      onChange={(e) => setTierFormData({ ...tierFormData, label: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleAddTier}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    Add Tier
                  </button>
                </div>

                {formData.tiers.length > 0 && (
                  <div className="space-y-2">
                    {formData.tiers.map((tier, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-white border border-slate-300 rounded-lg p-3"
                      >
                        <span className="text-sm text-slate-900">
                          {tier.label || `${tier.condition.field} ${tier.condition.operator} ${tier.condition.value}`}
                          {' = '}
                          <span className="font-bold">{(tier.rate * 100).toFixed(2)}%</span>
                        </span>
                        <button
                          onClick={() => handleRemoveTier(idx)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6 border-t border-slate-200">
                <button
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 text-slate-700 border border-slate-300 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRule}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  {editingRule ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BenefitsConfig;
