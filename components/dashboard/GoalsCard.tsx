"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "12px",
  boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.08), inset 0 -1px 0 0 rgba(0,0,0,0.02), 0 2px 12px rgba(0,0,0,0.2)",
};

const TIMEFRAME_LABELS: Record<string, string> = {
  "1_month": "1 month",
  "3_months": "3 months",
  "6_months": "6 months",
  "1_year": "1 year",
  none: "No timeframe",
};

const TIMEFRAME_OPTIONS = [
  { value: "1_month", label: "1 month" },
  { value: "3_months", label: "3 months" },
  { value: "6_months", label: "6 months" },
  { value: "1_year", label: "1 year" },
  { value: "none", label: "No timeframe" },
];

const EXAMPLE_PILLS = ["Grow to 10K", "Get brand deals", "Go viral", "Launch product"];

const SAMPLE_GOALS = [
  { label: "Instagram → 10K followers", progress: 28, value: "2,847 / 10,000" },
  { label: "Land first brand deal", progress: 0, value: "In progress" },
];

export interface GoalsCardProps {
  goalsRaw: string | null;
  goalsTimeframe: string | null;
  onGoalsUpdated?: (goalsRaw: string, goalsTimeframe: string) => void;
  aiAnnotation?: string;
  initialEditing?: boolean;
  initialGoalText?: string;
}

export function GoalsCard({
  goalsRaw,
  goalsTimeframe,
  onGoalsUpdated,
  aiAnnotation,
  initialEditing = false,
  initialGoalText,
}: GoalsCardProps) {
  const [editing, setEditing] = useState(initialEditing);
  const [editRaw, setEditRaw] = useState(initialGoalText ?? goalsRaw ?? "");
  const [editTimeframe, setEditTimeframe] = useState(goalsTimeframe ?? "");
  const [saving, setSaving] = useState(false);

  const hasGoals = !!goalsRaw?.trim();
  const hasSampleGoals = true;

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("brand_profiles")
      .update({
        goals_raw: editRaw.trim() || null,
        goals_timeframe: editTimeframe || null,
        goals_updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    setSaving(false);
    if (!error) {
      onGoalsUpdated?.(editRaw.trim(), editTimeframe);
      setEditing(false);
    }
  };

  const handleCancel = () => {
    setEditRaw(goalsRaw ?? "");
    setEditTimeframe(goalsTimeframe ?? "");
    setEditing(false);
  };

  return (
    <div className="p-5 rounded-xl transition-all duration-150 hover:border-white/[0.10]" style={CARD_STYLE}>
      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">What are you trying to accomplish?</label>
            <textarea
              rows={3}
              className="w-full px-4 py-3 rounded-lg outline-none resize-none text-sm bg-[#1E1E22] border border-white/[0.06] text-zinc-200 placeholder-zinc-500 transition-colors"
              placeholder="e.g. I want to grow my Instagram to 10K and land brand deals..."
              value={editRaw}
              onChange={(e) => setEditRaw(e.target.value)}
            />
          </div>
          <select
            value={editTimeframe}
            onChange={(e) => setEditTimeframe(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg text-sm bg-[#1E1E22] border border-white/[0.06] text-zinc-200 outline-none"
          >
            <option value="">Select timeframe</option>
            {TIMEFRAME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Set Goals →"}
            </button>
          </div>
        </div>
      ) : hasGoals ? (
        <>
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-sm font-medium text-zinc-300">Goals</span>
            <div className="flex items-center gap-2">
              {goalsTimeframe && (
                <span className="text-xs text-zinc-500">{TIMEFRAME_LABELS[goalsTimeframe] ?? goalsTimeframe}</span>
              )}
              <button type="button" onClick={() => setEditing(true)} className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                Edit
              </button>
            </div>
          </div>
          <p className="text-sm text-zinc-400 line-clamp-2 mb-4">{goalsRaw}</p>
          {hasSampleGoals && (
            <div className="space-y-3">
              {SAMPLE_GOALS.map((goal, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 flex-1 min-w-0 truncate">{goal.label}</span>
                  <div className="flex-1 min-w-[80px] h-1 rounded-full bg-[#1E1E22] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-400"
                      style={{ width: `${Math.min(goal.progress, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500 shrink-0 w-20 text-right">{goal.value}</span>
                </div>
              ))}
            </div>
          )}
          {aiAnnotation && (
            <p className="text-xs text-zinc-600 italic mt-3 flex items-start gap-1.5">
              <span className="text-purple-400/60">✦</span>
              {aiAnnotation}
            </p>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-300">Set your goals</p>
          <p className="text-sm text-zinc-500">What are you trying to accomplish with your social media?</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PILLS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { setEditRaw(p); setEditing(true); }}
                className="px-3 py-1 rounded-full text-[13px] border border-white/[0.06] text-zinc-400 hover:border-purple-500/30 hover:text-purple-400 transition-all duration-150"
              >
                {p}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors"
          >
            Set Goals →
          </button>
        </div>
      )}
    </div>
  );
}
