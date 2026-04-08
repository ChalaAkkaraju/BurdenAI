import { useState, useMemo, useCallback } from 'react';
import { companyCodes } from '../data/orgHierarchy';
import { useApp } from '../context/AppContext';

// Returns true if a country code is within the user's access scope.
export function isCountryAllowed(countryCode, allowedCountries) {
  if (!allowedCountries || allowedCountries.length === 0) return true;
  if (allowedCountries.includes('*')) return true;
  return allowedCountries.includes(countryCode);
}

// Shared cascading employee filter state used by Employee Roster, Raw Data,
// and Cost Ingestion. Provides search + Country → Vertical → Job Family +
// Status, with the dependent dropdowns clearing themselves whenever a parent
// selection becomes invalid.
export function useEmployeeFilters(employees, initial = {}) {
  const { currentUser } = useApp();
  const allowedCountries = currentUser?.allowedCountries || ['*'];

  // Pre-filter the employee pool to only countries the user has access to.
  const scopedEmployees = useMemo(
    () => employees.filter((e) => isCountryAllowed(e.countryCode, allowedCountries)),
    [employees, allowedCountries]
  );

  const [searchText, setSearchText] = useState(initial.searchText || '');
  const [filterCountry, setFilterCountry] = useState(initial.filterCountry || '');
  const [filterCompanyCode, setFilterCompanyCode] = useState(initial.filterCompanyCode || '');
  const [filterJobFamily, setFilterJobFamily] = useState(initial.filterJobFamily || '');
  const [filterStatus, setFilterStatus] = useState(initial.filterStatus || '');

  const companyCodeOptions = useMemo(() => {
    const base = companyCodes.filter((cc) => isCountryAllowed(cc.countryCode, allowedCountries));
    const list = filterCountry
      ? base.filter((cc) => cc.countryCode === filterCountry)
      : base;
    return list.map((cc) => ({
      id: cc.id,
      name: filterCountry ? cc.name : `${cc.name} (${cc.countryCode})`,
    }));
  }, [filterCountry, allowedCountries]);

  const jobFamilies = useMemo(() => {
    if (!filterCountry) return [];
    const source = scopedEmployees.filter((e) => e.countryCode === filterCountry);
    return [...new Set(source.map((e) => e.jobFamily))].sort();
  }, [scopedEmployees, filterCountry]);

  const handleCountryChange = useCallback(
    (value) => {
      setFilterCountry(value);
      if (!value) {
        setFilterCompanyCode('');
        setFilterJobFamily('');
        return;
      }
      if (filterCompanyCode) {
        const stillValid = companyCodes.some(
          (cc) => cc.id === filterCompanyCode && cc.countryCode === value
        );
        if (!stillValid) setFilterCompanyCode('');
      }
      setFilterJobFamily('');
    },
    [filterCompanyCode]
  );

  const handleVerticalChange = useCallback((value) => {
    setFilterCompanyCode(value);
    setFilterJobFamily('');
  }, []);

  const clearFilters = useCallback(() => {
    setSearchText('');
    setFilterCountry('');
    setFilterCompanyCode('');
    setFilterJobFamily('');
    setFilterStatus('');
  }, []);

  const hasFilters = Boolean(
    searchText || filterCountry || filterCompanyCode || filterJobFamily || filterStatus
  );

  const filteredEmployees = useMemo(() => {
    return scopedEmployees.filter((emp) => {
      if (searchText) {
        const term = searchText.toLowerCase();
        if (
          !emp.id.toLowerCase().includes(term) &&
          !emp.fullName.toLowerCase().includes(term)
        )
          return false;
      }
      if (filterCountry && emp.countryCode !== filterCountry) return false;
      if (filterCompanyCode && emp.companyCodeId !== filterCompanyCode) return false;
      if (filterJobFamily && emp.jobFamily !== filterJobFamily) return false;
      if (filterStatus && emp.status !== filterStatus) return false;
      return true;
    });
  }, [scopedEmployees, searchText, filterCountry, filterCompanyCode, filterJobFamily, filterStatus]);

  return {
    // state
    searchText,
    filterCountry,
    filterCompanyCode,
    filterJobFamily,
    filterStatus,
    // setters
    setSearchText,
    setFilterCountry,
    setFilterCompanyCode,
    setFilterJobFamily,
    setFilterStatus,
    handleCountryChange,
    handleVerticalChange,
    clearFilters,
    // derived
    companyCodeOptions,
    jobFamilies,
    hasFilters,
    filteredEmployees,
    allowedCountries,
  };
}
