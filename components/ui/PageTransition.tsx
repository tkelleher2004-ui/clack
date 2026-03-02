"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

const defaultVariants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -8,
  },
};

export interface PageTransitionProps {
  children: ReactNode;
  className?: string;
  variants?: typeof defaultVariants;
}

export function PageTransition({
  children,
  className = "",
  variants = defaultVariants,
}: PageTransitionProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={{
        type: "spring",
        damping: 25,
        stiffness: 300,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
