import React from 'react';

// Burden AI mark: a coin (cost) beside rising bars (rate). Used on the home
// page and in the app sidebar so the brand is the same everywhere.
export default function BrandMark({ className = '' }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="13" r="7" stroke="#FBBF24" strokeWidth="2.2" />
      <path d="M12 9.5v7M10 11.2c0-.9.9-1.5 2-1.5s2 .6 2 1.4M14 14.8c0 .9-.9 1.5-2 1.5s-2-.6-2-1.4" stroke="#FBBF24" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M19 26v-4M23.5 26v-7M28 26V15" stroke="#FBBF24" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
