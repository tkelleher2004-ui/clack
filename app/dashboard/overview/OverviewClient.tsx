"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageTransition } from "@/components/ui";

// ─── DEV TOGGLE ───────────────────────────────────────────────────────────────
// Flip to `false` to see the empty state.
const hasData = true;

// ─── Sample data (used when hasData = true) ───────────────────────────────────
const SAMPLE_STATS = {
  totalViews: 284_000,
  totalEngagements: 18_400,
  clipsCreated: 12,
  avgVirality: 7.4,
};

const SAMPLE_CHART_7D = [
  { day: "Mon", value: 1200, date: "2026-02-23" },
  { day: "Tue", value: 1850, date: "2026-02-24" },
  { day: "Wed", value: 2400, date: "2026-02-25" },
  { day: "Thu", value: 1640, date: "2026-02-26" },
  { day: "Fri", value: 3200, date: "2026-02-27" },
  { day: "Sat", value: 2780, date: "2026-02-28" },
  { day: "Sun", value: 3620, date: "2026-03-01" },
];

const SAMPLE_CHART_30D = [
  820, 940, 1100, 980, 1280, 1420, 1350, 1180, 1320, 1500,
  1680, 1420, 1550, 1800, 1700, 1650, 1900, 2100, 1980, 2200,
  2400, 2250, 2100, 2600, 2450, 2800, 3000, 2750, 3200, 3620,
].map((value, i) => ({
  day: `${i + 1}`,
  value,
  date: `2026-02-${String(i + 1).padStart(2, "0")}`,
}));

const SAMPLE_TOP_CONTENT: Array<{
  id?: string;
  caption?: string | null;
  metrics?: Record<string, number>;
  totalEngagement?: number;
  permalink?: string | null;
}> = [
  { id: "1", caption: "Morning routine that changed my life", metrics: { views: 84_000, likes: 5800, comments: 400 }, totalEngagement: 6200 },
  { id: "2", caption: "Behind the scenes of my content setup", metrics: { views: 61_000, likes: 4500, comments: 300 }, totalEngagement: 4800 },
  { id: "3", caption: "3 growth hacks: 10K followers in 30 days", metrics: { views: 48_000, likes: 3600, comments: 300 }, totalEngagement: 3900 },
  { id: "4", caption: "Honest product review — worth the hype?", metrics: { views: 32_000, likes: 1900, comments: 200 }, totalEngagement: 2100 },
];

const SAMPLE_ACTIVITY = [
  { id: "1", type: "sync", description: "New post synced from Instagram — 2.4K likes", created_at: new Date(Date.now() - 15 * 60_000).toISOString() },
  { id: "2", type: "analysis", description: "AI deep dive analysis completed", created_at: new Date(Date.now() - 2 * 3_600_000).toISOString() },
  { id: "3", type: "connect", description: "TikTok account connected", created_at: new Date(Date.now() - 5 * 3_600_000).toISOString() },
  { id: "4", type: "plan", description: "Weekly plan generated for March", created_at: new Date(Date.now() - 86_400_000).toISOString() },
  { id: "5", type: "clip", description: "3 new clips extracted from latest video", created_at: new Date(Date.now() - 2 * 86_400_000).toISOString() },
];

const SAMPLE_GOAL = {
  statement: "Grow Instagram to 10K followers",
  currentValue: 5_280,
  goalValue: 10_000,
  unit: "followers",
  gainedToday: 47,
  sevenDayAvg: 142,
  dailyNeeded: 165,
  daysLeft: 62,
};

// ─── Design tokens ─────────────────────────────────────────────────────────────
const GLASS_CARD: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.06)",
  backdropFilter: "blur(12px) saturate(180%)",
  WebkitBackdropFilter: "blur(12px) saturate(180%)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "16px",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
};

const FLOATING_BAR: React.CSSProperties = {
  width: "100%",
  maxWidth: "520px",
  background: "rgba(10, 10, 10, 0.88)",
  backdropFilter: "blur(16px) saturate(180%)",
  WebkitBackdropFilter: "blur(16px) saturate(180%)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "14px",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
  left: "calc(50% + 28px)",
  transform: "translateX(-50%)",
};

