"use client";

export interface ArtifactData {
  type: "content_idea" | "weekly_brief" | "post_score" | "insight_chart";
  [key: string]: unknown;
}

// content_idea
interface ContentIdea {
  title: string;
  format: string;
  duration?: string;
  predictedViewsMin?: number;
  predictedViewsMax?: number;
  hook?: string;
  script?: string;
}

// post_score
interface PostScore {
  title: string;
  predictedViewsMin?: number;
  predictedViewsMax?: number;
  engagementScore?: number;
  strengths?: string[];
  improvements?: string[];
  verdict?: "strong" | "moderate" | "weak";
}

// weekly_brief
interface WeeklyBrief {
  lastWeekSummary?: string;
  topPostsToMake?: Array<{ title: string; why?: string }>;
  goalProgress?: string;
}

// insight_chart
interface InsightChart {
  title?: string;
  bars?: Array<{ label: string; value: number }>;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function ArtifactShell({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden mt-3 mb-1"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid rgba(255,255,255,0.08)`,
        borderLeft: `2px solid ${color}`,
      }}
    >
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color }}>
          {label}
        </span>
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  );
}

function ContentIdeaCard({ data }: { data: ContentIdea }) {
  return (
    <ArtifactShell label="Content Idea" color="#7C5CFC">
      <p className="text-[13px] font-medium mb-2" style={{ color: "#E8E8F0" }}>
        {data.title}
      </p>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {data.format && (
          <span
            className="text-[11px] px-2 py-0.5 rounded-md"
            style={{ background: "rgba(124,92,252,0.15)", color: "#A78BFA" }}
          >
            {data.format}
          </span>
        )}
        {data.duration && (
          <span className="text-[11px]" style={{ color: "#6B6B80" }}>
            {data.duration}
          </span>
        )}
        {(data.predictedViewsMin !== undefined && data.predictedViewsMax !== undefined) && (
          <span className="text-[11px]" style={{ color: "#9898B0" }}>
            {fmt(data.predictedViewsMin)}–{fmt(data.predictedViewsMax)} views
          </span>
        )}
      </div>
      {data.hook && (
        <div className="mb-2">
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#6B6B80" }}>
            Hook
          </p>
          <p className="text-[12px] italic" style={{ color: "#C4C4D4" }}>
            &quot;{data.hook}&quot;
          </p>
        </div>
      )}
      {data.script && (
        <div>
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#6B6B80" }}>
            Script
          </p>
          <p className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: "#9898B0" }}>
            {data.script}
          </p>
        </div>
      )}
    </ArtifactShell>
  );
}

function PostScoreCard({ data }: { data: PostScore }) {
  const verdictColor =
    data.verdict === "strong" ? "#4ADE80" : data.verdict === "moderate" ? "#FBBF24" : "#F87171";
  return (
    <ArtifactShell label="Post Score" color={verdictColor}>
      <p className="text-[13px] font-medium mb-2" style={{ color: "#E8E8F0" }}>
        {data.title}
      </p>
      <div className="flex items-center gap-4 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "#6B6B80" }}>
            Predicted Views
          </p>
          <p className="text-[13px] font-semibold" style={{ color: "#E8E8F0" }}>
            {data.predictedViewsMin !== undefined && data.predictedViewsMax !== undefined
              ? `${fmt(data.predictedViewsMin)}–${fmt(data.predictedViewsMax)}`
              : "—"}
          </p>
        </div>
        {data.engagementScore !== undefined && (
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "#6B6B80" }}>
              Engagement
            </p>
            <p className="text-[13px] font-semibold" style={{ color: "#E8E8F0" }}>
              {data.engagementScore}/10
            </p>
          </div>
        )}
        {data.verdict && (
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "#6B6B80" }}>
              Verdict
            </p>
            <p
              className="text-[13px] font-semibold capitalize"
              style={{ color: verdictColor }}
            >
              {data.verdict}
            </p>
          </div>
        )}
      </div>
      {data.strengths && data.strengths.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#4ADE80" }}>
            Strengths
          </p>
          {data.strengths.map((s, i) => (
            <p key={i} className="text-[12px] mb-0.5" style={{ color: "#9898B0" }}>
              · {s}
            </p>
          ))}
        </div>
      )}
      {data.improvements && data.improvements.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#FBBF24" }}>
            Improve
          </p>
          {data.improvements.map((s, i) => (
            <p key={i} className="text-[12px] mb-0.5" style={{ color: "#9898B0" }}>
              · {s}
            </p>
          ))}
        </div>
      )}
    </ArtifactShell>
  );
}

