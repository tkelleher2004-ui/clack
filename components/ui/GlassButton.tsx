"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ButtonHTMLAttributes } from "react";

export interface GlassButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "href"> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "cta" | "solid-white";
  size?: "sm" | "md" | "lg";
  pill?: boolean;
  circle?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  href?: string;
}

export function GlassButton({
  className = "",
  variant = "primary",
  size = "md",
  pill = true,
  circle = false,
  loading = false,
  fullWidth = false,
  disabled,
  href,
  children,
  ...props
}: GlassButtonProps) {
  const base = "relative inline-flex items-center justify-center gap-2 font-medium transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none";

  const sizes: Record<string, string> = {
    sm: circle ? "w-9 h-9 text-sm" : "px-5 py-2 text-sm",
    md: circle ? "w-11 h-11 text-base" : "px-7 py-3 text-base",
    lg: circle ? "w-14 h-14 text-lg" : "px-9 py-4 text-lg",
  };

  const radius = circle ? '50%' : pill ? '9999px' : '14px';

  const btnShadow = [
    'inset 0 1px 0 0 rgba(255,255,255,0.28)',
    'inset 1px 0 0 0 rgba(255,255,255,0.16)',
    'inset -1px 0 0 0 rgba(255,255,255,0.06)',
    'inset 0 -1px 0 0 rgba(255,255,255,0.04)',
    '0 4px 20px rgba(0,0,0,0.5)',
  ].join(', ');

  const btnShadowHover = [
    'inset 0 1px 0 0 rgba(255,255,255,0.36)',
    'inset 1px 0 0 0 rgba(255,255,255,0.20)',
    'inset -1px 0 0 0 rgba(255,255,255,0.08)',
    'inset 0 -1px 0 0 rgba(255,255,255,0.05)',
    '0 6px 24px rgba(0,0,0,0.55)',
  ].join(', ');

  const btnStyle: React.CSSProperties = {
    background: 'transparent',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: btnShadow,
    borderRadius: radius,
    color: '#E4E4E7',
  };

  if (variant === 'ghost') {
    btnStyle.border = '1px solid rgba(255,255,255,0.06)';
    btnStyle.boxShadow = 'inset 0 1px 0 0 rgba(255,255,255,0.10), inset 1px 0 0 0 rgba(255,255,255,0.06)';
    btnStyle.color = '#71717A';
  }

  if (variant === 'cta') {
    btnStyle.background = 'rgba(255,255,255,0.08)';
    btnStyle.boxShadow = [
      'inset 0 1px 0 0 rgba(255,255,255,0.40)',
      'inset 1px 0 0 0 rgba(255,255,255,0.22)',
      'inset -1px 0 0 0 rgba(255,255,255,0.08)',
      'inset 0 -1px 0 0 rgba(255,255,255,0.05)',
      '0 4px 24px rgba(0,0,0,0.5)',
    ].join(', ');
    btnStyle.color = '#FFFFFF';
  }

  if (variant === 'solid-white') {
    btnStyle.background = '#FFFFFF';
    btnStyle.color = '#000000';
    btnStyle.border = '1px solid rgba(255,255,255,0.2)';
    btnStyle.boxShadow = '0 4px 24px rgba(0,0,0,0.3)';
  }

  if (variant === 'danger') {
    btnStyle.border = '1px solid rgba(239,68,68,0.15)';
    btnStyle.boxShadow = [
      'inset 0 1px 0 0 rgba(239,68,68,0.30)',
      'inset 1px 0 0 0 rgba(239,68,68,0.15)',
      'inset -1px 0 0 0 rgba(239,68,68,0.06)',
      'inset 0 -1px 0 0 rgba(239,68,68,0.04)',
      '0 4px 20px rgba(0,0,0,0.5)',
    ].join(', ');
    btnStyle.color = '#F87171';
  }

  const hoverBg = variant === 'cta' ? 'rgba(255,255,255,0.12)' : variant === 'solid-white' ? 'rgb(212,212,216)' : 'rgba(255,255,255,0.03)';
  const ctaHoverShadow = [
    'inset 0 1px 0 0 rgba(255,255,255,0.48)',
    'inset 1px 0 0 0 rgba(255,255,255,0.26)',
    'inset -1px 0 0 0 rgba(255,255,255,0.10)',
    'inset 0 -1px 0 0 rgba(255,255,255,0.06)',
    '0 6px 28px rgba(0,0,0,0.55)',
  ].join(', ');
  const hoverShadow = variant === 'cta' ? ctaHoverShadow : variant === 'solid-white' ? '0 6px 28px rgba(0,0,0,0.35)' : btnShadowHover;

  const motionProps = {
    className: `${base} ${sizes[size]} ${variant === 'solid-white' ? 'font-semibold' : ''} ${fullWidth ? "w-full" : ""} ${className}`,
    style: btnStyle,
    whileHover: { background: hoverBg, boxShadow: hoverShadow },
    whileTap: { scale: 0.98 },
  };

  if (href && !disabled && !loading) {
    const { href: _h, ...linkProps } = props as React.ComponentProps<typeof Link> & { href?: string };
    return (
      <Link
        href={href}
        className={`${motionProps.className} hover:opacity-90`}
        style={motionProps.style}
        {...linkProps}
      >
        {children}
      </Link>
    );
  }

  return (
    <motion.button
      type="button"
      {...motionProps}
      disabled={disabled || loading}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-5 w-5 border-2 border-current/30 border-t-current rounded-full" viewBox="0 0 24 24" aria-hidden />
          <span className="sr-only">Loading</span>
        </>
      ) : children}
    </motion.button>
  );
}
