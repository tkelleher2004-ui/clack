"use client";

import type { ReactNode } from "react";

export interface InsightCardProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function InsightCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: InsightCardProps) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "#141416",
        border: "1px solid rgba(255,255,255,0.06)",
        borderLeft: "2px solid #8B5CF6",
      }}
    >
      <div className="flex items-start gap-3">
        {icon && <span className="shrink-0 text-zinc-500">{icon}</span>}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-300">{title}</p>
          {description && <p className="mt-1 text-xs text-zinc-500">{description}</p>}
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="mt-2 rounded-lg px-3 py-1.5 text-xs font-medium text-purple-400 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/15 transition-colors"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