const TIMEFRAME_LABELS: Record<string, string> = {
  "1_month": "1 month",
  "3_months": "3 months",
  "6_months": "6 months",
  "1_year": "1 year",
  none: "No timeframe",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function buildChartPath(
  data: { value: number }[],
  w: number,
  h: number
): string {
  if (data.length < 2) return "";
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - (d.value / maxVal) * h * 0.8 - h * 0.1,
  }));
  let path = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cp1x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) / 3;
    const cp2x = pts[i].x - (pts[i].x - pts[i - 1].x) / 3;
    path += ` C${cp1x},${pts[i - 1].y} ${cp2x},${pts[i].y} ${pts[i].x},${pts[i].y}`;
  }
  return path;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface GoalProgress {
  statement: string;
  currentValue: number;
  goalValue: number;
  unit: string;
  gainedToday: number;
  sevenDayAvg: number;
  dailyNeeded: number;
  daysLeft: number;
}

export interface DashboardData {
  hasData: boolean;
  stats: {
    totalViews: number;
    totalEngagements: number;
    clipsCreated: number;
    avgVirality: number;
  };
  chartData: { day: string; value: number; date: string }[];
  topContent: Array<{
    id?: string;
    caption?: string | null;
    metrics?: Record<string, number>;
    totalEngagement?: number;
    permalink?: string | null;
  }>;
  recentActivity: Array<{
    id?: string;
    type: string;
    description: string;
    created_at: string;
  }>;
  annotations: Record<string, string>;
}

