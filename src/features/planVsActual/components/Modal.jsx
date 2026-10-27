import React, { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({ title, subtitle, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`bg-white rounded-xl shadow-xl w-full ${wide ? "max-w-3xl" : "max-w-xl"} max-h-[90vh] flex flex-col`}>
        <div className="flex items-start justify-between gap-4 p-6 pb-3">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 p-1">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 pb-4 overflow-y-auto">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 p-6 pt-3 border-t border-gray-100">{footer}</div>}
      </div>
    </div>
  );
}
