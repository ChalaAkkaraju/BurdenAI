// WaterfallChart.jsx
// "Bridge flow" representation — each step is a card with the running total,
// and each transition shows the driver name + delta. Reads left-to-right
// like a narrative, which is far more accessible for executive audiences
// than a stacked-bar waterfall.

import React from "react";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";

const formatUSD = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
};

const formatDelta = (n) => {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${formatUSD(n)}`;
};

export default function WaterfallChart({ waterfall }) {
  if (!waterfall || waterfall.length === 0) return null;

  const anchors = waterfall.filter((s) => s.kind === "anchor");
  const start = anchors[0];
  const end = anchors[anchors.length - 1];
  const totalDelta = end.cumulative - start.cumulative;
  const totalPct = start.cumulative > 0 ? (totalDelta / start.cumulative) * 100 : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Forecast bridge</h3>
          <p className="text-xs text-gray-500 mt-1">
            How each driver moves baseline burden to the forecast
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Net change</div>
          <div className={`text-lg font-bold font-mono ${totalDelta >= 0 ? "text-red-600" : "text-emerald-600"}`}>
            {formatDelta(totalDelta)} <span className="text-sm">({totalDelta >= 0 ? "+" : ""}{totalPct.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* Horizontal flow — wraps gracefully on narrow viewports */}
      <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
        {waterfall.map((step, idx) => {
          const isAnchor = step.kind === "anchor";
          const isLast = idx === waterfall.length - 1;
          const isPositive = step.value >= 0;

          if (isAnchor) {
            return (
              <React.Fragment key={idx}>
                <div className="flex-shrink-0 min-w-[140px] flex flex-col items-center justify-center p-3 rounded-lg bg-slate-800 text-white shadow-md">
                  <div className="text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                    {step.label}
                  </div>
                  <div className="text-2xl font-bold font-mono">
                    {formatUSD(step.cumulative)}
                  </div>
                </div>
                {!isLast && (
                  <div className="flex-shrink-0 flex items-center justify-center px-1">
                    <ArrowRight size={20} className="text-gray-300" />
                  </div>
                )}
              </React.Fragment>
            );
          }

          // Delta step — colored card showing driver contribution
          const bgColor = isPositive ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200";
          const textColor = isPositive ? "text-red-700" : "text-emerald-700";
          const iconColor = isPositive ? "text-red-500" : "text-emerald-500";
          const TrendIcon = isPositive ? TrendingUp : TrendingDown;
          const hasBreakdown = Array.isArray(step.breakdown) && step.breakdown.length > 0;

          return (
            <React.Fragment key={idx}>
              <div className={`group relative flex-shrink-0 min-w-[140px] flex flex-col items-center justify-center p-3 rounded-lg border ${bgColor}`}>
                <div className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider mb-1 ${textColor}`}>
                  <TrendIcon size={11} className={iconColor} />
                  {step.label.replace(/^[+-]\s*/, "")}
                </div>
                <div className={`text-xl font-bold font-mono ${textColor}`}>
                  {formatDelta(step.value)}
                </div>
                <div className="text-xs text-gray-500 font-mono mt-1">
                  → {formatUSD(step.cumulative)}
                </div>
                {hasBreakdown && (
                  <>
                    <div className="text-[9px] text-gray-400 mt-1 italic">hover for detail</div>
                    <div className="hidden group-hover:block absolute z-20 top-full left-1/2 -translate-x-1/2 mt-1 w-56 bg-white border border-gray-300 rounded-lg shadow-xl p-2 text-left">
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        Per-country breakdown
                      </div>
                      <div className="space-y-0.5 max-h-48 overflow-y-auto">
                        {step.breakdown.slice(0, 8).map((b) => (
                          <div key={b.countryCode} className="flex items-baseline justify-between text-xs">
                            <span className="text-gray-700">{b.label}</span>
                            <span className={`font-mono font-semibold ${b.delta >= 0 ? "text-red-700" : "text-emerald-700"}`}>
                              {formatDelta(b.delta)}
                            </span>
                          </div>
                        ))}
                        {step.breakdown.length > 8 && (
                          <div className="text-[10px] text-gray-400 italic">+ {step.breakdown.length - 8} more</div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              {!isLast && (
                <div className="flex-shrink-0 flex items-center justify-center px-1">
                  <ArrowRight size={20} className="text-gray-300" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Small running-total trend visualization at the bottom */}
      <div className="mt-5 pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-semibold">Running total trajectory</div>
        <Sparkline waterfall={waterfall} />
      </div>
    </div>
  );
}

// Tiny inline SVG sparkline — running total at each step, color-coded segments.
function Sparkline({ waterfall }) {
  const W = 600;
  const H = 60;
  const PAD = 12;
  const points = waterfall.map((s) => s.cumulative);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = (W - PAD * 2) / (points.length - 1 || 1);

  const xy = points.map((p, i) => ({
    x: PAD + i * stepX,
    y: PAD + (1 - (p - min) / range) * (H - PAD * 2),
  }));

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ maxWidth: "100%" }}>
      {/* Segments: each colored by direction of change */}
      {xy.slice(0, -1).map((p, i) => {
        const next = xy[i + 1];
        const delta = points[i + 1] - points[i];
        const stroke = Math.abs(delta) < 1e-6 ? "#94a3b8" : delta > 0 ? "#dc2626" : "#059669";
        return (
          <line
            key={i}
            x1={p.x} y1={p.y} x2={next.x} y2={next.y}
            stroke={stroke}
            strokeWidth={2.5}
          />
        );
      })}
      {/* Dots at each point */}
      {xy.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="#1e293b" />
      ))}
      {/* Labels: first and last only, to keep it clean */}
      <text x={xy[0].x} y={H - 1} fontSize="10" fill="#64748b" textAnchor="start">
        {waterfall[0].label}
      </text>
      <text x={xy[xy.length - 1].x} y={H - 1} fontSize="10" fill="#64748b" textAnchor="end">
        {waterfall[waterfall.length - 1].label}
      </text>
    </svg>
  );
}
