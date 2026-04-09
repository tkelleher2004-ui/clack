"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { OverviewData, PatternBar } from "@/lib/dashboard-data";
import type { AIAnalysis } from "./page";
import { AIBriefingBanner } from "@/components/dashboard/AIBriefingBanner";
import { useUserGoal } from "@/lib/context/UserGoalContext";

// ─── Tokens ───────────────────────────────────────────────────────────────────
const BG = "#080808";
const CARD: React.CSSProperties = {
  background: "#111111",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "20px",
  boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
};
const TABLE_SURFACE: React.CSSProperties = {
  background: "#111111",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "12px",
  overflow: "hidden",
};
const C = {
  text: "#F0F0F8",
  sub: "#9090AA",
  muted: "#5A5A78",
  border: "rgba(255,255,255,0.07)",
  purple: "#7C5CFC",
  green: "#10B981",
  red: "#EF4444",
  amber: "#F59E0B",
  ig: "#E1306C",
  tt: "#20D9D2",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
}
function fmtRange(lo: number, hi: number) {
  return `${fmt(lo)}–${fmt(hi)}`;
}
function pLabel(p: string) {
  if (p === "instagram") return "IG";
  if (p === "tiktok") return "TT";
  if (p === "youtube") return "YT";
  return p.slice(0, 2).toUpperCase();
}
function pColor(p: string) {
  if (p === "instagram") return C.ig;
  if (p === "tiktok") return C.tt;
  return C.purple;
}

// ─── Tiny atoms ───────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.muted }}>
      {children}
    </p>
  );
}

function Divider() {
  return <div style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />;
}

function IGLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="igg" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="50%" stopColor="#dc2743" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#igg)" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="white" />
    </svg>
  );
}

function TTLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <rect width="24" height="24" rx="5" fill="#010101" />
      <path
        d="M16.5 5h-2.1v9.1a2.4 2.4 0 01-2.4 2.3 2.4 2.4 0 01-2.4-2.3 2.4 2.4 0 012.4-2.3c.22 0 .43.03.63.08V9.6a4.5 4.5 0 00-.63-.04 4.5 4.5 0 00-4.5 4.5 4.5 4.5 0 004.5 4.5 4.5 4.5 0 004.5-4.5V9.1a6.3 6.3 0 003.7 1.2V8.2A4.2 4.2 0 0116.5 5z"
        fill="white"
      />
    </svg>
  );
}

function PIcon({ platform, size = 18 }: { platform: string; size?: number }) {
  if (platform === "instagram") return <IGLogo size={size} />;
  if (platform === "tiktok") return <TTLogo size={size} />;
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 5,
        background: C.purple, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, fontWeight: 700, color: "white",
      }}
    >
      {pLabel(platform)}
    </div>
  );
}

