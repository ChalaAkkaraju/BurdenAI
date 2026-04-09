import { createContext, useContext, useState, useMemo } from 'react';
import {
  employees as rawEmployees,
  costData as rawCostData,
  allocationRules as rawRules,
  calculationRuns as rawRuns,
  auditLog as rawAuditLog,
  periods,
  countries,
  aggregateByField,
  aggregateByPeriod,
  getEmployeeDetail,
} from '../data/generateData.js';
import {
  countryBenefitRules,
  getRulesForCountry,
  getRulesGroupedByCountry,
  getCountryBenefitSummary,
  calculateAllBenefits,
} from '../data/countryBenefitRules.js';
import {
  companyCodes, departments, costCenters, jobCodes,
  overheadCategories, benefitCategories,
} from '../data/orgHierarchy.js';

const AppContext = createContext(null);

// Demo user registry. In a real app these would live on the server with hashed
// passwords; this is for prototype/demo only.
export const INITIAL_USER_REGISTRY = [
  { username: 'admin', password: 'admin123', name: 'Pranav Akkaraju', email: 'pranav@burdencorp.com', role: 'Admin (Global)', allowedCountries: ['*'] },
  { username: 'sarah', password: 'us123',    name: 'Sarah Chen',     email: 'sarah@burdencorp.com',  role: 'US Manager',    allowedCountries: ['US'] },
  { username: 'raj',   password: 'apac123',  name: 'Raj Patel',      email: 'raj@burdencorp.com',    role: 'APAC Lead',     allowedCountries: ['IN', 'SG', 'AU'] },
  { username: 'emma',  password: 'emea123',  name: 'Emma Müller',    email: 'emma@burdencorp.com',   role: 'EMEA Lead',     allowedCountries: ['GB', 'DE', 'FR'] },
];

const SESSION_KEY = 'burden_auth_user';
const USERS_KEY = 'burden_users_registry';

// Role -> allowed page IDs (must match keys in App.jsx `pages`)
// '*' means access to every page.
export const ROLE_PERMISSIONS = {
  'Admin (Global)':  ['*'],
  'Finance':         ['dashboard', 'reports', 'roster', 'rawdata', 'import', 'benefits', 'allocation', 'calculations'],
  'HR':              ['dashboard', 'reports', 'roster', 'rawdata', 'import', 'benefits', 'allocation', 'calculations'],
  'Regional Lead':   ['dashboard', 'reports', 'roster', 'rawdata', 'import', 'benefits', 'allocation', 'calculations'],
  'US Manager':      ['dashboard', 'reports', 'roster', 'rawdata', 'import', 'benefits', 'allocation', 'calculations'],
  'APAC Lead':       ['dashboard', 'reports', 'roster', 'rawdata', 'import', 'benefits', 'allocation', 'calculations'],
  'EMEA Lead':       ['dashboard', 'reports', 'roster', 'rawdata', 'import', 'benefits', 'allocation', 'calculations'],
  'Analyst':         ['dashboard', 'reports', 'roster', 'rawdata'],
  'Viewer':          ['dashboard', 'reports'],
};

export function userCanAccess(user, pageId) {
  if (!user) return false;
  const allowed = ROLE_PERMISSIONS[user.role] || ['dashboard'];
  return allowed.includes('*') || allowed.includes(pageId);
}

