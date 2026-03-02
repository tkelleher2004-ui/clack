"use client";

import type { HTMLAttributes } from "react";

export interface GlassNavbarProps extends HTMLAttributes<HTMLElement> { children: React.ReactNode; position?: "fixed" | "sticky" | "relative"; }

export function GlassNavbar({ className = "", children, position = "sticky", ...props }: GlassNavbarProps) {
  const pos = position === "fixed" ? "fixed top-0 left-0 right-0 z-40" : position === "sticky" ? "sticky top-0 z-40" : "";
  return (
    <nav className={`${pos} ${className}`}
      style={{
        background: 'transparent',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        boxShadow: [
          'inset 0 1px 0 0 rgba(255,255,255,0.30)',
          'inset 1px 0 0 0 rgba(255,255,255,0.18)',
          'inset -1px 0 0 0 rgba(255,255,255,0.06)',
          'inset 0 -1px 0 0 rgba(255,255,255,0.04)',
          '0 4px 24px rgba(0,0,0,0.4)',
        ].join(', '),
      }}
      {...props}
    >
      <div className="flex items-center justify-between px-4 py-3">{children}</div>
    </nav>
  );
}
