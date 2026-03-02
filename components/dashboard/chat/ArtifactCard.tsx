"use client";

import { useState } from "react";

export interface ArtifactCardProps {
  title: string;
  type: string;
  data: Record<string, unknown>;
  id?: string;
  pinned?: boolean;
  onPin?: () => void;
}

export function ArtifactCard({
  title,
  type,
  data,
  pinned = false,
  onPin,
}: ArtifactCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="my-3 rounded-xl overflow-hidden"
      style={{
        background: "#141416",
        border: "1px solid rgba(255,255,255,0.06)",
        borderLeft: "2px solid #8B5CF6",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.04)]">
        <h4 className="text-sm font-medium text-zinc-200">{title}</h4>
        <div className="flex items-center gap-2">
          {onPin && (
            <button
              type="button"
              onClick={onPin}
              className={`text-sm transition-colors ${pinned ? "text-purple-400" : "text-zinc-600 hover:text-purple-400"}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {/* Summary (always visible) */}
      <div className="px-4 py-3">
        {type === "deep_dive" && (
          <>
            <p className="text-sm text-zinc-400 mb-3">
              {data.summary as string}
            </p>

            {/* Score badge */}
            <div className="inline-flex items-center gap-2 mb-3">
              <span
                className={`text-2xl font-bold ${
                  (data.overall_score as number) >= 7
                    ? "text-emerald-400"
                    : (data.overall_score as number) >= 5
                      ? "text-amber-400"
                      : "text-red-400"
                }`}
              >
                {String(data.overall_score ?? "—")}
              </span>
              <span className="text-xs text-zinc-500">/10 overall</span>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="text-xs">
                <span className="text-emerald-400">
                  ✓ {(data.strengths as unknown[])?.length || 0} strengths
                </span>
              </div>
              <div className="text-xs">
                <span className="text-amber-400">
                  {(data.weaknesses as unknown[])?.length || 0} areas to improve
                </span>
              </div>
              <div className="text-xs">
                <span className="text-zinc-400">
                  {(data.recommendations as unknown[])?.length || 0} recommendations
                </span>
              </div>
              <div className="text-xs">
                <span className="text-zinc-400">Weekly plan included</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Expanded content */}
      {expanded && type === "deep_dive" && (
        <div className="px-4 pb-4 space-y-4 border-t border-[rgba(255,255,255,0.04)] pt-3">
          {/* Strengths */}
          <div>
            <h5 className="text-xs font-medium text-emerald-400 mb-2">
              STRENGTHS
            </h5>
            {(data.strengths as Array<{ point?: string; evidence?: string }>)?.map(
              (s, i) => (
                <div key={i} className="mb-2">
                  <p className="text-sm text-zinc-300">{s.point}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{s.evidence}</p>
                </div>
              )
            )}
          </div>

          {/* Weaknesses */}
          <div>
            <h5 className="text-xs font-medium text-amber-400 mb-2">
              AREAS TO IMPROVE
            </h5>
            {(data.weaknesses as Array<{ point?: string; evidence?: string }>)?.map(
              (w, i) => (
                <div key={i} className="mb-2">
                  <p className="text-sm text-zinc-300">{w.point}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{w.evidence}</p>
                </div>
              )
            )}
          </div>

          {/* Top Posts */}
          <div>
            <h5 className="text-xs font-medium text-purple-400 mb-2">
              TOP PERFORMING CONTENT
            </h5>
            {(data.top_posts as Array<{
              caption_preview?: string;
              likes?: number;
              comments?: number;
              content_type?: string;
              virality_score?: number;
            }>)?.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-3 mb-2 py-2 border-b border-[rgba(255,255,255,0.03)]"
              >
                <span
                  className={`text-lg font-bold ${
                    (p.virality_score ?? 0) >= 7
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}
                >
                  {p.virality_score}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 truncate">
                    {p.caption_preview}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {p.likes} likes · {p.comments} comments · {p.content_type}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          <div>
            <h5 className="text-xs font-medium text-zinc-300 mb-2">
              ACTION PLAN
            </h5>
            {(data.recommendations as Array<{
              priority?: number;
              action?: string;
              expected_impact?: string;
              timeframe?: string;
            }>)?.map((r, i) => (
              <div key={i} className="flex gap-3 mb-2">
                <span className="text-xs text-purple-400 font-mono mt-0.5">
                  #{r.priority}
                </span>
                <div>
                  <p className="text-sm text-zinc-300">{r.action}</p>
                  <p className="text-xs text-zinc-500">
                    {r.expected_impact} · {r.timeframe}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Weekly Plan */}
          <div>
            <h5 className="text-xs font-medium text-zinc-300 mb-2">
              THIS WEEK&apos;S CONTENT PLAN
            </h5>
            {Object.entries((data.weekly_plan as Record<string, unknown>) || {}).map(
              ([day, plan]) =>
                plan ? (
                  <div
                    key={day}
                    className="flex gap-3 mb-2 py-1.5 border-b border-[rgba(255,255,255,0.03)]"
                  >
                    <span className="text-xs text-zinc-500 w-20 capitalize flex-shrink-0">
                      {day}
                    </span>
                    <div>
                      <p className="text-sm text-zinc-300">
                        {(plan as { type?: string; idea?: string }).type}:{" "}
                        {(plan as { type?: string; idea?: string }).idea}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {(plan as { platform_tip?: string }).platform_tip}
                      </p>
                    </div>
                  </div>
                ) : null
            )}
          </div>

          {/* Growth Prediction */}
          <div className="bg-[#1A1A1D] rounded-lg px-3 py-2.5">
            <h5 className="text-xs font-medium text-zinc-400 mb-1">
              GROWTH PREDICTION
            </h5>
            <p className="text-sm text-zinc-300">
              {data.growth_prediction as string}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
