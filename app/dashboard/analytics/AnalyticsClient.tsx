"use client";

import { useState } from "react";
import type { OverviewData } from "@/lib/dashboard-data";

const CARD: React.CSSProperties = {
  background: "#111111",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "20px",
  boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
};
const C = {
  text: "#F0F0F8",
  sub: "#9090AA",
  muted: "#5A5A78",
  purple: "#7C5CFC",
  green: "#10B981",
  red: "#EF4444",
  amber: "#F59E0B",
  ig: "#E1306C",
  tt: "#20D9D2",
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.muted }}>
      {children}
    </p>
  );
}

function pColor(p: string) {
  if (p === "instagram") return C.ig;
  if (p === "tiktok") return C.tt;
  return C.purple;
}

function pLabel(p: string) {
  if (p === "instagram") return "Instagram";
  if (p === "tiktok") return "TikTok";
  if (p === "youtube") return "YouTube";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

interface Props {
  data: OverviewData;
}

export function AnalyticsClient({ data }: Props) {
  const { channels, combined, allPosts, patternEvidence } = data;
  const [activePlatform, setActivePlatform] = useState<string | "all">("all");

  const platforms = [...new Set(allPosts.map((p) => p.platform))];
  const filteredPosts = activePlatform === "all" ? allPosts : allPosts.filter((p) => p.platform === activePlatform);

  // Engagement rate by platform
  const engByPlatform = platforms.map((p) => {
    const posts = allPosts.filter((post) => post.platform === p);
    const totalEng = posts.reduce((s, post) => s + post.likes + post.comments, 0);
    const totalViews = posts.reduce((s, post) => s + post.views, 0);
    const rate = totalViews > 0 ? (totalEng / totalViews) * 100 : 0;
    return { platform: p, rate: Math.round(rate * 100) / 100, postCount: posts.length };
  });

  // Posting frequency by day of week
  const dayCount: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
  const dayViews: Record<string, number[]> = { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const p of filteredPosts) {
    if (p.postedAt) {
      const d = new Date(p.postedAt);
      const day = dayNames[d.getDay()];
      dayCount[day]++;
      dayViews[day].push(p.views);
    }
  }
  const maxDayCount = Math.max(...Object.values(dayCount), 1);

  // Best posting hours
  const hourViews: Record<number, number[]> = {};
  for (const p of filteredPosts) {
    if (p.postedAt) {
      const h = new Date(p.postedAt).getHours();
      if (!hourViews[h]) hourViews[h] = [];
      hourViews[h].push(p.views);
    }
  }
  const hourAvgs = Object.entries(hourViews)
    .map(([h, views]) => ({
      hour: parseInt(h),
      avgViews: views.length > 0 ? Math.round(views.reduce((s, v) => s + v, 0) / views.length) : 0,
      count: views.length,
    }))
    .sort((a, b) => b.avgViews - a.avgViews);
  const topHours = hourAvgs.slice(0, 5);

  // Content type performance
  const typePerf: Record<string, { views: number; count: number }> = {};
  for (const p of filteredPosts) {
    const t = p.postType || "video";
    if (!typePerf[t]) typePerf[t] = { views: 0, count: 0 };
    typePerf[t].views += p.views;
    typePerf[t].count++;
  }
  const typeRows = Object.entries(typePerf)
    .map(([type, d]) => ({ type, avgViews: d.count > 0 ? Math.round(d.views / d.count) : 0, count: d.count }))
    .sort((a, b) => b.avgViews - a.avgViews);
  const maxTypeViews = typeRows[0]?.avgViews ?? 1;

  const hasData = allPosts.length > 0;

  return (
    <div className="min-h-full px-6 py-7" style={{ background: "#080808" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
        <div>
          <h1 className="text-[20px] font-bold" style={{ color: C.text }}>
            Analytics
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: C.muted }}>
            Deep dive into your content performance
          </p>
        </div>
        {/* Platform filter */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setActivePlatform("all")}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
            style={{
              background: activePlatform === "all" ? "rgba(124,92,252,0.15)" : "rgba(255,255,255,0.04)",
              color: activePlatform === "all" ? "#A78BFA" : C.muted,
              border: `1px solid ${activePlatform === "all" ? "rgba(124,92,252,0.30)" : "rgba(255,255,255,0.07)"}`,
            }}
          >
            All
          </button>
          {platforms.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setActivePlatform(p)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
              style={{
                background: activePlatform === p ? `${pColor(p)}20` : "rgba(255,255,255,0.04)",
                color: activePlatform === p ? pColor(p) : C.muted,
                border: `1px solid ${activePlatform === p ? `${pColor(p)}50` : "rgba(255,255,255,0.07)"}`,
              }}
            >
              {pLabel(p)}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div style={CARD} className="p-10 text-center">
          <p className="text-[14px] font-medium mb-1" style={{ color: C.text }}>
            No data yet
          </p>
          <p className="text-[13px]" style={{ color: C.muted }}>
            Connect your accounts and sync your posts to see analytics.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Platform KPIs */}
          <section>
            <Label>Platform Breakdown</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              {channels.map((ch) => (
                <div key={ch.platform} style={CARD} className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: pColor(ch.platform) }}
                    />
                    <span className="text-[12px] font-semibold" style={{ color: C.text }}>
                      {pLabel(ch.platform)}
                    </span>
                  </div>
                  <p className="text-[22px] font-bold" style={{ color: C.text }}>
                    {fmt(ch.followers)}
                  </p>
                  <p className="text-[11px]" style={{ color: C.muted }}>followers</p>
                  <div className="flex items-center gap-3 mt-3">
                    <div>
                      <p className="text-[14px] font-semibold" style={{ color: C.text }}>{fmt(ch.totalViews)}</p>
                      <p className="text-[10px]" style={{ color: C.muted }}>views</p>
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold" style={{ color: C.text }}>{ch.postCount}</p>
                      <p className="text-[10px]" style={{ color: C.muted }}>posts</p>
                    </div>
                  </div>
                  {ch.followerGrowthPct !== 0 && (
                    <p
                      className="text-[11px] font-medium mt-2"
                      style={{ color: ch.followerGrowthPct > 0 ? C.green : C.red }}
                    >
                      {ch.followerGrowthPct > 0 ? "+" : ""}{ch.followerGrowthPct.toFixed(1)}% growth
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Engagement rate by platform */}
          <section>
            <Label>Engagement Rate</Label>
            <div style={CARD} className="mt-3 p-5">
              <div className="space-y-3">
                {engByPlatform.map((e) => (
                  <div key={e.platform} className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: pColor(e.platform) }}
                    />
                    <span className="text-[12px] w-20" style={{ color: C.sub }}>
                      {pLabel(e.platform)}
                    </span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(e.rate * 10, 100)}%`,
                          background: pColor(e.platform),
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <span className="text-[12px] font-semibold w-16 text-right" style={{ color: C.text }}>
                      {e.rate}%
                    </span>
                    <span className="text-[11px] w-20 text-right" style={{ color: C.muted }}>
                      {e.postCount} posts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Posting frequency by day */}
          <section>
            <Label>Posting Frequency by Day</Label>
            <div style={CARD} className="mt-3 p-5">
              <div className="flex items-end justify-between gap-2" style={{ height: "120px" }}>
                {dayNames.map((day) => {
                  const count = dayCount[day];
                  const avgV = dayViews[day].length > 0
                    ? Math.round(dayViews[day].reduce((s, v) => s + v, 0) / dayViews[day].length)
                    : 0;
                  const h = maxDayCount > 0 ? (count / maxDayCount) * 100 : 0;
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px]" style={{ color: C.muted }}>
                        {count > 0 ? fmt(avgV) : "—"}
                      </span>
                      <div
                        className="w-full rounded-t-md transition-all"
                        style={{
                          height: `${Math.max(h, 4)}%`,
                          background: count > 0 ? `${C.purple}60` : "rgba(255,255,255,0.04)",
                          minHeight: "4px",
                        }}
                      />
                      <span className="text-[11px] font-medium" style={{ color: count > 0 ? C.sub : C.muted }}>
                        {day}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] mt-3 text-center" style={{ color: C.muted }}>
                avg views per day shown above bars
              </p>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Best posting times */}
            <section>
              <Label>Best Posting Times</Label>
              <div style={CARD} className="mt-3 p-5">
                {topHours.length > 0 ? (
                  <div className="space-y-2.5">
                    {topHours.map((h, i) => {
                      const label = h.hour === 0 ? "12 AM" : h.hour < 12 ? `${h.hour} AM` : h.hour === 12 ? "12 PM" : `${h.hour - 12} PM`;
                      return (
                        <div key={h.hour} className="flex items-center gap-3">
                          <span
                            className="text-[12px] font-semibold w-6 text-center"
                            style={{ color: i === 0 ? C.green : C.sub }}
                          >
                            {i + 1}
                          </span>
                          <span className="text-[13px] font-medium w-16" style={{ color: C.text }}>
                            {label}
                          </span>
                          <span className="text-[12px]" style={{ color: C.sub }}>
                            avg {fmt(h.avgViews)} views
                          </span>
                          <span className="text-[11px] ml-auto" style={{ color: C.muted }}>
                            {h.count} posts
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[13px]" style={{ color: C.muted }}>
                    Not enough data to determine best times
                  </p>
                )}
              </div>
            </section>

            {/* Content type performance */}
            <section>
              <Label>Performance by Content Type</Label>
              <div style={CARD} className="mt-3 p-5">
                <div className="space-y-3">
                  {typeRows.map((t) => (
                    <div key={t.type}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-medium capitalize" style={{ color: C.text }}>
                          {t.type}
                        </span>
                        <span className="text-[11px]" style={{ color: C.sub }}>
                          avg {fmt(t.avgViews)} · {t.count} posts
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(t.avgViews / maxTypeViews) * 100}%`,
                            background: `${C.purple}80`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Topic & Format patterns */}
          {(patternEvidence.byFormat.length > 0 || patternEvidence.byTopic.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {patternEvidence.byFormat.length > 0 && (
                <section>
                  <Label>By Format</Label>
                  <div style={CARD} className="mt-3 p-5 space-y-2.5">
                    {patternEvidence.byFormat.map((f) => (
                      <div key={f.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {f.isTop && (
                            <span className="text-[10px]" style={{ color: C.green }}>★</span>
                          )}
                          <span className="text-[12px] font-medium" style={{ color: C.text }}>
                            {f.label}
                          </span>
                        </div>
                        <span className="text-[12px]" style={{ color: C.sub }}>
                          avg {fmt(f.avgViews)} views
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {patternEvidence.byTopic.length > 0 && (
                <section>
                  <Label>By Topic</Label>
                  <div style={CARD} className="mt-3 p-5 space-y-2.5">
                    {patternEvidence.byTopic.map((t) => (
                      <div key={t.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {t.isTop && (
                            <span className="text-[10px]" style={{ color: C.green }}>★</span>
                          )}
                          <span className="text-[12px] font-medium" style={{ color: C.text }}>
                            {t.label}
                          </span>
                        </div>
                        <span className="text-[12px]" style={{ color: C.sub }}>
                          avg {fmt(t.avgViews)} views
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Top posts table */}
          <section>
            <Label>All Posts</Label>
            <div
              className="mt-3 overflow-hidden"
              style={{
                background: "#111111",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "12px",
              }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["Post", "Platform", "Views", "Likes", "Comments", "Eng %", "Date"].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color: C.muted }}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPosts
                      .sort((a, b) => b.views - a.views)
                      .slice(0, 50)
                      .map((p, i) => {
                        const eng = p.views > 0 ? ((p.likes + p.comments) / p.views) * 100 : 0;
                        return (
                          <tr
                            key={p.id ?? i}
                            style={{
                              borderBottom:
                                i < Math.min(filteredPosts.length, 50) - 1
                                  ? "1px solid rgba(255,255,255,0.04)"
                                  : "none",
                            }}
                          >
                            <td className="px-4 py-3 max-w-[250px]">
                              <p className="text-[12px] truncate" style={{ color: C.sub }}>
                                {p.caption?.slice(0, 60) || "Untitled"}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="text-[11px] font-medium"
                                style={{ color: pColor(p.platform) }}
                              >
                                {pLabel(p.platform)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[12px] font-medium" style={{ color: C.text }}>
                              {fmt(p.views)}
                            </td>
                            <td className="px-4 py-3 text-[12px]" style={{ color: C.sub }}>
                              {fmt(p.likes)}
                            </td>
                            <td className="px-4 py-3 text-[12px]" style={{ color: C.sub }}>
                              {fmt(p.comments)}
                            </td>
                            <td className="px-4 py-3 text-[12px] font-medium" style={{ color: C.text }}>
                              {eng.toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 text-[11px]" style={{ color: C.muted }}>
                              {p.postedAt ? new Date(p.postedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
