// Drawer.jsx — right-hand panel used by the AI features.
import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function Drawer({ title, kicker, subtitle, onClose, children, footer, width = "max-w-[480px]", labelId }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end print:hidden">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px] cursor-default" />
      <aside
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className={`relative h-full w-full ${width} bg-white shadow-2xl border-l border-gray-200 flex flex-col outline-none`}
      >
        <header className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {kicker}
            <h2 id={labelId} className="text-lg font-bold text-gray-900 leading-snug">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close panel" className="p-1.5 -mr-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="border-t border-gray-100">{footer}</footer>}
      </aside>
    </div>
  );
}

export function AiKicker({ label = "AI explanation" }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
      <SparkIcon className="text-amber-500" /> {label}
    </div>
  );
}

export function SparkIcon({ size = 13, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z" fill="currentColor" />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" fill="currentColor" opacity=".6" />
    </svg>
  );
}
