"use client";

import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";

export interface GlassSelectOption { value: string; label: string; }
export interface GlassSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string; options: GlassSelectOption[]; error?: string; placeholder?: string;
}

export const GlassSelect = forwardRef<HTMLSelectElement, GlassSelectProps>(
  ({ className = "", label, options, error, placeholder, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="w-full">
        {label && <label htmlFor={selectId} className="block text-sm font-medium mb-2" style={{ color: '#E4E4E7' }}>{label}</label>}
        <select
          ref={ref} id={selectId}
          className={`w-full px-4 py-3 pr-10 transition-all duration-200 outline-none appearance-none ${className}`}
          style={{
            backgroundColor: 'transparent',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: '14px',
            border: error ? '1px solid rgba(239,68,68,0.20)' : '1px solid rgba(255,255,255,0.08)',
            color: '#E4E4E7',
            boxShadow: error
              ? [
                  'inset 0 1px 0 0 rgba(239,68,68,0.35)',
                  'inset 1px 0 0 0 rgba(239,68,68,0.18)',
                  'inset -1px 0 0 0 rgba(239,68,68,0.06)',
                  'inset 0 -1px 0 0 rgba(239,68,68,0.04)',
                  '0 2px 12px rgba(0,0,0,0.3)',
                ].join(', ')
              : [
                  'inset 0 1px 0 0 rgba(255,255,255,0.22)',
                  'inset 1px 0 0 0 rgba(255,255,255,0.12)',
                  'inset -1px 0 0 0 rgba(255,255,255,0.05)',
                  'inset 0 -1px 0 0 rgba(255,255,255,0.03)',
                  '0 2px 12px rgba(0,0,0,0.3)',
                ].join(', '),
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23A1A1AA'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: '1.25rem',
            backgroundPosition: 'right 1rem center',
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = [
              'inset 0 1px 0 0 rgba(255,255,255,0.32)',
              'inset 1px 0 0 0 rgba(255,255,255,0.18)',
              'inset -1px 0 0 0 rgba(255,255,255,0.07)',
              'inset 0 -1px 0 0 rgba(255,255,255,0.04)',
              '0 2px 16px rgba(0,0,0,0.35)',
            ].join(', ');
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = error
              ? [
                  'inset 0 1px 0 0 rgba(239,68,68,0.35)',
                  'inset 1px 0 0 0 rgba(239,68,68,0.18)',
                  'inset -1px 0 0 0 rgba(239,68,68,0.06)',
                  'inset 0 -1px 0 0 rgba(239,68,68,0.04)',
                  '0 2px 12px rgba(0,0,0,0.3)',
                ].join(', ')
              : [
                  'inset 0 1px 0 0 rgba(255,255,255,0.22)',
                  'inset 1px 0 0 0 rgba(255,255,255,0.12)',
                  'inset -1px 0 0 0 rgba(255,255,255,0.05)',
                  'inset 0 -1px 0 0 rgba(255,255,255,0.03)',
                  '0 2px 12px rgba(0,0,0,0.3)',
                ].join(', ');
          }}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((o) => <option key={o.value} value={o.value} style={{ backgroundColor: '#1C1C1F', color: '#E4E4E7' }}>{o.label}</option>)}
        </select>
        {error && <p className="mt-1.5 text-sm" style={{ color: '#F87171' }}>{error}</p>}
      </div>
    );
  }
);
GlassSelect.displayName = "GlassSelect";