export function AppProvider({ children }) {
  const [employees] = useState(rawEmployees);
  const [costData] = useState(rawCostData);
  const [allocationRules, setAllocationRules] = useState(rawRules);
  const [calculationRuns, setCalculationRuns] = useState(rawRuns);
  const [auditLog, setAuditLog] = useState(rawAuditLog);
  const [selectedPeriod, setSelectedPeriod] = useState('2026-03');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [users, setUsers] = useState(() => {
    try {
      const saved = localStorage.getItem(USERS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_USER_REGISTRY;
  });

  const persistUsers = (next) => {
    setUsers(next);
    try { localStorage.setItem(USERS_KEY, JSON.stringify(next)); } catch {}
  };

  const addUser = (user) => {
    if (!user?.username || !user?.password) return { ok: false, error: 'Username and password required' };
    if (users.some(u => u.username.toLowerCase() === user.username.toLowerCase())) {
      return { ok: false, error: 'Username already exists' };
    }
    const newUser = {
      username: user.username.trim(),
      password: user.password,
      name: user.name?.trim() || user.username,
      email: user.email?.trim() || '',
      role: user.role || 'Viewer',
      allowedCountries: Array.isArray(user.allowedCountries) && user.allowedCountries.length
        ? user.allowedCountries
        : ['*'],
    };
    persistUsers([...users, newUser]);
    return { ok: true };
  };

  const deleteUser = (username) => {
    if (username === 'admin') return { ok: false, error: 'Cannot delete the primary admin' };
    persistUsers(users.filter(u => u.username !== username));
    return { ok: true };
  };

  const updateUserCountries = (username, allowedCountries) => {
    persistUsers(users.map(u => u.username === username ? { ...u, allowedCountries } : u));
    return { ok: true };
  };

  const login = (username, password) => {
    const user = users.find(
      (u) => u.username.toLowerCase() === (username || '').toLowerCase() && u.password === password
    );
    if (!user) return { ok: false, error: 'Invalid username or password' };
    const { password: _pw, ...safeUser } = user;
    setCurrentUser(safeUser);
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(safeUser)); } catch {}
    return { ok: true };
  };

  const logout = () => {
    setCurrentUser(null);
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  };

  const employeeMap = useMemo(() => {
    const map = {};
    for (const emp of employees) map[emp.id] = emp;
    return map;
  }, [employees]);

  // Aggregations
  const periodData = useMemo(() => aggregateByPeriod(costData), [costData]);

  const currentPeriodCosts = useMemo(
    () => costData.filter(c => c.period === selectedPeriod),
    [costData, selectedPeriod]
  );

  const summaryByJobCode = useMemo(
    () => aggregateByField(costData, employeeMap, 'jobCode', selectedPeriod),
    [costData, employeeMap, selectedPeriod]
  );

  const summaryByCostCenter = useMemo(
    () => aggregateByField(costData, employeeMap, 'costCenterId', selectedPeriod),
    [costData, employeeMap, selectedPeriod]
  );

  const summaryByCompanyCode = useMemo(
    () => aggregateByField(costData, employeeMap, 'companyCodeId', selectedPeriod),
    [costData, employeeMap, selectedPeriod]
  );

  const summaryByCountry = useMemo(
    () => aggregateByField(costData, employeeMap, 'countryCode', selectedPeriod),
    [costData, employeeMap, selectedPeriod]
  );

  const summaryByDepartment = useMemo(
    () => aggregateByField(costData, employeeMap, 'departmentId', selectedPeriod),
    [costData, employeeMap, selectedPeriod]
  );

  // KPIs for current period
  const kpis = useMemo(() => {
    const pc = currentPeriodCosts;
    const totalCTC = pc.reduce((s, c) => s + c.totalCostToCompany, 0);
    const totalDirect = pc.reduce((s, c) => s + c.direct.total, 0);
    const totalBenefits = pc.reduce((s, c) => s + c.benefits.total, 0);
    const totalOverhead = pc.reduce((s, c) => s + c.overhead.total, 0);
    const totalHours = pc.reduce((s, c) => s + c.productiveHours, 0);
    const activeEmps = employees.filter(e => e.status === 'Active').length;
    const avgBurdenRate = totalHours > 0 ? totalCTC / totalHours : 0;
    const burdenMultiplier = totalDirect > 0 ? (totalBenefits + totalOverhead) / totalDirect : 0;

    // Previous period comparison
    const prevPeriodIdx = periods.indexOf(selectedPeriod) - 1;
    let prevAvgBurdenRate = null;
    if (prevPeriodIdx >= 0) {
      const prevPeriod = periods[prevPeriodIdx];
      const prevCosts = costData.filter(c => c.period === prevPeriod);
      const prevTotal = prevCosts.reduce((s, c) => s + c.totalCostToCompany, 0);
      const prevHours = prevCosts.reduce((s, c) => s + c.productiveHours, 0);
      prevAvgBurdenRate = prevHours > 0 ? prevTotal / prevHours : 0;
    }

    return {
      totalCTC,
      totalDirect,
      totalBenefits,
      totalOverhead,
      totalHours,
      activeEmployees: activeEmps,
      avgBurdenRate: Math.round(avgBurdenRate * 100) / 100,
      burdenMultiplier: Math.round(burdenMultiplier * 10000) / 10000,
      prevAvgBurdenRate: prevAvgBurdenRate !== null ? Math.round(prevAvgBurdenRate * 100) / 100 : null,
      burdenRateChange: prevAvgBurdenRate !== null
        ? Math.round((avgBurdenRate - prevAvgBurdenRate) * 100) / 100
        : null,
    };
  }, [currentPeriodCosts, employees, selectedPeriod, costData]);

  const addAuditEntry = (entry) => {
    setAuditLog(prev => [{
      id: prev.length + 1,
      timestamp: new Date().toISOString(),
      user: currentUser.email,
      ...entry,
    }, ...prev]);
  };

  const value = {
    employees,
    employeeMap,
    costData,
    allocationRules,
    setAllocationRules,
    calculationRuns,
    setCalculationRuns,
    auditLog,
    addAuditEntry,
    selectedPeriod,
    setSelectedPeriod,
    periods,
    countries,
    currentUser,
    setCurrentUser,
    users,
    addUser,
    deleteUser,
    updateUserCountries,
    login,
    logout,
    hasAccess: (pageId) => userCanAccess(currentUser, pageId),
    isAuthenticated: !!currentUser,
    // Aggregations
    periodData,
    currentPeriodCosts,
    summaryByJobCode,
    summaryByCostCenter,
    summaryByCompanyCode,
    summaryByCountry,
    summaryByDepartment,
    kpis,
    // Reference data
    companyCodes, departments, costCenters, jobCodes,
    overheadCategories, benefitCategories,
    // Country benefit rules
    countryBenefitRules,
    getRulesForCountry,
    getRulesGroupedByCountry,
    getCountryBenefitSummary,
    calculateAllBenefits,
    // Helpers
    getEmployeeDetail: (empId) => getEmployeeDetail(empId, costData),
    aggregateByField: (field, period) => aggregateByField(costData, employeeMap, field, period),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
