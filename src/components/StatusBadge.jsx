import React from 'react';

const STYLES = {
  active:    'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  connected: 'bg-green-100 text-green-800',
  success:   'bg-green-100 text-green-800',
  processing:'bg-blue-100 text-blue-800',
  draft:     'bg-gray-100 text-gray-700',
  queued:    'bg-amber-100 text-amber-800',
  warning:   'bg-amber-100 text-amber-800',
  'on leave':'bg-amber-100 text-amber-800',
  failed:    'bg-red-100 text-red-800',
  offline:   'bg-red-100 text-red-800',
  error:     'bg-red-100 text-red-800',
};

export default function StatusBadge({ status }) {
  const key = String(status || '').toLowerCase();
  const cls = STYLES[key] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
