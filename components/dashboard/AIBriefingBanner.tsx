"use client";

import { useEffect, useState } from "react";

interface AIBriefingBannerProps {
  onChat?: () => void;
}

export function AIBriefingBanner({ onChat }: AIBriefingBannerProps) {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const dismissKey = "clack_briefing_dismissed";
    if (sessionStorage.getItem(dismissKey)) {
      setLoading(false);
      return;
    }

    fetch("/api/briefing")
      .then((r) => r.json())
      .then((data: { briefing?: string | null }) => {
        if (data.briefing) setBriefing(data.briefing);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("clack_briefing_dismissed", "1");
  };

  if (loading || dismissed || !briefing) return null;

  return (
    <div
      className="rounded-xl p-4 mb-5 relative"
      style={{
        background: "#111111",
        border: "1px solid rgba(124,92,252,0.35)",
        borderLeft: "3px solid #7C5CFC",
        boxShadow: "0 0 20px rgba(124,92,252,0.12)",
      }}
    >
      {/* Dismiss */}
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-3 right-3 w-6 h-6 rounded-md flex items-center justify-center transition-colors"
        style={{ color: "#5A5A78" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "#9090AA";
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "#5A5A78";
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        }}
        aria-label="Dismiss"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5 pr-6">
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
          style={{ background: "rgba(124,92,252,0.25)" }}
        >
          <span style={{ color: "#A78BFA", fontSize: "10px" }}>✦</span>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#A78BFA" }}>
          Morning Brief
        </span>
      </div>

      {/* Content */}
      <p className="text-[13px] leading-relaxed pr-2" style={{ color: "#9090AA" }}>
        {briefing}
      </p>

      {/* CTA */}
      {onChat && (
        <button
          type="button"
          onClick={() => {
            dismiss();
            onChat();
          }}
          className="mt-3 text-[12px] font-medium transition-colors"
          style={{ color: "#A78BFA" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#7C5CFC";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#A78BFA";
          }}
        >
          Open AI chat →
        </button>
      )}
    </div>
  );
}
