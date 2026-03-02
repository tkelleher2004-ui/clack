"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

export interface GlassModalProps {
  isOpen: boolean; onClose: () => void; title?: string; children: React.ReactNode; size?: "sm" | "md" | "lg" | "full";
}

export function GlassModal({ isOpen, onClose, title, children, size = "md" }: GlassModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) { document.addEventListener("keydown", h); document.body.style.overflow = "hidden"; }
    return () => { document.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [isOpen, onClose]);

  const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", full: "max-w-[90vw] max-h-[90vh]" };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="fixed inset-0 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={onClose} aria-hidden />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              className={`pointer-events-auto w-full ${sizes[size]} overflow-hidden`}
              style={{
                background: 'transparent',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: [
                  'inset 0 1px 0 0 rgba(255,255,255,0.30)',
                  'inset 1px 0 0 0 rgba(255,255,255,0.18)',
                  'inset -1px 0 0 0 rgba(255,255,255,0.06)',
                  'inset 0 -1px 0 0 rgba(255,255,255,0.04)',
                  '0 8px 40px rgba(0,0,0,0.6)',
                ].join(', '),
              }}
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
            >
              <div className="p-6">
                {title && <h2 className="text-xl font-semibold mb-4" style={{ color: '#E4E4E7' }}>{title}</h2>}
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
