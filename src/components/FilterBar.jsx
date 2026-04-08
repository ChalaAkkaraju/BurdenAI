import React from 'react';
import { Search, X } from 'lucide-react';
import { countries } from '../data/orgHierarchy';

// Reusable cascading filter bar driven by useEmployeeFilters().
// Pass the hook return value as `filters`.
export default function FilterBar({ filters }) {
  const {
    searchText,
    setSearchText,
    filterCountry,
    handleCountryChange,
    filterCompanyCode,
    handleVerticalChange,
    filterJobFamily,
    setFilterJobFamily,
    filterStatus,
    setFilterStatus,
    companyCodeOptions,
    jobFamilies,
    clearFilters,
    hasFilters,
    allowedCountries,
  } = filters;

  const isAll = !allowedCountries || allowedCountries.includes('*');
  const visibleCountries = isAll
    ? countries
    : countries.filter((c) => allowedCountries.includes(c.code));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="grid grid-cols-6 gap-3 mb-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search by Name or ID
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="e.g., John Smith or EMP-00001"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
          <select
            value={filterCountry}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">{isAll ? 'All Countries' : 'All Allowed Countries'}</option>
            {visibleCountries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vertical</label>
          <select
            value={filterCompanyCode}
            onChange={(e) => handleVerticalChange(e.target.value)}
            disabled={!filterCountry}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              !filterCountry ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white'
            }`}
          >
            <option value="">{filterCountry ? 'All Verticals' : 'Select country first'}</option>
            {filterCountry &&
              companyCodeOptions.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.name}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job Family</label>
          <select
            value={filterJobFamily}
            onChange={(e) => setFilterJobFamily(e.target.value)}
            disabled={!filterCountry || !filterCompanyCode}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              !filterCountry || !filterCompanyCode
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white'
            }`}
          >
            <option value="">
              {!filterCountry || !filterCompanyCode
                ? 'Select country & vertical'
                : 'All Families'}
            </option>
            {jobFamilies.map((family) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="On Leave">On Leave</option>
            <option value="Terminated">Terminated</option>
          </select>
        </div>
      </div>

      {hasFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <X className="w-4 h-4" /> Clear all filters
        </button>
      )}
    </div>
  );
}
