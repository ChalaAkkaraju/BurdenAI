import React from 'react';
import {
  LayoutDashboard,
  Users,
  Upload,
  BookOpen,
  BarChart3,
  Calculator,
  Shield,
  Zap,
  Heart,
  Database,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const Sidebar = ({ activePage, onNavigate }) => {
  const { hasAccess } = useApp();
  const navItems = [
    {
      section: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
      ],
    },
    {
      section: 'DATA',
      items: [
        { id: 'roster', label: 'Employee Roster', icon: Users },
        { id: 'rawdata', label: 'Raw Data Display', icon: Database },
        { id: 'import', label: 'Data Import', icon: Upload },
      ],
    },
    {
      section: 'RULES',
      items: [
        { id: 'benefits', label: 'Benefit Rules', icon: Heart },
        { id: 'allocation', label: 'Allocation Policies', icon: BookOpen },
      ],
    },
    {
      section: 'PROCESSING',
      items: [
        { id: 'calculations', label: 'Calculation Runs', icon: Calculator },
      ],
    },
    {
      section: 'ADMINISTRATION',
      items: [
        { id: 'admin', label: 'Admin Console', icon: Shield },
      ],
    },
  ];

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm">
      {/* Logo Area */}
      <div className="px-6 py-6 border-b border-gray-200 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
          <Zap size={18} className="text-white" />
        </div>
        <span className="text-lg font-bold text-gray-900">BurdenAI</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3">
        {navItems
          .map((section) => ({ ...section, items: section.items.filter((i) => hasAccess(i.id)) }))
          .filter((section) => section.items.length > 0)
          .map((section) => (
          <div key={section.section} className="mb-8">
            {/* Section Header */}
            <div className="px-3 mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {section.section}
              </h3>
            </div>

            {/* Section Items */}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const IconComponent = item.icon;
                const isActive = activePage === item.id;

                return (
                  <li key={item.id}>
                    <button
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                        isActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <IconComponent
                        size={18}
                        className={isActive ? 'text-blue-600' : 'text-gray-400'}
                      />
                      <span>{item.label}</span>

                      {/* Active Indicator */}
                      {isActive && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 px-3 py-4">
        <div className="px-3 py-2 rounded-lg bg-gray-50 text-center">
          <p className="text-xs text-gray-600 font-medium">BurdenAI v1.0</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
