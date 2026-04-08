import React from 'react';

/**
 * Renders a country flag image using flagcdn.com.
 * Props:
 *   code  – ISO 3166-1 alpha-2 country code (e.g. "US", "IN", "GB")
 *   size  – pixel width (default 20). Height is auto (aspect ~3:2).
 *   className – extra CSS classes
 */
const FlagIcon = ({ code, size = 20, className = '' }) => {
  if (!code) return null;
  const lc = code.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/w40/${lc}.png`}
      srcSet={`https://flagcdn.com/w80/${lc}.png 2x`}
      width={size}
      alt={code}
      className={`inline-block rounded-sm shadow-sm ${className}`}
      style={{ height: 'auto', verticalAlign: 'middle' }}
      loading="lazy"
    />
  );
};

export default FlagIcon;
