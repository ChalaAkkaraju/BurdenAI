// PrintView.jsx
// A board-ready static rendering of the forecast — designed for paper /
// PDF output. Hidden on screen via .print-only class; the screen-only
// interactive UI is hidden in print via @media rules in index.css.
//
// Stays away from Recharts (which renders unreliably in print contexts)
// and uses plain HTML+CSS for everything.

import React from "react";

const formatUSD = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
};
const formatRate = (n) => `$${n.toFixed(2)}/hr`;
const formatPct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const formatNumber = (n) => n.toLocaleString();

function deltaPct(value, base) {
  if (!base || base === 0) return 0;
  return ((value - base) / base) * 100;
}

const COUNTRY_NAME = {
  US: "USA", IN: "India", GB: "UK", DE: "Germany",
  JP: "Japan", AU: "Australia", SG: "Singapore", BR: "Brazil",
  FR: "France", CA: "Canada", MX: "Mexico", PH: "Philippines",
};

export default function PrintView({
  baseline,
  baselineLabel,
  forecastYear,
  horizonYears,
  active,
  scenarios,
  countryForecast,
  currentUser,
}) {
  const horizonLabel = horizonYears > 1
    ? `${forecastYear}–${forecastYear + horizonYears - 1}`
    : String(forecastYear);

  const baseRate = baseline.totalBurden / baseline.productiveHours;
  const totalDeltaPct = deltaPct(active.result.forecastedTotal, baseline.totalBurden);

  return (
    <div className="print-view">
      {/* ============ HEADER ============ */}
      <header className="print-header">
        <div>
          <div className="print-eyebrow">BURDENAI · FORECAST {horizonLabel}</div>
          <h1 className="print-title">Forecast brief — {active.name}</h1>
          <div className="print-subtitle">
            From {baselineLabel} · {active.description}
          </div>
        </div>
        <div className="print-meta">
          <div><strong>Generated:</strong> {new Date().toLocaleString()}</div>
          {currentUser?.name && <div><strong>By:</strong> {currentUser.name}</div>}
        </div>
      </header>

      {/* ============ BASELINE STRIP ============ */}
      <section className="print-section">
        <div className="print-section-label">BASELINE</div>
        <div className="print-baseline-grid">
          <div><span className="print-stat-label">Total burden</span><span className="print-stat-value">{formatUSD(baseline.totalBurden)}</span></div>
          <div><span className="print-stat-label">Headcount</span><span className="print-stat-value">{formatNumber(baseline.headcount)}</span></div>
          <div><span className="print-stat-label">Productive hours</span><span className="print-stat-value">{formatNumber(Math.round(baseline.productiveHours))}</span></div>
          <div><span className="print-stat-label">Burden rate</span><span className="print-stat-value">{formatRate(baseRate)}</span></div>
        </div>
      </section>

      {/* ============ ACTIVE SCENARIO KPIs ============ */}
      <section className="print-section">
        <div className="print-section-label">FORECAST · {active.name.toUpperCase()}</div>
        <div className="print-kpi-grid">
          <div className="print-kpi">
            <span className="print-kpi-label">Forecasted total burden</span>
            <span className="print-kpi-value">{formatUSD(active.result.forecastedTotal)}</span>
            <span className={`print-kpi-delta ${totalDeltaPct >= 0 ? "up" : "down"}`}>
              {formatPct(totalDeltaPct)} vs baseline
            </span>
          </div>
          <div className="print-kpi">
            <span className="print-kpi-label">Forecasted burden rate</span>
            <span className="print-kpi-value">{formatRate(active.result.forecastedRate)}</span>
            <span className={`print-kpi-delta ${active.result.forecastedRate >= baseRate ? "up" : "down"}`}>
              {formatPct(deltaPct(active.result.forecastedRate, baseRate))} vs baseline
            </span>
          </div>
          <div className="print-kpi">
            <span className="print-kpi-label">Forecasted headcount</span>
            <span className="print-kpi-value">{formatNumber(active.result.forecastedHeadcount)}</span>
            <span className={`print-kpi-delta ${active.result.forecastedHeadcount >= baseline.headcount ? "up" : "down"}`}>
              {formatPct(deltaPct(active.result.forecastedHeadcount, baseline.headcount))} vs baseline
            </span>
          </div>
        </div>
      </section>

      {/* ============ ACTIVE SCENARIO DRIVERS ============ */}
      <section className="print-section">
        <div className="print-section-label">DRIVERS APPLIED</div>
        <table className="print-table">
          <thead>
            <tr>
              <th>Driver</th>
              <th className="print-num">Value</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Inflation</td><td className="print-num">{active.drivers.inflationPct}%</td><td>Blended wage + benefits + overhead</td></tr>
            <tr><td>Productivity gain</td><td className="print-num">{active.drivers.productivityPct}%</td><td>Same output achieved with less people-cost</td></tr>
            <tr><td>AOP headcount delta</td><td className="print-num">{active.drivers.aopHeadcountDeltaPct >= 0 ? "+" : ""}{active.drivers.aopHeadcountDeltaPct}%</td><td>Planned headcount growth from AOP</td></tr>
            <tr><td>Hiring ramp</td><td className="print-num">{active.drivers.hiringRamp ?? 1}</td><td>{active.drivers.hiringRamp >= 0.7 ? "Front-loaded" : active.drivers.hiringRamp >= 0.4 ? "Uniform across year" : "Back-loaded"}</td></tr>
            <tr><td>FX hedge ratio</td><td className="print-num">{active.drivers.hedgeRatio ?? 0}</td><td>{active.drivers.hedgeRatio >= 0.99 ? "Fully hedged" : active.drivers.hedgeRatio <= 0.01 ? "Unhedged (full FX impact)" : `${Math.round((1 - active.drivers.hedgeRatio) * 100)}% FX exposure flows through`}</td></tr>
          </tbody>
        </table>
      </section>

      {/* ============ WATERFALL (static card flow) ============ */}
      <section className="print-section">
        <div className="print-section-label">FORECAST BRIDGE</div>
        <div className="print-waterfall">
          {active.result.waterfall.map((step, idx) => {
            const isAnchor = step.kind === "anchor";
            const isPositive = step.value >= 0;
            const stepClass = isAnchor ? "anchor" : isPositive ? "delta-up" : "delta-down";
            return (
              <React.Fragment key={idx}>
                <div className={`print-wf-step ${stepClass}`}>
                  <div className="print-wf-label">{step.label}</div>
                  {isAnchor ? (
                    <div className="print-wf-value">{formatUSD(step.cumulative)}</div>
                  ) : (
                    <>
                      <div className="print-wf-delta">{step.value >= 0 ? "+" : ""}{formatUSD(step.value)}</div>
                      <div className="print-wf-running">→ {formatUSD(step.cumulative)}</div>
                    </>
                  )}
                </div>
                {idx < active.result.waterfall.length - 1 && <div className="print-wf-arrow">→</div>}
              </React.Fragment>
            );
          })}
        </div>
      </section>

      {/* ============ SCENARIO COMPARISON ============ */}
      <section className="print-section page-break">
        <div className="print-section-label">SCENARIO COMPARISON</div>
        <table className="print-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th className="print-num">Inflation</th>
              <th className="print-num">Productivity</th>
              <th className="print-num">AOP Δ</th>
              <th className="print-num">Ramp</th>
              <th className="print-num">Hedge</th>
              <th className="print-num">Total burden</th>
              <th className="print-num">Burden rate</th>
              <th className="print-num">Headcount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="print-baseline-row">
              <td><strong>Baseline</strong></td>
              <td className="print-num">—</td>
              <td className="print-num">—</td>
              <td className="print-num">—</td>
              <td className="print-num">—</td>
              <td className="print-num">—</td>
              <td className="print-num"><strong>{formatUSD(baseline.totalBurden)}</strong></td>
              <td className="print-num"><strong>{formatRate(baseRate)}</strong></td>
              <td className="print-num"><strong>{formatNumber(baseline.headcount)}</strong></td>
            </tr>
            {scenarios.map((s) => (
              <tr key={s.id} className={s.id === active.id ? "print-active-row" : ""}>
                <td>{s.name}{s.id === active.id && " ★"}</td>
                <td className="print-num">{s.drivers.inflationPct}%</td>
                <td className="print-num">{s.drivers.productivityPct}%</td>
                <td className="print-num">{s.drivers.aopHeadcountDeltaPct >= 0 ? "+" : ""}{s.drivers.aopHeadcountDeltaPct}%</td>
                <td className="print-num">{s.drivers.hiringRamp ?? 1}</td>
                <td className="print-num">{s.drivers.hedgeRatio ?? 0}</td>
                <td className="print-num">{formatUSD(s.result.forecastedTotal)}<br/><span className="print-tiny">{formatPct(deltaPct(s.result.forecastedTotal, baseline.totalBurden))}</span></td>
                <td className="print-num">{formatRate(s.result.forecastedRate)}<br/><span className="print-tiny">{formatPct(deltaPct(s.result.forecastedRate, baseRate))}</span></td>
                <td className="print-num">{formatNumber(s.result.forecastedHeadcount)}<br/><span className="print-tiny">{formatPct(deltaPct(s.result.forecastedHeadcount, baseline.headcount))}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="print-tiny print-legend">★ = active scenario at print time</div>
      </section>

      {/* ============ COUNTRY BREAKDOWN (if available) ============ */}
      {countryForecast && countryForecast.byCountry && countryForecast.byCountry.length > 0 && (
        <section className="print-section page-break">
          <div className="print-section-label">COUNTRY BREAKDOWN — {active.name.toUpperCase()}</div>
          <table className="print-table">
            <thead>
              <tr>
                <th>Country</th>
                <th className="print-num">Baseline</th>
                <th className="print-num">Forecast</th>
                <th className="print-num">Δ vs base</th>
                <th className="print-num">Burden rate</th>
                <th className="print-num">Headcount</th>
                <th className="print-num">Share</th>
              </tr>
            </thead>
            <tbody>
              {[...countryForecast.byCountry]
                .sort((a, b) => b.forecastedTotal - a.forecastedTotal)
                .map((c) => {
                  const dp = deltaPct(c.forecastedTotal, c.baseline.totalBurden);
                  return (
                    <tr key={c.countryCode}>
                      <td>{COUNTRY_NAME[c.countryCode] || c.label} <span className="print-tiny">{c.countryCode}</span></td>
                      <td className="print-num">{formatUSD(c.baseline.totalBurden)}</td>
                      <td className="print-num"><strong>{formatUSD(c.forecastedTotal)}</strong></td>
                      <td className={`print-num ${dp >= 0 ? "delta-up-text" : "delta-down-text"}`}>{formatPct(dp)}</td>
                      <td className="print-num">{formatRate(c.forecastedRate)}</td>
                      <td className="print-num">{formatNumber(c.forecastedHeadcount)}</td>
                      <td className="print-num">{c.contributionPct?.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              <tr className="print-total-row">
                <td><strong>TOTAL</strong></td>
                <td className="print-num"><strong>{formatUSD(countryForecast.totals.baselineTotal)}</strong></td>
                <td className="print-num"><strong>{formatUSD(countryForecast.totals.forecastedTotal)}</strong></td>
                <td className="print-num"><strong>{formatPct(deltaPct(countryForecast.totals.forecastedTotal, countryForecast.totals.baselineTotal))}</strong></td>
                <td className="print-num"><strong>{formatRate(countryForecast.totals.forecastedRate)}</strong></td>
                <td className="print-num"><strong>{formatNumber(countryForecast.totals.forecastedHeadcount)}</strong></td>
                <td className="print-num"><strong>100.0%</strong></td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* ============ NOTES (if any) ============ */}
      {active.notes && (
        <section className="print-section">
          <div className="print-section-label">NOTES — {active.name.toUpperCase()}</div>
          <div className="print-notes">{active.notes}</div>
        </section>
      )}

      {/* ============ FOOTER ============ */}
      <footer className="print-footer">
        BurdenAI · Forecast brief · {horizonLabel} · Generated {new Date().toLocaleDateString()}
      </footer>
    </div>
  );
}
