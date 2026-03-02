"use client";

import { motion } from "framer-motion";
import type { HTMLAttributes } from "react";

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "subtle" | "small";
  hover?: boolean;
}

const BASE: React.CSSProperties = {
  background: 'transparent',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '20px',
  boxShadow: [
    'inset 0 1px 0 0 rgba(255,255,255,0.30)',
    'inset 0 -1px 0 0 rgba(0,0,0,0.04)',
    'inset 1px 0 0 0 rgba(255,255,255,0.18)',
    'inset -1px 0 0 0 rgba(0,0,0,0.06)',
    '0 4px 24px rgba(0,0,0,0.5)',
  ].join(', '),
};

const SMALL: React.CSSProperties = {
  background: 'transparent',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '14px',
  boxShadow: [
    'inset 0 1px 0 0 rgba(255,255,255,0.15)',
    'inset 0 -1px 0 0 rgba(0,0,0,0.03)',
    'inset 1px 0 0 0 rgba(255,255,255,0.08)',
    'inset -1px 0 0 0 rgba(0,0,0,0.04)',
    '0 2px 8px rgba(0,0,0,0.3)',
  ].join(', '),
};

export function GlassCard({ className = "", hover = true, variant = "default", children, ...props }: GlassCardProps) {
  const style = variant === "small" ? SMALL : BASE;
  if (hover) {
    return (
      <motion.div
        className={`relative overflow-hidden ${className}`}
        style={style}
        initial={false}
        whileHover={{
          background: 'rgba(255,255,255,0.03)',
          boxShadow: [
            'inset 0 1px 0 0 rgba(255,255,255,0.38)',
            'inset 1px 0 0 0 rgba(255,255,255,0.22)',
            'inset -1px 0 0 0 rgba(255,255,255,0.08)',
            'inset 0 -1px 0 0 rgba(255,255,255,0.05)',
            '0 6px 28px rgba(0,0,0,0.55)',
          ].join(', '),
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        {...(props as React.ComponentProps<typeof motion.div>)}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={style} {...props}>
      {children}
    </div>
  );
}
