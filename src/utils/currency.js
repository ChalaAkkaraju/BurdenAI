// Currency formatting utilities for multi-currency display
// Amounts in costData are stored in USD. Use fxFromUSD to convert to local currency.

import { countries } from '../data/orgHierarchy.js';

// Lookup table: countryCode → country info
const countryMap = Object.fromEntries(countries.map(c => [c.code, c]));

/**
 * Get country currency info by country code
 */
export function getCurrencyInfo(countryCode) {
  return countryMap[countryCode] || countryMap['US'];
}

/**
 * Convert a USD amount to local currency
 */
export function usdToLocal(usdAmount, fxFromUSD) {
  return usdAmount * (fxFromUSD || 1.0);
}

/**
 * Convert a local currency amount to USD
 */
export function localToUSD(localAmount, fxToUSD) {
  return localAmount * (fxToUSD || 1.0);
}

/**
 * Format a USD amount with $ symbol and K/M abbreviations
 */
export function formatUSD(value) {
  if (value === null || value === undefined || isNaN(value)) return '$0';
  const absValue = Math.abs(value);
  if (absValue >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (absValue >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Format a value in local currency with the correct symbol and K/M abbreviations
 */
export function formatLocalCurrency(usdValue, currencySymbol, fxFromUSD) {
  const local = usdValue * (fxFromUSD || 1.0);
  const sym = currencySymbol || '$';
  const absValue = Math.abs(local);
  if (absValue >= 1_000_000) return `${sym}${(local / 1_000_000).toFixed(1)}M`;
  if (absValue >= 1_000) return `${sym}${(local / 1_000).toFixed(1)}K`;
  return `${sym}${local.toFixed(0)}`;
}

/**
 * Format a value in local currency (full precision, no abbreviation)
 */
export function formatLocalCurrencyFull(usdValue, currencySymbol, fxFromUSD) {
  const local = usdValue * (fxFromUSD || 1.0);
  const sym = currencySymbol || '$';
  return `${sym}${Math.round(local).toLocaleString()}`;
}

/**
 * Format a USD value into local currency given a country code.
 * Returns '—' for null/undefined inputs. Convenience wrapper used by tables.
 */
export function formatByCountry(usdValue, countryCode) {
  if (typeof usdValue !== 'number' || isNaN(usdValue)) return '—';
  const c = countryMap[countryCode] || countryMap['US'];
  return formatLocalCurrencyFull(usdValue, c.symbol, c.fxFromUSD);
}

/**
 * Format a burden rate in local currency per hour
 */
export function formatLocalRate(usdRate, currencySymbol, fxFromUSD) {
  const local = usdRate * (fxFromUSD || 1.0);
  const sym = currencySymbol || '$';
  return `${sym}${local.toFixed(2)}/hr`;
}

/**
 * Get FX rate display string, e.g. "1 USD = 84.53 INR"
 */
export function formatFxRate(countryCode) {
  const c = countryMap[countryCode];
  if (!c || c.code === 'US') return null;
  return `1 USD = ${c.fxFromUSD} ${c.currency}`;
}

/**
 * Get compact FX rate, e.g. "₹84.53/USD"
 */
export function formatFxRateCompact(countryCode) {
  const c = countryMap[countryCode];
  if (!c || c.code === 'US') return null;
  return `${c.symbol}${c.fxFromUSD}/$`;
}

/**
 * Build an FX rate summary table for all non-USD countries
 */
export function getFxRateSummary() {
  return countries
    .filter(c => c.code !== 'US')
    .map(c => ({
      code: c.code,
      name: c.name,
      currency: c.currency,
      symbol: c.symbol,
      fxToUSD: c.fxToUSD,
      fxFromUSD: c.fxFromUSD,
      rateDisplay: `1 USD = ${c.fxFromUSD} ${c.currency}`,
    }));
}
