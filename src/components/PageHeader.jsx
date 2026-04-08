import React from 'react';

// Standard page header: optional icon + title + subtitle, with actions slot.
export default function PageHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Icon size={20} className="text-blue-600" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