function Bars({ bars }: { bars: PatternBar[] }) {
  const max = Math.max(...bars.map(b => b.avgViews), 1);
  return (
    <div className="space-y-2.5">
      {bars.map(b => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="text-[12px] w-24 shrink-0 text-right" style={{ color: C.sub }}>{b.label}</span>
          <div className="flex-1 h-[18px] rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full"
              style={{
                width: `${Math.max(4, Math.round((b.avgViews / max) * 100))}%`,
                background: b.isTop
                  ? "linear-gradient(90deg, #16a34a, #4ADE80)"
                  : "linear-gradient(90deg, #991b1b, #F87171)",
                borderRadius: "2px",
              }}
            />
          </div>
          <span
            className="text-[12px] w-12 shrink-0 text-right font-medium tabular-nums"
            style={{ color: b.isTop ? C.green : C.red }}
          >
            {fmt(b.avgViews)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2.5">
      {[100, 72, 48].map(w => (
        <div
          key={w}
          className="h-3 rounded animate-pulse"
          style={{ width: `${w}%`, background: "rgba(255,255,255,0.08)" }}
        />
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
interface Props {
  overviewData: OverviewData;
  aiAnalysis: AIAnalysis | null;
  displayName: string;
  userEmail: string;
}

export function OverviewClient({ overviewData, aiAnalysis: initialAiAnalysis, displayName }: Props) {
  const { channels, combined, followerGrowth, topPerformers, allPosts, crossPlatform, patternEvidence, competitors } = overviewData;

  const availablePlatforms = [...new Set(allPosts.map(p => p.platform))];
  const [activeTab, setActiveTab] = useState(() => availablePlatforms[0] ?? "tiktok");
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(initialAiAnalysis);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [postedIdeas, setPostedIdeas] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem("clack_posted_ideas");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const togglePosted = (index: number) => {
    setPostedIdeas(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      try { localStorage.setItem("clack_posted_ideas", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const { refreshSignal, consumeRefresh, setChatContext } = useUserGoal();
  const prevSignalRef = useRef(refreshSignal);

  const runRefresh = useCallback(() => {
    if (allPosts.length < 3) {
      return;
    }
    setIsRefreshing(true);
    setRefreshError(null);
    fetch("/api/overview/refresh", { method: "POST" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { analysis?: AIAnalysis | null }) => {
        if (data.analysis) setAiAnalysis(data.analysis);
      })
      .catch(() => {
        setRefreshError("Couldn't refresh analysis. Try again later.");
      })
      .finally(() => setIsRefreshing(false));
  }, [allPosts.length]);

  // Catch refresh signals that fired while this component was unmounted
  useEffect(() => {
    if (consumeRefresh()) {
      console.log("[OverviewClient] consumed pending refresh from before mount");
      runRefresh();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log("[OverviewClient] refreshSignal changed:", refreshSignal, "prev:", prevSignalRef.current);
    if (refreshSignal === prevSignalRef.current) return;
    prevSignalRef.current = refreshSignal;
    runRefresh();
  }, [refreshSignal, runRefresh]);

  const hasAccounts = channels.length > 0;
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const displayChannels = hasAccounts
    ? channels
    : [
        { platform: "instagram", username: "your_instagram", followers: 0, followerGrowthPct: 0, postCount: 0, totalViews: 0, totalLikes: 0, totalComments: 0, totalShares: 0 },
        { platform: "tiktok", username: "your_tiktok", followers: 0, followerGrowthPct: 0, postCount: 0, totalViews: 0, totalLikes: 0, totalComments: 0, totalShares: 0 },
      ];

  const availableTabs = availablePlatforms;
  const tabPosts = allPosts.filter(p => p.platform === activeTab);

  return (
    <div className="min-h-screen" style={{ background: BG }}>

      <div className="relative z-10 max-w-[960px] mx-auto px-8 py-7 space-y-0">

        {/* ── Morning brief ───────────────────────────────────────────────── */}
        <AIBriefingBanner />

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between pb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: C.text }}>{displayName}</h1>
            <p className="text-[13px] mt-0.5" style={{ color: C.sub }}>
              {hasAccounts
                ? channels.map(c => `@${c.username}`).join("  ·  ")
                : "Social media analytics"}
            </p>
          </div>
          <span className="text-[13px] mt-1" style={{ color: C.muted }}>{dateStr}</span>
        </div>

        {/* ── Connect banner ──────────────────────────────────────────────── */}
        {!hasAccounts && (
          <div className="mb-5">
            <a
              href="/dashboard/accounts"
              className="flex items-center justify-between px-4 py-3 rounded-lg"
              style={{
                background: "rgba(124,92,252,0.12)",
                border: "1px solid rgba(124,92,252,0.30)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: C.purple, boxShadow: `0 0 6px ${C.purple}` }}
                />
                <span className="text-[13px] font-medium" style={{ color: C.text }}>
                  Connect your accounts to populate this dashboard
                </span>
              </div>
              <span className="text-[12px] font-semibold" style={{ color: C.purple }}>Connect →</span>
            </a>
          </div>
        )}

        {/* ── CHANNELS ────────────────────────────────────────────────────── */}
        <section className="pb-7">
          <Label>Channels</Label>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {displayChannels.map((ch, i) => {
              const accent = pColor(ch.platform);
              return (
                <div
                  key={`${ch.platform}-${ch.username}-${i}`}
                  style={{ ...CARD, borderTop: `2px solid ${accent}`, position: "relative", overflow: "hidden" }}
                  className="p-5"
                >
                  {/* Accent glow */}
                  <div
                    style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: "64px",
                      background: `linear-gradient(180deg, ${accent}20 0%, transparent 100%)`,
                      pointerEvents: "none",
                    }}
                  />
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <PIcon platform={ch.platform} size={20} />
                      <span className="text-[13px] font-medium" style={{ color: C.sub }}>@{ch.username}</span>
                    </div>
                    {ch.followerGrowthPct !== 0 && (
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: ch.followerGrowthPct > 0 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                          color: ch.followerGrowthPct > 0 ? C.green : C.red,
                          border: `1px solid ${ch.followerGrowthPct > 0 ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"}`,
                        }}
                      >
                        {ch.followerGrowthPct > 0 ? "+" : ""}{ch.followerGrowthPct}%
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { v: fmt(ch.followers), l: "FOLLOWERS" },
                      { v: String(ch.postCount), l: ch.platform === "tiktok" ? "VIDEOS" : "POSTS" },
                      { v: fmt(ch.totalViews), l: ch.platform === "tiktok" ? "TOTAL PLAYS" : "TOTAL VIEWS" },
                    ].map((s, si) => (
                      <div key={s.l}>
                        <p className="text-[22px] font-bold tabular-nums tracking-tight" style={{ color: si === 0 ? accent : C.text }}>{s.v}</p>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.1em] mt-0.5" style={{ color: C.muted }}>{s.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <Divider />

        {/* ── ALL-TIME COMBINED ───────────────────────────────────────────── */}
        <section className="py-7">
          <Label>All-Time Combined</Label>
          <div className="grid grid-cols-4 gap-3 mt-3">
            {[
              { label: "TOTAL VIEWS", value: fmt(combined.totalViews), key: "views", raw: combined.totalViews },
              { label: "TOTAL LIKES", value: fmt(combined.totalLikes), key: "likes", raw: combined.totalLikes },
              { label: "TOTAL COMMENTS", value: fmt(combined.totalComments), key: "comments", raw: combined.totalComments },
              { label: "FOLLOWERS", value: fmt(combined.totalFollowers), key: "followers", raw: combined.totalFollowers },
            ].map(card => {
              const sub = Object.entries(combined.perPlatform)
                .filter(([, v]) => {
                  const n = card.key === "views" ? v.views : card.key === "likes" ? v.likes : card.key === "comments" ? v.comments : v.followers;
                  return n > 0;
                })
                .map(([k, v]) => {
                  const n = card.key === "views" ? v.views : card.key === "likes" ? v.likes : card.key === "comments" ? v.comments : v.followers;
                  return `${pLabel(k)} ${fmt(n)}`;
                })
                .join("  +  ");
              const detail = sub ? `${card.raw.toLocaleString()} (${sub})` : card.raw.toLocaleString();
              return (
                <div
                  key={card.label}
                  style={{ ...CARD, position: "relative" }}
                  className="p-4 group"
                >
                  <div className="flex items-start justify-between">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: C.muted }}>{card.label}</p>
                    <button
                      type="button"
                      onClick={() => setChatContext({ label: card.label, value: card.value, detail })}
                      className="opacity-0 group-hover:opacity-100 transition-opacity -mt-0.5 -mr-0.5 w-5 h-5 rounded-md flex items-center justify-center"
                      style={{ background: "rgba(124,92,252,0.10)", border: "1px solid rgba(124,92,252,0.2)", color: "#7C5CFC", fontSize: "10px" }}
                      title="Add to chat"
                    >
                      ✦
                    </button>
                  </div>
                  <p className="text-[26px] font-bold tabular-nums tracking-tight" style={{ color: C.text }}>{card.value}</p>
                  {sub && <p className="text-[10px] mt-1.5 font-medium" style={{ color: C.muted }}>{sub}</p>}
                </div>
              );
            })}
          </div>
        </section>

        <Divider />

        {/* ── FOLLOWER GROWTH ─────────────────────────────────────────────── */}
        {followerGrowth.some(fg => fg.weeks.length > 1) && (
          <>
            <section className="py-7">
              <Label>Follower Growth</Label>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {followerGrowth.map(fg => {
                  if (fg.weeks.length < 2) return null;
                  const max = Math.max(...fg.weeks.map(w => w.count), 1);
                  const accent = pColor(fg.platform);
                  return (
                    <div key={fg.platform} style={CARD} className="p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <PIcon platform={fg.platform} size={16} />
                        <span className="text-[12px] font-semibold capitalize" style={{ color: C.sub }}>
                          {fg.platform === "tiktok" ? "TikTok" : "Instagram"} Followers
                        </span>
                      </div>
                      <div className="space-y-2">
                        {fg.weeks.map(w => (
                          <div key={w.label} className="flex items-center gap-2">
                            <span className="text-[11px] w-12 shrink-0" style={{ color: C.muted }}>{w.label}</span>
                            <div className="flex-1 h-[14px] rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <div
                                className="h-full rounded-sm"
                                style={{
                                  width: `${Math.max(3, Math.round((w.count / max) * 100))}%`,
                                  background: `linear-gradient(90deg, ${accent}80, ${accent})`,
                                }}
                              />
                            </div>
                            <span className="text-[11px] w-14 text-right shrink-0 tabular-nums font-medium" style={{ color: C.sub }}>
                              {w.count.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            <Divider />
          </>
        )}

        {/* ── TOP PERFORMERS ──────────────────────────────────────────────── */}
        {topPerformers.length > 0 && (
          <>
            <section className="py-7">
              <Label>Top Performers (Combined Platforms)</Label>
              <div className="grid grid-cols-3 gap-3 mt-3">
                {topPerformers.slice(0, 3).map((p, i) => (
                  <div key={p.id} style={CARD} className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: i === 0 ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.06)",
                          color: i === 0 ? C.amber : C.muted,
                          border: `1px solid ${i === 0 ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.10)"}`,
                        }}
                      >
                        {i + 1}
                      </span>
                      <PIcon platform={p.platform} size={14} />
                    </div>
                    <p className="text-[13px] font-medium leading-snug mb-3 line-clamp-2" style={{ color: C.text }}>
                      {p.caption}
                    </p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                      {[
                        { l: "VIEWS", v: fmt(p.views) },
                        { l: "LIKES", v: fmt(p.likes) },
                        { l: "COMMENTS", v: fmt(p.comments) },
                        { l: "SHARES", v: fmt(p.shares) },
                      ].map(s => (
                        <div key={s.l}>
                          <p className="text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: C.muted }}>{s.l}</p>
                          <p className="text-[13px] font-semibold tabular-nums mt-0.5" style={{ color: C.sub }}>{s.v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <Divider />
          </>
        )}

        {/* ── ALL POSTS ───────────────────────────────────────────────────── */}
        {allPosts.length > 0 && (
          <>
            <section className="py-7">
              <div className="flex items-center justify-between mb-3">
                <Label>All Posts</Label>
                <div className="flex gap-1">
                  {(availableTabs.length > 0 ? availableTabs : ["instagram", "tiktok"]).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className="px-3 py-1 text-[11px] font-semibold capitalize rounded-md transition-all"
                      style={{
                        background: activeTab === tab ? "rgba(124,92,252,0.20)" : "transparent",
                        color: activeTab === tab ? "#C4B5FD" : C.muted,
                        border: `1px solid ${activeTab === tab ? "rgba(124,92,252,0.35)" : "rgba(255,255,255,0.07)"}`,
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
              <div style={TABLE_SURFACE}>
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["POST", "VIEWS", "LIKES", "COMMENTS", "ENG%"].map(h => (
                        <th
                          key={h}
                          className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
                          style={{ color: C.muted }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tabPosts.slice(0, 20).map((p, i) => (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: i < Math.min(tabPosts.length, 20) - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                        }}
                      >
                        <td className="px-4 py-2.5 max-w-xs">
                          <div className="flex items-center gap-2">
                            {p.isViral && (
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wide"
                                style={{
                                  background: "rgba(245,158,11,0.18)",
                                  color: C.amber,
                                  border: "1px solid rgba(245,158,11,0.35)",
                                }}
                              >
                                VIRAL
                              </span>
                            )}
                            <span className="text-[13px] truncate" style={{ color: C.sub }}>{p.caption}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-[13px] font-medium" style={{ color: C.text }}>{fmt(p.views)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-[13px]" style={{ color: C.sub }}>{fmt(p.likes)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-[13px]" style={{ color: C.sub }}>{fmt(p.comments)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-[13px]" style={{ color: C.sub }}>{p.engagementRate.toFixed(1)}%</td>
                      </tr>
                    ))}
                    {tabPosts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-[13px]" style={{ color: C.muted }}>
                          No posts for this platform yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            <Divider />
          </>
        )}

        {/* ── CROSS-PLATFORM COMPARISON ───────────────────────────────────── */}
        {crossPlatform.length > 0 && (
          <>
            <section className="py-7">
              <Label>Cross-Platform Comparison</Label>
              <div style={TABLE_SURFACE} className="mt-3">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["POST", "IG VIEWS", "TT PLAYS", "IG ENG%", "TT ENG%", "WINNER"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: C.muted }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {crossPlatform.map((row, i) => (
                      <tr key={i} style={{ borderBottom: i < crossPlatform.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                        <td className="px-4 py-2.5 max-w-[200px]">
                          <span className="text-[13px] truncate block" style={{ color: C.sub }}>{row.title}</span>
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-[13px] font-medium" style={{ color: C.ig }}>{fmt(row.igViews)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-[13px] font-medium" style={{ color: C.tt }}>{fmt(row.ttPlays)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-[13px]" style={{ color: C.sub }}>{row.igEngPct.toFixed(1)}%</td>
                        <td className="px-4 py-2.5 tabular-nums text-[13px]" style={{ color: C.sub }}>{row.ttEngPct.toFixed(1)}%</td>
                        <td className="px-4 py-2.5">
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: row.winner === "ig" ? "rgba(225,48,108,0.15)" : "rgba(0,242,234,0.1)",
                              color: row.winner === "ig" ? C.ig : C.tt,
                              border: `1px solid ${row.winner === "ig" ? "rgba(225,48,108,0.3)" : "rgba(0,242,234,0.2)"}`,
                            }}
                          >
                            {row.winner === "ig" ? "IG" : "TT"} ({row.multiplier})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <Divider />
          </>
        )}

        {/* ── COMPETITOR ANALYSIS ─────────────────────────────────────────── */}
        {competitors.length > 0 && (
          <>
            <section className="py-7">
              <div className="flex items-center justify-between mb-3">
                <Label>Competitor Analysis</Label>
                <a
                  href="/dashboard/accounts"
                  className="text-[11px] font-semibold"
                  style={{ color: C.purple }}
                >
                  + Add Competitor
                </a>
              </div>

              {/* Competitor cards */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {competitors.map((comp) => {
                  const accent = pColor(comp.platform);
                  // Find matching own channel for comparison
                  const ownChannel = channels.find((c) => c.platform === comp.platform);
                  const followerDiff = ownChannel
                    ? comp.followers - ownChannel.followers
                    : null;
                  const followerDiffPct =
                    ownChannel && ownChannel.followers > 0
                      ? Math.round(((comp.followers - ownChannel.followers) / ownChannel.followers) * 100)
                      : null;

                  return (
                    <div
                      key={comp.id}
                      style={{ ...CARD, position: "relative", overflow: "hidden" }}
                      className="p-5"
                    >
                      <div
                        style={{
                          position: "absolute", top: 0, left: 0, right: 0, height: "1px",
                          background: `linear-gradient(90deg, transparent, ${accent}40, transparent)`,
                        }}
                      />
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <PIcon platform={comp.platform} size={18} />
                          <div>
                            <p className="text-[13px] font-semibold" style={{ color: C.text }}>@{comp.username}</p>
                            <p className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>Competitor</p>
                          </div>
                        </div>
                        {followerDiffPct !== null && (
                          <div className="text-right">
                            <p
                              className="text-[11px] font-semibold"
                              style={{ color: followerDiff! > 0 ? C.red : C.green }}
                            >
                              {followerDiff! > 0 ? "+" : ""}{fmt(followerDiff!)} vs you
                            </p>
                            <p
                              className="text-[10px]"
                              style={{ color: followerDiff! > 0 ? C.red : C.green }}
                            >
                              {followerDiffPct > 0 ? "+" : ""}{followerDiffPct}%
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { v: fmt(comp.followers), l: "FOLLOWERS" },
                          { v: String(comp.postCount), l: "POSTS" },
                          { v: fmt(comp.avgViews), l: "AVG VIEWS" },
                          { v: `${comp.avgEngRate.toFixed(1)}%`, l: "ENG RATE" },
                        ].map((s) => (
                          <div key={s.l}>
                            <p className="text-[18px] font-bold tabular-nums tracking-tight" style={{ color: C.text }}>{s.v}</p>
                            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] mt-0.5" style={{ color: C.muted }}>{s.l}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* You vs Competitors comparison table */}
              {channels.length > 0 && (
                <div style={TABLE_SURFACE}>
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                        {["ACCOUNT", "PLATFORM", "FOLLOWERS", "AVG VIEWS", "ENG RATE", ""].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: C.muted }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Your channels first */}
                      {channels.map((ch, i) => {
                        const totalEng = ch.totalLikes + ch.totalComments;
                        const avgViews = ch.postCount > 0 ? Math.round(ch.totalViews / ch.postCount) : 0;
                        const avgEng = ch.followers > 0 && ch.postCount > 0
                          ? Math.round((totalEng / ch.postCount / ch.followers) * 1000) / 10
                          : 0;
                        return (
                          <tr key={ch.platform} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <PIcon platform={ch.platform} size={14} />
                                <span className="text-[13px] font-semibold" style={{ color: C.text }}>@{ch.username}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(124,92,252,0.15)", color: C.purple, border: "1px solid rgba(124,92,252,0.3)" }}>
                                YOU
                              </span>
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-[13px] font-medium" style={{ color: C.text }}>{fmt(ch.followers)}</td>
                            <td className="px-4 py-2.5 tabular-nums text-[13px]" style={{ color: C.sub }}>{fmt(avgViews)}</td>
                            <td className="px-4 py-2.5 tabular-nums text-[13px]" style={{ color: C.sub }}>{avgEng.toFixed(1)}%</td>
                            <td className="px-4 py-2.5" />
                          </tr>
                        );
                      })}
                      {/* Competitors */}
                      {competitors.map((comp, i) => {
                        const ownChannel = channels.find((c) => c.platform === comp.platform);
                        const followerDiffPct = ownChannel && ownChannel.followers > 0
                          ? Math.round(((comp.followers - ownChannel.followers) / ownChannel.followers) * 100)
                          : null;
                        const ahead = followerDiffPct !== null && followerDiffPct > 0;
                        return (
                          <tr
                            key={comp.id}
                            style={{ borderBottom: i < competitors.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <PIcon platform={comp.platform} size={14} />
                                <span className="text-[13px]" style={{ color: C.sub }}>@{comp.username}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                                style={{
                                  background: "rgba(255,255,255,0.07)",
                                  color: C.muted,
                                  border: "1px solid rgba(255,255,255,0.12)",
                                }}
                              >
                                COMP
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="tabular-nums text-[13px] font-medium" style={{ color: C.text }}>{fmt(comp.followers)}</span>
                                {followerDiffPct !== null && (
                                  <span
                                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                    style={{
                                      background: ahead ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                                      color: ahead ? C.red : C.green,
                                      border: `1px solid ${ahead ? "rgba(239,68,68,0.35)" : "rgba(16,185,129,0.35)"}`,
                                    }}
                                  >
                                    {ahead ? "+" : ""}{followerDiffPct}%
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-[13px]" style={{ color: C.sub }}>{fmt(comp.avgViews)}</td>
                            <td className="px-4 py-2.5 tabular-nums text-[13px]" style={{ color: C.sub }}>{comp.avgEngRate.toFixed(1)}%</td>
                            <td className="px-4 py-2.5" />
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <Divider />
          </>
        )}

        {/* ── PATTERN EVIDENCE ────────────────────────────────────────────── */}
        {(patternEvidence.byFormat.length > 1 || patternEvidence.byTopic.length > 1) && (
          <>
            <section className="py-7">
              <Label>Pattern Evidence</Label>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {patternEvidence.byFormat.length > 1 && (
                  <div style={CARD} className="p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: C.muted }}>Format → Avg Views</p>
                    <Bars bars={patternEvidence.byFormat} />
                  </div>
                )}
                {patternEvidence.byTopic.length > 1 && (
                  <div style={CARD} className="p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: C.muted }}>Topic → Avg Views</p>
                    <Bars bars={patternEvidence.byTopic} />
                  </div>
                )}
              </div>
            </section>
            <Divider />
          </>
        )}

        {/* ── THE PLAYBOOK ────────────────────────────────────────────────── */}
        <section className="py-7">
          <div className="flex items-center justify-between mb-0">
            <Label>The Playbook</Label>
            {isRefreshing && (
              <span className="text-[11px] font-medium animate-pulse" style={{ color: "#A78BFA" }}>
                ✦ Updating…
              </span>
            )}
            {refreshError && !isRefreshing && (
              <button
                type="button"
                onClick={runRefresh}
                className="text-[11px] font-medium transition-opacity hover:opacity-80"
                style={{ color: C.red }}
              >
                {refreshError} Retry
              </button>
            )}
          </div>
          <div style={{ ...CARD, opacity: isRefreshing ? 0.5 : 1, transition: "opacity 0.3s" }} className="mt-3 p-5">
            {aiAnalysis ? (
              <>
                {aiAnalysis.playbook && (
                  <>
                <div className="grid grid-cols-2 gap-6 mb-5">
                  <div>
                    <p className="text-[11px] font-semibold mb-3" style={{ color: C.green }}>✓  Always</p>
                    <ul className="space-y-2.5">
                      {aiAnalysis.playbook.always.map((rule, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-[11px] mt-0.5 shrink-0" style={{ color: C.green }}>•</span>
                          <span className="text-[13px] leading-snug" style={{ color: C.sub }}>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold mb-3" style={{ color: C.red }}>✗  Never</p>
                    <ul className="space-y-2.5">
                      {aiAnalysis.playbook.never.map((rule, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-[11px] mt-0.5 shrink-0" style={{ color: C.red }}>•</span>
                          <span className="text-[13px] leading-snug" style={{ color: C.sub }}>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} className="pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-3" style={{ color: C.muted }}>Optimal Specs</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      aiAnalysis.playbook.optimalSpecs.duration,
                      `${aiAnalysis.playbook.optimalSpecs.words} words`,
                      aiAnalysis.playbook.optimalSpecs.postTime,
                      `${aiAnalysis.playbook.optimalSpecs.listItems} list items`,
                    ].map(spec => (
                      <span
                        key={spec}
                        className="text-[12px] font-semibold px-3 py-1 rounded-full"
                        style={{
                          background: "rgba(16,185,129,0.12)",
                          color: C.green,
                          border: "1px solid rgba(16,185,129,0.28)",
                        }}
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
                  </>
                )}
              </>
            ) : (
              <div>
                <p className="text-[12px] mb-4" style={{ color: C.muted }}>
                  {allPosts.length < 3 ? "Connect & sync your accounts to generate your playbook" : "Analyzing your posts…"}
                </p>
                <Skeleton />
              </div>
            )}
          </div>
        </section>

        <Divider />

        {/* ── SIMULATED IDEAS ─────────────────────────────────────────────── */}
        <section className="py-7">
          <div className="flex items-center justify-between mb-0">
            <Label>Simulated Ideas — Ranked</Label>
            {isRefreshing && (
              <span className="text-[11px] font-medium animate-pulse" style={{ color: "#A78BFA" }}>
                ✦ Updating…
              </span>
            )}
          </div>
          {aiAnalysis ? (
            <div style={{ ...TABLE_SURFACE, opacity: isRefreshing ? 0.5 : 1, transition: "opacity 0.3s" }} className="mt-3">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["#", "CONTENT IDEA", "VIEWS", "ENG%", "FOLLOWERS", "SIGNAL", ""].map((h, idx) => (
                      <th key={idx} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: C.muted }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aiAnalysis.simulatedIdeas.map((idea, i) => {
                    const isPosted = postedIdeas.has(i);
                    const sig =
                      idea.signal === "POST"
                        ? { bg: "rgba(16,185,129,0.15)", c: C.green, b: "rgba(16,185,129,0.32)" }
                        : idea.signal === "TEST"
                        ? { bg: "rgba(245,158,11,0.15)", c: C.amber, b: "rgba(245,158,11,0.32)" }
                        : { bg: "rgba(255,255,255,0.07)", c: C.muted, b: "rgba(255,255,255,0.12)" };
                    return (
                      <tr
                        key={i}
                        style={{
                          borderBottom: i < aiAnalysis.simulatedIdeas.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                          opacity: isPosted ? 0.45 : 1,
                          transition: "opacity 0.2s",
                        }}
                      >
                        <td className="px-4 py-3 text-[13px] tabular-nums font-medium" style={{ color: C.muted }}>{String(i + 1).padStart(2, "0")}</td>
                        <td className="px-4 py-3">
                          <p className="text-[13px] font-medium mb-1.5" style={{ color: C.text, textDecoration: isPosted ? "line-through" : "none" }}>{idea.title}</p>
                          <div className="flex flex-wrap gap-1">
                            {[idea.format, idea.duration, idea.confidence].map(tag => (
                              <span
                                key={tag}
                                className="text-[10px] px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(255,255,255,0.07)", color: C.muted, border: "1px solid rgba(255,255,255,0.10)" }}
                              >
                                {tag}
                              </span>
                            ))}
                            {isPosted && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                                style={{ background: "rgba(16,185,129,0.15)", color: C.green, border: "1px solid rgba(16,185,129,0.25)" }}
                              >
                                Posted
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[13px] whitespace-nowrap" style={{ color: C.sub }}>{fmtRange(idea.viewsMin, idea.viewsMax)}</td>
                        <td className="px-4 py-3 tabular-nums text-[13px] whitespace-nowrap" style={{ color: C.sub }}>{idea.engMin.toFixed(1)}–{idea.engMax.toFixed(1)}%</td>
                        <td className="px-4 py-3 tabular-nums text-[13px] whitespace-nowrap" style={{ color: C.sub }}>+{fmtRange(idea.followersMin, idea.followersMax)}</td>
                        <td className="px-4 py-3">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide"
                            style={{ background: sig.bg, color: sig.c, border: `1px solid ${sig.b}` }}
                          >
                            {idea.signal}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => togglePosted(i)}
                            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors duration-150"
                            style={{
                              background: isPosted ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)",
                              border: isPosted ? "1px solid rgba(16,185,129,0.30)" : "1px solid rgba(255,255,255,0.10)",
                              color: isPosted ? C.green : C.muted,
                            }}
                            title={isPosted ? "Mark as not posted" : "Mark as posted"}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={CARD} className="mt-3 p-5">
              <p className="text-[12px] mb-4" style={{ color: C.muted }}>
                {allPosts.length < 3 ? "Sync your accounts to generate content ideas" : "Generating ideas…"}
              </p>
              <Skeleton />
            </div>
          )}
        </section>

        <Divider />

        {/* ── CONTENT CALENDAR ────────────────────────────────────────────── */}
        <section className="py-7">
          <div className="flex items-center justify-between mb-0">
            <Label>Content Calendar</Label>
            {isRefreshing && (
              <span className="text-[11px] font-medium animate-pulse" style={{ color: "#A78BFA" }}>
                ✦ Updating…
              </span>
            )}
          </div>
          {aiAnalysis && aiAnalysis.weeklyCalendar.length > 0 ? (
            <div style={{ ...CARD, opacity: isRefreshing ? 0.5 : 1, transition: "opacity 0.3s" }} className="mt-3 overflow-hidden">
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
              >
                <p className="text-[12px] font-semibold" style={{ color: C.sub }}>
                  WEEK — {aiAnalysis.weeklyCalendar[0]?.date} → {aiAnalysis.weeklyCalendar[aiAnalysis.weeklyCalendar.length - 1]?.date}
                </p>
              </div>
              <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                {aiAnalysis.weeklyCalendar.map((day, i) => {
                  const sc =
                    day.status === "BEST"
                      ? { bg: "rgba(124,92,252,0.20)", c: "#C4B5FD", b: "rgba(124,92,252,0.40)" }
                      : day.status === "POST"
                      ? { bg: "rgba(16,185,129,0.15)", c: C.green, b: "rgba(16,185,129,0.32)" }
                      : day.status === "TEST"
                      ? { bg: "rgba(245,158,11,0.15)", c: C.amber, b: "rgba(245,158,11,0.32)" }
                      : { bg: "rgba(255,255,255,0.07)", c: C.muted, b: "rgba(255,255,255,0.12)" };
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-4 px-5 py-3"
                      style={{ borderBottom: i < aiAnalysis.weeklyCalendar.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                    >
                      <div className="w-16 shrink-0">
                        <p className="text-[11px] font-bold" style={{ color: C.sub }}>{day.day}</p>
                        <p className="text-[10px]" style={{ color: C.muted }}>{day.date}</p>
                      </div>
                      <p className="flex-1 text-[13px] truncate" style={{ color: day.status === "REST" ? C.muted : C.sub }}>{day.title}</p>
                      {day.status !== "REST" && (
                        <p className="text-[12px] tabular-nums shrink-0" style={{ color: C.muted }}>
                          {fmtRange(day.viewsMin, day.viewsMax)}
                        </p>
                      )}
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 tracking-wide"
                        style={{ background: sc.bg, color: sc.c, border: `1px solid ${sc.b}` }}
                      >
                        {day.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={CARD} className="mt-3 p-5">
              <p className="text-[12px] mb-4" style={{ color: C.muted }}>
                {allPosts.length < 3 ? "Sync your accounts to generate a content calendar" : "Generating calendar…"}
              </p>
              <Skeleton />
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
