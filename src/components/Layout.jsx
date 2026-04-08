import React, { useState } from 'react';
import { ChevronDown, Bell, Shield, LogOut } from 'lucide-react';
import Sidebar from './Sidebar';
import { useApp } from '../context/AppContext';

const Layout = ({ children, activePage, setActivePage }) => {
  const { selectedPeriod, setSelectedPeriod, periods, currentUser, logout } = useApp();
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  const accessLabel = currentUser?.allowedCountries?.includes('*')
    ? 'All Countries'
    : (currentUser?.allowedCountries || []).join(', ') || 'No Access';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8 shadow-sm">
          {/* Left Side - Title and Subtitle */}
          <div className="flex flex-col">
            <h1 className="text-sm text-gray-500 font-medium tracking-wide">
              Burden Cost & Rate Platform
            </h1>
          </div>

          {/* Right Side - Period Selector, Notifications, User */}
          <div className="flex items-center gap-6">
            {/* Period Selector */}
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
              >
                {selectedPeriod}
                <ChevronDown size={16} className="text-gray-500" />
              </button>

              {/* Dropdown Menu */}
              {showPeriodDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  {periods && periods.map((period) => (
                    <button
                      key={period}
                      onClick={() => {
                        setSelectedPeriod(period);
                        setShowPeriodDropdown(false);
                      }}
                      className={`block w-full text-left px-4 py-3 text-sm transition-colors ${
                        selectedPeriod === period
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Access Scope Badge */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-sm font-medium text-amber-800"
              title="Country access scope"
            >
              <Shield size={14} />
              {accessLabel}
            </div>

            {/* Logout */}
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
              title="Sign out"
            >
              <LogOut size={14} />
              Logout
            </button>

            {/* Notification Bell */}
            <button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* User Avatar and Name */}
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="flex flex-col text-right">
                <span className="text-sm font-medium text-gray-900">
                  {currentUser?.name || 'User'}
                </span>
                <span className="text-xs text-gray-500">
                  {currentUser?.role || 'Role'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                {currentUser?.name
                  ? currentUser.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                  : 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 min-h-0 overflow-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
