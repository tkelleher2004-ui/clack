"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

export interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className = "", label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && <label htmlFor={inputId} className="block text-sm font-medium mb-2" style={{ color: '#E4E4E7' }}>{label}</label>}
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-4 py-3 transition-all duration-200 outline-none ${className}`}
          style={{
            background: 'transparent',
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
        />
        {error && <p className="mt-1.5 text-sm" style={{ color: '#F87171' }}>{error}</p>}
        {hint && !error && <p className="mt-1.5 text-sm" style={{ color: '#71717A' }}>{hint}</p>}
      </div>
    );
  }
);
GlassInput.displayName = "GlassInput";
