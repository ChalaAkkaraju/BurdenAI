import React from 'react';
import {
  Calculator,
  Check,
  LayoutDashboard,
  Scale,
  Target,
  TrendingUp,
} from 'lucide-react';
import BrandMark from './BrandMark';

// Public landing page shown before sign-in (same layout as the AI PMO landing).
// Every card describes a module that exists in the app today.
const modules = [
  {
    key: 'overview',
    name: 'Burden Cost',
    icon: LayoutDashboard,
    question: 'What does an hour of labour really cost us?',
    points: [
      'Total burden cost and average rate for every period',
      'Drill down company → cost center → employee',
      'Burden rate by country and by vertical',
    ],
    tags: ['Burden rate', 'Multiplier', 'Drill-down'],
    bar: 'bg-slate-400',
    glow: 'from-slate-50',
    tile: 'bg-slate-900',
    title: 'text-slate-900',
    check: 'text-slate-700',
    tag: 'bg-slate-100 text-slate-700',
  },
  {
    key: 'rules',
    name: 'Rules',
    icon: Scale,
    question: 'Are benefits and overhead applied the same way everywhere?',
    points: [
      'Country benefit and statutory rules, with FX',
      'Overhead allocated by headcount, payroll or revenue',
      'Set once, applied to every period',
    ],
    tags: ['Benefits', 'Allocation', 'FX'],
    bar: 'bg-blue-300',
    glow: 'from-blue-50',
    tile: 'bg-blue-600',
    title: 'text-blue-700',
    check: 'text-blue-600',
    tag: 'bg-blue-50 text-blue-700',
  },
  {
    key: 'runs',
    name: 'Audit',
    icon: Calculator,
    question: "Can we reproduce — and defend — last quarter's number?",
    points: [
      'Every period run is kept and repeatable',
      'Run history and audit log',
      'Role-based access, scoped by region',
    ],
    tags: ['Calculation runs', 'Audit log', 'Roles'],
    bar: 'bg-teal-300',
    glow: 'from-teal-50',
    tile: 'bg-teal-600',
    title: 'text-teal-700',
    check: 'text-teal-600',
    tag: 'bg-teal-50 text-teal-700',
  },
  {
    key: 'forecast',
    name: 'Forecast',
    icon: TrendingUp,
    question: "Where will next year's rate land — and why?",
    points: [
      "Built on this year's actuals plus a few clear drivers",
      'Compare what-ifs side by side, 1 to 5 years out',
      'Spot a budget gap before AOP submission, not after',
    ],
    tags: ['Scenarios', 'Waterfall', 'Sensitivity'],
    bar: 'bg-violet-300',
    glow: 'from-violet-50',
    tile: 'bg-violet-600',
    title: 'text-violet-700',
    check: 'text-violet-600',
    tag: 'bg-violet-50 text-violet-700',
  },
  {
    key: 'planvsactual',
    name: 'Plan vs Actual',
    icon: Target,
    question: 'Did we use the hours we planned — and recover the overhead?',
    points: [
      'Utilization against plan and target, by cost center',
      'Cost variance split into volume and rate',
      'Over- and under-absorption flagged for review',
    ],
    tags: ['Utilization', 'Absorption', 'Variance'],
    bar: 'bg-amber-300',
    glow: 'from-amber-50',
    tile: 'bg-amber-600',
    title: 'text-amber-700',
    check: 'text-amber-600',
    tag: 'bg-amber-50 text-amber-700',
  },
];

const pills = [
  { label: 'Replaces the spreadsheet', cls: 'bg-blue-50 border-blue-200 text-blue-800', dot: 'bg-blue-600' },
  { label: 'Audit-ready by design', cls: 'bg-indigo-50 border-indigo-200 text-indigo-800', dot: 'bg-indigo-600' },
  { label: 'No black box', cls: 'bg-teal-50 border-teal-200 text-teal-800', dot: 'bg-teal-600' },
];


export default function Landing({ onSignIn, blurred = false }) {
  return (
    <div
      aria-hidden={blurred}
      className={`min-h-screen bg-white text-gray-900 relative overflow-hidden transition-[filter] duration-200 ${
        blurred ? 'blur-sm pointer-events-none select-none' : ''
      }`}
    >
      {/* soft background glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-gradient-to-b from-indigo-50 via-blue-50/40 to-transparent blur-3xl" />

      <header className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-8 pt-6">
        <span aria-hidden="true" />
        <div className="flex items-center gap-3">
          <div className="inline-flex w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gray-900 items-center justify-center shadow-lg">
            <BrandMark className="w-7 h-7" />
          </div>
          <span className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 whitespace-nowrap">Burden AI</span>
        </div>
        <button
          type="button"
          onClick={onSignIn}
          className="justify-self-end whitespace-nowrap px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 font-semibold shadow-sm hover:bg-gray-50 transition-colors"
        >
          Sign in
        </button>
      </header>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-8 pb-12">
        <section className="text-center pt-12 sm:pt-16">
          <p className="text-xs sm:text-sm font-semibold tracking-[0.25em] text-gray-500 uppercase">
            Burden AI · One system of record for burden cost
          </p>

          <h1 className="mt-5 text-[2rem] sm:text-6xl font-bold tracking-tight leading-[1.1]">
            <span className="block">
              Today's{' '}
              <span className="whitespace-nowrap bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
                true cost.
              </span>
            </span>
            <span className="block">
              Next year's{' '}
              <span className="whitespace-nowrap bg-gradient-to-r from-violet-600 to-teal-500 bg-clip-text text-transparent">
                best guess.
              </span>
            </span>
          </h1>

          <p className="mt-5 text-xl sm:text-2xl font-semibold text-gray-700">
            Know the true cost of every hour.
          </p>

          <p className="mt-4 max-w-3xl mx-auto text-lg sm:text-xl text-gray-500 leading-relaxed">
            Payroll and benefits sit in one system. Overhead sits in another —{' '}
            <span className="font-semibold text-gray-900">and the burden rate lives in a spreadsheet.</span>{' '}
            Burden AI replaces it with one audit-ready rate by country, cost center and employee, then
            forecasts next year from this year's actuals — every figure traced to a driver.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {pills.map((p) => (
              <span
                key={p.label}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm sm:text-base font-medium ${p.cls}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                {p.label}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-16" aria-label="Modules">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={onSignIn}
                  className={`group text-left flex flex-col rounded-2xl border border-gray-200 bg-gradient-to-b ${m.glow} to-white to-30% shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden`}
                >
                  <div className={`h-1.5 w-full ${m.bar}`} />
                  <div className="flex flex-col flex-1 p-6">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex w-12 h-12 rounded-xl ${m.tile} items-center justify-center`}>
                        <Icon className="w-6 h-6 text-white" />
                      </span>
                      <span className={`text-xl font-semibold ${m.title}`}>{m.name}</span>
                    </div>

                    <h3 className="mt-5 text-lg font-semibold leading-snug text-gray-900">{m.question}</h3>

                    <ul className="mt-4 space-y-2.5 flex-1">
                      {m.points.map((pt) => (
                        <li key={pt} className="flex gap-2.5 text-[15px] text-gray-500 leading-snug">
                          <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${m.check}`} />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-6 flex flex-wrap gap-2">
                      {m.tags.map((t) => (
                        <span key={t} className={`px-3 py-1 rounded-full text-sm ${m.tag}`}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <p className="mt-12 text-center text-sm text-gray-500">
          Workforce shown inside is illustrative sample data · access is by invitation.
        </p>
      </main>
    </div>
  );
}
