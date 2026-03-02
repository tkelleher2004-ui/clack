"use client";

import type { HTMLAttributes } from "react";

export type GlassBadgeVariant = "default" | "success" | "warning" | "error" | "info";
export interface GlassBadgeProps extends HTMLAttributes<HTMLSpanElement> { variant?: GlassBadgeVariant; size?: "sm" | "md"; }

const dots: Record<GlassBadgeVariant, string> = { default: "#A1A1AA", success: "#4ADE80", warning: "#FBBF24", error: "#F87171", info: "#A1A1AA" };

export function GlassBadge({ className = "", variant = "default", size = "md", children, ...props }: GlassBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-2 font-medium ${className}`}
      style={{
        background: 'transparent',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderRadius: '9999px',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: [
          'inset 0 1px 0 0 rgba(255,255,255,0.26)',
          'inset 1px 0 0 0 rgba(255,255,255,0.14)',
          'inset -1px 0 0 0 rgba(255,255,255,0.05)',
          'inset 0 -1px 0 0 rgba(255,255,255,0.03)',
        ].join(', '),
        color: '#E4E4E7',
        padding: size === "sm" ? '2px 8px' : '4px 12px',
        fontSize: size === "sm" ? '12px' : '14px',
      }}
      {...props}
    >
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '9999px', backgroundColor: dots[variant] }} />
      <span>{children}</span>
    </span>
  );
}
