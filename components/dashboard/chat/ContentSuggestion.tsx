"use client";

import type { ReactNode } from "react";

export interface ContentSuggestionProps {
  title: string;
  description: string;
  platformIcons?: ReactNode[];
  onAddToCalendar?: () => void;
  onAddToPlan?: () => void;
}

export function ContentSuggestion({
  title,
  description,
  platformIcons,
  onAddToCalendar,
  onAddToPlan,
}: ContentSuggestionProps) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "#141416",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      <p className="mt-1 text-xs text-zinc-500">{description}</p>
      {platformIcons && platformIcons.length > 0 && (
        <div className="mt-2 flex gap-2 text-zinc-500">{platformIcons.map((icon, i) => <span key={i} className="w-5 h-5 flex items-center justify-center">{icon}</span>)}</div>
      )}
      {(onAddToCalendar || onAddToPlan) && (
        <button
          type="button"
          onClick={onAddToPlan ?? onAddToCalendar}
          className="mt-3 rounded-lg px-3 py-1.5 text-xs font-medium border border-white/[0.06] text-zinc-300 hover:bg-white/[0.03] transition-colors"
        >
          Add to plan
        </button>
      )}
    </div>
  );
}
