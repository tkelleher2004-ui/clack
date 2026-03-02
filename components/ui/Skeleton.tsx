"use client";

import { motion } from "framer-motion";
import type { HTMLAttributes } from "react";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "circular" | "text"; width?: string | number; height?: string | number;
}

export function Skeleton({ className = "", variant = "default", width, height, style, ...props }: SkeletonProps) {
  const r = variant === "circular" ? '9999px' : variant === "text" ? '8px' : '12px';
  return (
    <motion.div className={`overflow-hidden ${className}`}
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: r,
        width: width ?? (variant === "text" ? "100%" : undefined),
        height: height ?? (variant === "text" ? "1em" : undefined),
        ...style,
      }}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      {...(props as React.ComponentProps<typeof motion.div>)}
    >
      <div className="h-full w-full -translate-x-full animate-[shimmer_1.5s_infinite]"
        style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.05), transparent)', backgroundSize: '200% 100%' }} />
    </motion.div>
  );
}
