"use client";

import Link from "next/link";

export interface VideoScorecardProps {
  title: string;
  score: number;
  pros: string[];
  cons: string[];
  thumbnail?: React.ReactNode;
  analysisUrl?: string;
}

export function VideoScorecard({ title, score, pros, cons, thumbnail, analysisUrl = "#" }: VideoScorecardProps) {
  const scoreColor = score >= 7 ? "text-emerald-400" : score >= 5 ? "text-amber-400" : "text-red-400";

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "#141416",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex gap-3">
        {thumbnail && <div className="w-16 h-12 rounded-lg shrink-0 overflow-hidden bg-[#1E1E22]">{thumbnail}</div>}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-300">{title}</p>
          <p className={`mt-1 text-xl font-bold ${scoreColor}`}>{score.toFixed(1)}/10</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-xs text-zinc-500">
        {pros.map((p, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-emerald-400">•</span> {p}
          </li>
        ))}
        {cons.map((c, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-red-400">•</span> {c}
          </li>
        ))}
      </ul>
      <Link href={analysisUrl} className="mt-3 inline-block text-xs text-purple-400 hover:text-purple-300 transition-colors">
        View full analysis →
      </Link>
    </div>
  );
}