function WeeklyBriefCard({ data }: { data: WeeklyBrief }) {
  return (
    <ArtifactShell label="Weekly Brief" color="#06B6D4">
      {data.lastWeekSummary && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#6B6B80" }}>
            Last Week
          </p>
          <p className="text-[12px] leading-relaxed" style={{ color: "#C4C4D4" }}>
            {data.lastWeekSummary}
          </p>
        </div>
      )}
      {data.topPostsToMake && data.topPostsToMake.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#06B6D4" }}>
            This Week
          </p>
          {data.topPostsToMake.map((p, i) => (
            <div key={i} className="mb-2">
              <p className="text-[12px] font-medium" style={{ color: "#E8E8F0" }}>
                {i + 1}. {p.title}
              </p>
              {p.why && (
                <p className="text-[11px]" style={{ color: "#6B6B80" }}>
                  {p.why}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {data.goalProgress && (
        <div>
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#6B6B80" }}>
            Goal Progress
          </p>
          <p className="text-[12px]" style={{ color: "#C4C4D4" }}>
            {data.goalProgress}
          </p>
        </div>
      )}
    </ArtifactShell>
  );
}

function InsightChartCard({ data }: { data: InsightChart }) {
  const bars = data.bars ?? [];
  const max = bars.reduce((m, b) => Math.max(m, b.value), 0);
  return (
    <ArtifactShell label="Insight" color="#10B981">
      {data.title && (
        <p className="text-[12px] font-medium mb-3" style={{ color: "#E8E8F0" }}>
          {data.title}
        </p>
      )}
      <div className="space-y-2">
        {bars.map((bar, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px]" style={{ color: "#9898B0" }}>
                {bar.label}
              </span>
              <span className="text-[11px]" style={{ color: "#6B6B80" }}>
                {fmt(bar.value)}
              </span>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: max > 0 ? `${(bar.value / max) * 100}%` : "0%",
                  background: "rgba(16,185,129,0.7)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </ArtifactShell>
  );
}

export function ArtifactRenderer({ raw }: { raw: string }) {
  // Parse <artifact type="...">...</artifact> blocks from text
  const regex = /<artifact\s+type="([^"]+)">\s*([\s\S]*?)\s*<\/artifact>/g;
  const elements: React.ReactNode[] = [];
  let match;

  while ((match = regex.exec(raw)) !== null) {
    const type = match[1] as ArtifactData["type"];
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(match[2]);
    } catch {
      continue;
    }

    if (type === "content_idea") {
      elements.push(<ContentIdeaCard key={match.index} data={data as unknown as ContentIdea} />);
    } else if (type === "post_score") {
      elements.push(<PostScoreCard key={match.index} data={data as unknown as PostScore} />);
    } else if (type === "weekly_brief") {
      elements.push(<WeeklyBriefCard key={match.index} data={data as WeeklyBrief} />);
    } else if (type === "insight_chart") {
      elements.push(<InsightChartCard key={match.index} data={data as InsightChart} />);
    }
  }

  if (elements.length === 0) return null;
  return <>{elements}</>;
}

/** Strip artifact and goal_update blocks from display text */
export function cleanMessageText(text: string): string {
  return text
    .replace(/<artifact\s+type="[^"]+">[\s\S]*?<\/artifact>/g, "")
    .replace(/\n?---\n?<goal_update>[\s\S]*?<\/goal_update>/g, "")
    .replace(/<goal_update>[\s\S]*?<\/goal_update>/g, "")
    .trim();
}
