import React from 'react';
import {
  LayoutDashboard,
  Users,
  Upload,
  BookOpen,
  BarChart3,
  Calculator,
  Shield,
  Heart,
  Database,
  TrendingUp,
  Target,
  Coins,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import BrandMark from './BrandMark';

// Each module keeps one colour everywhere (sidebar, home page cards, dashboard).
// Class names are written out in full so Tailwind keeps them.
const TONES = {
  blue:   { tile: 'bg-blue-50 text-blue-600',     on: 'bg-blue-600 text-white',   row: 'bg-blue-50 text-blue-900',     dot: 'bg-blue-600' },
  indigo: { tile: 'bg-indigo-50 text-indigo-600', on: 'bg-indigo-600 text-white', row: 'bg-indigo-50 text-indigo-900', dot: 'bg-indigo-600' },
  slate:  { tile: 'bg-slate-100 text-slate-700',  on: 'bg-slate-900 text-white',  row: 'bg-slate-100 text-slate-900',  dot: 'bg-slate-900' },
  violet: { tile: 'bg-violet-50 text-violet-600', on: 'bg-violet-600 text-white', row: 'bg-violet-50 text-violet-900', dot: 'bg-violet-600' },
  amber:  { tile: 'bg-amber-50 text-amber-600',   on: 'bg-amber-500 text-white',  row: 'bg-amber-50 text-amber-900',   dot: 'bg-amber-500' },
  cyan:   { tile: 'bg-cyan-50 text-cyan-700',     on: 'bg-cyan-600 text-white',   row: 'bg-cyan-50 text-cyan-900',     dot: 'bg-cyan-600' },
  rose:   { tile: 'bg-rose-50 text-rose-600',     on: 'bg-rose-500 text-white',   row: 'bg-rose-50 text-rose-900',     dot: 'bg-rose-500' },
  sky:    { tile: 'bg-sky-50 text-sky-600',       on: 'bg-sky-600 text-white',    row: 'bg-sky-50 text-sky-900',       dot: 'bg-sky-600' },
  teal:   { tile: 'bg-teal-50 text-teal-600',     on: 'bg-teal-600 text-white',   row: 'bg-teal-50 text-teal-900',     dot: 'bg-teal-600' },
  gray:   { tile: 'bg-gray-100 text-gray-600',    on: 'bg-gray-700 text-white',   row: 'bg-gray-100 text-gray-900',    dot: 'bg-gray-700' },
};

export const NAV = [
  {
    section: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, tone: 'blue' },
      { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, tone: 'indigo' },
    ],
  },
  {
    section: 'Burden Cost',
    items: [
      { id: 'burdencost', label: 'Burden Cost', icon: Coins, tone: 'slate' },
    ],
  },
  {
    section: 'Planning',
    items: [
      { id: 'forecast', label: 'Forecast', icon: TrendingUp, tone: 'violet' },
    ],
  },
  {
    section: 'Utilization',
    items: [
      { id: 'planvsactual', label: 'Plan vs Actual', icon: Target, tone: 'amber' },
    ],
  },
  {
    section: 'Data',
    items: [
      { id: 'roster', label: 'Employee Roster', icon: Users, tone: 'cyan' },
      { id: 'rawdata', label: 'Raw Data Display', icon: Database, tone: 'cyan' },
      { id: 'import', label: 'Data Import', icon: Upload, tone: 'cyan' },
    ],
  },
  {
    section: 'Rules',
    items: [
      { id: 'benefits', label: 'Benefit Rules', icon: Heart, tone: 'rose' },
      { id: 'allocation', label: 'Allocation Policies', icon: BookOpen, tone: 'sky' },
    ],
  },
  {
    section: 'Processing',
    items: [
      { id: 'calculations', label: 'Calculation Runs', icon: Calculator, tone: 'teal' },
    ],
  },
  {
    section: 'Administration',
    items: [
      { id: 'admin', label: 'Admin Console', icon: Shield, tone: 'gray' },
    ],
  },
];

const Sidebar = ({ activePage, onNavigate }) => {
  const { hasAccess } = useApp();

  return (
    <aside className="w-64 shrink-0 bg-white/90 backdrop-blur border-r border-gray-200/80 flex flex-col h-full print:hidden">
      {/* Brand */}
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md">
          <BrandMark className="w-6 h-6" />
        </div>
        <div className="leading-tight">
          <div className="text-[17px] font-bold tracking-tight text-gray-900">Burden AI</div>
          <div className="text-[11px] font-medium text-gray-500">Burden cost &amp; rate platform</div>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-6 pt-1">
        {NAV
          .map((section) => ({ ...section, items: section.items.filter((i) => hasAccess(i.id)) }))
          .filter((section) => section.items.length > 0)
          .map((section) => (
            <div key={section.section} className="mt-4 first:mt-1">
              <h3 className="px-3 mb-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-[0.08em]">
                {section.section}
              </h3>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const t = TONES[item.tone] || TONES.gray;
                  const isActive = activePage === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onNavigate(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group w-full flex items-center gap-3 px-2.5 py-1.5 rounded-xl text-sm transition-colors ${
                          isActive ? `${t.row} font-semibold` : 'text-gray-700 font-medium hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <span
                          className={`inline-flex w-7 h-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                            isActive ? `${t.on} shadow-sm` : t.tile
                          }`}
                        >
                          <Icon size={15} strokeWidth={2.2} />
                        </span>
                        <span className="truncate">{item.label}</span>
                        {isActive && <span className={`ml-auto w-1.5 h-1.5 rounded-full ${t.dot}`} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
      </nav>

      <div className="px-5 py-4 border-t border-gray-100 text-[11px] text-gray-400 font-medium">Burden AI · v1.1</div>
    </aside>
  );
};

export default Sidebar;