export interface OverviewClientProps {
  dashboardData: DashboardData;
  firstName: string;
  goalsRaw: string | null;
  goalsTimeframe: string | null;
  hasConnectedAccounts: boolean;
  goalProgress: GoalProgress | null;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function OverviewClient({
  dashboardData,
  firstName,
  goalsRaw,
  goalsTimeframe,
  goalProgress: realGoalProgress,
}: OverviewClientProps) {
  const router = useRouter();
  const [chartPeriod, setChartPeriod] = useState<"7D" | "30D">("7D");

  const greeting = firstName
    ? `Good ${getGreeting()}, ${firstName}`
    : `Good ${getGreeting()}`;

  // When hasData = true, use sample data; otherwise use real props data.
  const effectiveGoal: GoalProgress | null = hasData ? SAMPLE_GOAL : realGoalProgress;
  const effectiveStats = hasData ? SAMPLE_STATS : dashboardData.stats;
  const rawChartData = hasData
    ? chartPeriod === "7D"
      ? SAMPLE_CHART_7D
      : SAMPLE_CHART_30D
    : dashboardData.chartData;
  const effectiveTopContent = hasData
    ? SAMPLE_TOP_CONTENT
    : dashboardData.topContent;
  const effectiveActivity = hasData
    ? SAMPLE_ACTIVITY
    : dashboardData.recentActivity;

  const chartPath = buildChartPath(rawChartData, 500, 150);
  const areaPath = chartPath ? `${chartPath} L500,150 L0,150 Z` : "";

  const kpiCards = [
    {
      label: "Total Views",
      value: hasData ? formatNumber(effectiveStats.totalViews) : "—",
      badge: hasData ? "+18%" : "No data",
      badgeColor: hasData ? "#81C784" : "#6B6B80",
    },
    {
      label: "Engagements",
      value: hasData ? formatNumber(effectiveStats.totalEngagements) : "—",
      badge: hasData ? "+23%" : "No data",
      badgeColor: hasData ? "#81C784" : "#6B6B80",
    },
    {
      label: "Clips Created",
      value: hasData ? String(effectiveStats.clipsCreated) : "—",
      badge: hasData ? "This week" : "No data",
      badgeColor: hasData ? "#9898B0" : "#6B6B80",
    },
    {
      label: "Avg Virality",
      value: hasData ? effectiveStats.avgVirality.toFixed(1) : "—",
      badge: hasData ? "Score" : "No data",
      badgeColor: hasData ? "#FFB74D" : "#6B6B80",
    },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen">
        <div className="max-w-5xl mx-auto px-6 py-8 pb-32 space-y-5">

          {/* ── Greeting ──────────────────────────────────────────────────── */}
          <div>
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{ color: "#E8E8F0" }}
            >
              {greeting}
            </h1>
            <p className="text-sm mt-1" style={{ color: "#6B6B80" }}>
              Here&apos;s your overview for today.
            </p>
          </div>

          {/* ── Goals Card ────────────────────────────────────────────────── */}
          <div className="p-5" style={GLASS_CARD}>
            {!effectiveGoal && !goalsRaw ? (
              <div>
                <h3
                  className="text-sm font-semibold mb-1"
                  style={{ color: "#E8E8F0" }}
                >
                  Set your goals
                </h3>
                <p className="text-[13px] mb-4" style={{ color: "#6B6B80" }}>
                  Tell your AI strategist what you&apos;re working toward
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {["Grow to 10K", "Get brand deals", "Go viral", "Launch product"].map(
                    (pill) => (
                      <span
                        key={pill}
                        className="text-[12px] px-3 py-1.5 rounded-full"
                        style={{
                          background: "rgba(255, 255, 255, 0.06)",
                          backdropFilter: "blur(8px)",
                          WebkitBackdropFilter: "blur(8px)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          color: "#9898B0",
                        }}
                      >
                        {pill}
                      </span>
                    )
                  )}
                </div>
                <Link
                  href="/dashboard/chat"
                  className="inline-block text-sm font-medium text-white px-4 py-2 transition-opacity hover:opacity-90"
                  style={{
                    background: "#7C5CFC",
                    borderRadius: "12px",
                    boxShadow: "0 4px 16px rgba(124, 92, 252, 0.3)",
                  }}
                >
                  Set Goals →
                </Link>
              </div>
            ) : effectiveGoal ? (
              (() => {
                const g = effectiveGoal;
                const pct = Math.round((g.currentValue / g.goalValue) * 100);
                const pace = g.sevenDayAvg >= g.dailyNeeded * 0.95
                  ? g.sevenDayAvg >= g.dailyNeeded
                    ? "ahead"
                    : "on_track"
                  : "behind";
                const paceLabel = pace === "ahead" ? "Ahead of pace" : pace === "on_track" ? "On track" : "Behind pace";
                const paceColor = pace === "behind" ? "#FFB74D" : "#81C784";

                const metrics = [
                  {
                    label: "Gained today",
                    value: `+${g.gainedToday}`,
                    sub: g.unit,
                    highlight: true,
                  },
                  {
                    label: "7-day avg",
                    value: `+${g.sevenDayAvg}`,
                    sub: "per day",
                    highlight: false,
                  },
                  {
                    label: "Needed daily",
                    value: `+${g.dailyNeeded}`,
                    sub: "to hit goal",
                    highlight: false,
                  },
                  {
                    label: "Days left",
                    value: String(g.daysLeft),
                    sub: "remaining",
                    highlight: false,
                  },
                ];

                return (
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-widest mb-1" style={{ color: "#6B6B80" }}>
                          Active Goal
                        </p>
                        <h3 className="text-[15px] font-semibold" style={{ color: "#E8E8F0" }}>
                          {g.statement}
                        </h3>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4 mt-0.5">
                        <span
                          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: paceColor + "18", color: paceColor, border: `1px solid ${paceColor}30` }}
                        >
                          {paceLabel}
                        </span>
                        <Link
                          href="/dashboard/chat"
                          className="text-[11px] transition-colors hover:opacity-80"
                          style={{ color: "#6B6B80" }}
                        >
                          Edit
                        </Link>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-1">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-[12px]" style={{ color: "#9898B0" }}>
                          {g.currentValue.toLocaleString()} / {g.goalValue.toLocaleString()} {g.unit}
                        </span>
                        <span className="text-[12px] font-medium" style={{ color: "#9898B0" }}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${pct}%`, background: "linear-gradient(to right, #7C5CFC, #A78BFA)" }}
                        />
                      </div>
                    </div>

                    {/* Metric row */}
                    <div className="grid grid-cols-4 gap-3 mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      {metrics.map((m) => (
                        <div key={m.label}>
                          <p className="text-[11px] mb-1" style={{ color: "#6B6B80" }}>{m.label}</p>
                          <p
                            className="text-lg font-bold tracking-tight"
                            style={{ color: m.highlight ? "#E8E8F0" : "#9898B0" }}
                          >
                            {m.value}
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: "#6B6B80" }}>{m.sub}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()
            ) : (
              // Goal text set but not yet parseable as tracked metric
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-widest mb-1" style={{ color: "#6B6B80" }}>
                    Active Goal
                  </p>
                  <p className="text-[15px] font-semibold" style={{ color: "#E8E8F0" }}>
                    {goalsRaw}
                  </p>
                  <p className="text-[12px] mt-2" style={{ color: "#6B6B80" }}>
                    Connect your accounts so Clack can track your progress automatically.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-[11px]" style={{ color: "#6B6B80" }}>
                    ⏱ {TIMEFRAME_LABELS[goalsTimeframe ?? ""] ?? "3 months"}
                  </span>
                  <Link href="/dashboard/chat" className="text-[11px] hover:opacity-80" style={{ color: "#6B6B80" }}>
                    Edit
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* ── KPI Stats ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((card) => (
              <div key={card.label} className="p-4" style={GLASS_CARD}>
                <p
                  className="text-[12px] mb-2"
                  style={{ color: "#9898B0" }}
                >
                  {card.label}
                </p>
                <p
                  className="text-3xl font-bold tracking-tight mb-1"
                  style={{
                    color: hasData
                      ? "#E8E8F0"
                      : "rgba(232,232,240,0.18)",
                  }}
                >
                  {card.value}
                </p>
                <span
                  className="text-[11px]"
                  style={{ color: card.badgeColor }}
                >
                  {card.badge}
                </span>
              </div>
            ))}
          </div>

          {/* ── Performance Chart ─────────────────────────────────────────── */}
          <div className="p-5" style={GLASS_CARD}>
            <div className="flex items-center justify-between mb-4">
              <span
                className="text-sm font-semibold"
                style={{ color: "#E8E8F0" }}
              >
                Performance
              </span>
              {hasData && (
                <div
                  className="flex gap-0.5 p-0.5 rounded-lg"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {(["7D", "30D"] as const).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setChartPeriod(period)}
                      className="px-2.5 py-1 text-[12px] font-medium rounded-md transition-all duration-150"
                      style={{
                        background:
                          chartPeriod === period ? "#7C5CFC" : "transparent",
                        color:
                          chartPeriod === period ? "#fff" : "#6B6B80",
                        boxShadow:
                          chartPeriod === period
                            ? "0 2px 8px rgba(124,92,252,0.3)"
                            : "none",
                      }}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {hasData ? (
              <>
                <svg
                  viewBox="0 0 500 150"
                  className="w-full h-40"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient
                      id="areaGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="rgba(124,92,252,0.20)"
                      />
                      <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                  </defs>
                  {[37, 75, 112].map((y) => (
                    <line
                      key={y}
                      x1="0"
                      y1={y}
                      x2="500"
                      y2={y}
                      stroke="rgba(255,255,255,0.04)"
                      strokeWidth="1"
                    />
                  ))}
                  {areaPath && (
                    <path d={areaPath} fill="url(#areaGrad)" />
                  )}
                  {chartPath && (
                    <path
                      d={chartPath}
                      fill="none"
                      stroke="#7C5CFC"
                      strokeWidth="2"
                    />
                  )}
                  {rawChartData.length > 0 &&
                    (() => {
                      const last = rawChartData[rawChartData.length - 1];
                      const maxVal = Math.max(
                        ...rawChartData.map((d) => d.value),
                        1
                      );
                      const cy =
                        150 - (last.value / maxVal) * 120 - 15;
                      return (
                        <>
                          <circle
                            cx={500}
                            cy={cy}
                            r="5"
                            fill="rgba(10,10,10,0.9)"
                            stroke="#7C5CFC"
                            strokeWidth="2"
                          />
                          <circle
                            cx={500}
                            cy={cy}
                            r="2.5"
                            fill="#7C5CFC"
                          />
                        </>
                      );
                    })()}
                </svg>
                {chartPeriod === "7D" && (
                  <div className="flex justify-between mt-2">
                    {rawChartData.map((d) => (
                      <span
                        key={d.date}
                        className="text-[11px]"
                        style={{ color: "#6B6B80" }}
                      >
                        {d.day}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center gap-2">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-base"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6" style={{ color: "#6B6B80" }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <p className="text-sm" style={{ color: "#6B6B80" }}>
                  Connect accounts to see performance
                </p>
              </div>
            )}
          </div>

          {/* ── Top Content + Quick Actions ───────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Top Content */}
            <div className="lg:col-span-2 p-5" style={GLASS_CARD}>
              <span
                className="text-sm font-semibold"
                style={{ color: "#E8E8F0" }}
              >
                Top Content
              </span>

              {hasData && effectiveTopContent.length > 0 ? (
                <div className="mt-4">
                  {effectiveTopContent.slice(0, 4).map((item, i) => {
                    const views =
                      item.metrics?.views ??
                      item.metrics?.impressions ??
                      item.metrics?.reach ??
                      0;
                    const title =
                      (item.caption ?? "Untitled").slice(0, 52) ||
                      "Untitled";
                    return (
                      <div
                        key={item.id ?? i}
                        className="flex items-center gap-3 py-3"
                        style={{
                          borderBottom:
                            i < 3
                              ? "1px solid rgba(255,255,255,0.05)"
                              : "none",
                        }}
                      >
                        <div
                          className="w-9 h-9 rounded-lg shrink-0"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        />
                        <p
                          className="flex-1 text-sm truncate"
                          style={{ color: "#9898B0" }}
                        >
                          {title}
                        </p>
                        <span
                          className="text-xs shrink-0"
                          style={{ color: "#6B6B80" }}
                        >
                          {formatNumber(views)} views
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4">
                  {[70, 55, 65, 45].map((w, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 py-3 animate-pulse"
                      style={{
                        borderBottom:
                          i < 3
                            ? "1px solid rgba(255,255,255,0.04)"
                            : "none",
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-lg shrink-0"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                        }}
                      />
                      <div
                        className="h-3 rounded flex-1"
                        style={{
                          maxWidth: `${w}%`,
                          background: "rgba(255,255,255,0.06)",
                        }}
                      />
                      <div
                        className="h-3 w-14 rounded shrink-0"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="p-5" style={GLASS_CARD}>
              <span
                className="text-sm font-semibold"
                style={{ color: "#E8E8F0" }}
              >
                Quick Actions
              </span>
              <div className="mt-3 space-y-0.5">
                <Link
                  href="/dashboard/accounts"
                  className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150"
                  style={{ color: "#9898B0" }}
                  onMouseEnter={(e) => {
                    (
                      e.currentTarget as HTMLAnchorElement
                    ).style.background = "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    (
                      e.currentTarget as HTMLAnchorElement
                    ).style.background = "transparent";
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 shrink-0" style={{ color: "#9898B0" }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: "#E8E8F0" }}
                    >
                      Connect Accounts
                    </p>
                    <p className="text-xs" style={{ color: "#6B6B80" }}>
                      Link your social media
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/chat")}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 text-left"
                  onMouseEnter={(e) => {
                    (
                      e.currentTarget as HTMLButtonElement
                    ).style.background = "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    (
                      e.currentTarget as HTMLButtonElement
                    ).style.background = "transparent";
                  }}
                >
                  <span className="text-sm" style={{ color: "#A78BFA" }}>
                    ✦
                  </span>
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: "#A78BFA" }}
                    >
                      Ask AI
                    </p>
                    <p className="text-xs" style={{ color: "#6B6B80" }}>
                      Get instant strategy advice
                    </p>
                  </div>
                </button>
                <Link
                  href="/dashboard/marketing-plan"
                  className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150"
                  onMouseEnter={(e) => {
                    (
                      e.currentTarget as HTMLAnchorElement
                    ).style.background = "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    (
                      e.currentTarget as HTMLAnchorElement
                    ).style.background = "transparent";
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 shrink-0" style={{ color: "#9898B0" }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: "#E8E8F0" }}
                    >
                      Marketing Plan
                    </p>
                    <p className="text-xs" style={{ color: "#6B6B80" }}>
                      View your AI strategy
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* ── Recent Activity ───────────────────────────────────────────── */}
          <div className="p-5" style={GLASS_CARD}>
            <span
              className="text-sm font-semibold"
              style={{ color: "#E8E8F0" }}
            >
              Recent Activity
            </span>

            {hasData && effectiveActivity.length > 0 ? (
              <div className="mt-4">
                {effectiveActivity.slice(0, 5).map((item, i) => (
                  <div
                    key={item.id ?? i}
                    className="flex items-center gap-3 py-3"
                    style={{
                      borderBottom:
                        i < Math.min(effectiveActivity.length, 5) - 1
                          ? "1px solid rgba(255,255,255,0.05)"
                          : "none",
                    }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: "rgba(255,255,255,0.20)" }}
                    />
                    <p
                      className="flex-1 text-sm min-w-0"
                      style={{ color: "#9898B0" }}
                    >
                      {item.description}
                    </p>
                    <span
                      className="text-xs shrink-0"
                      style={{ color: "#6B6B80" }}
                    >
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4">
                {[80, 65, 72].map((w, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-3 animate-pulse"
                    style={{
                      borderBottom:
                        i < 2
                          ? "1px solid rgba(255,255,255,0.04)"
                          : "none",
                    }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: "rgba(255,255,255,0.10)" }}
                    />
                    <div
                      className="h-3 rounded flex-1"
                      style={{
                        maxWidth: `${w}%`,
                        background: "rgba(255,255,255,0.06)",
                      }}
                    />
                    <div
                      className="h-3 w-12 rounded shrink-0"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Floating Chat Bar ─────────────────────────────────────────────── */}
        <div
          className="fixed bottom-5 z-50 cursor-pointer"
          style={FLOATING_BAR}
          role="button"
          tabIndex={0}
          onClick={() => router.push("/dashboard/chat")}
          onKeyDown={(e) =>
            (e.key === "Enter" || e.key === " ") &&
            router.push("/dashboard/chat")
          }
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-sm" style={{ color: "#A78BFA" }}>
              ✦
            </span>
            <span className="flex-1 text-sm" style={{ color: "#6B6B80" }}>
              Ask your AI strategist...
            </span>
            <span
              className="text-[11px] px-2 py-0.5 rounded-md"
              style={{
                color: "#6B6B80",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              ⌘K
            </span>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
