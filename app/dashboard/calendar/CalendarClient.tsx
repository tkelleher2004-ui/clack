"use client";

import { useState, useRef } from "react";

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

function statusColor(status: string): string {
  if (status === "BEST") return C.green;
  if (status === "POST") return C.purple;
  if (status === "TEST") return C.amber;
  if (status === "REST") return C.muted;
  return C.sub;
}

function signalColor(signal: string): string {
  if (signal === "POST") return C.green;
  if (signal === "TEST") return C.amber;
  return C.red;
}

interface CalendarDay {
  day: string;
  date: string;
  title: string;
  viewsMin: number;
  viewsMax: number;
  status: string;
}

interface Idea {
  title: string;
  format: string;
  viewsMin: number;
  viewsMax: number;
  signal: string;
  hook?: string;
}

interface PostedIdea {
  id: string;
  title: string;
  format: string | null;
  postedAt: string;
  matchedPostId: string | null;
}

interface RecentPost {
  id: string;
  caption: string;
  platform: string;
  postedAt: string;
  views: number;
}

interface Props {
  weeklyCalendar: CalendarDay[];
  ideas: Idea[];
  postedIdeas: PostedIdea[];
  recentPosts: RecentPost[];
}

export function CalendarClient({ weeklyCalendar: initialCalendar, ideas: initialIdeas, postedIdeas, recentPosts }: Props) {
  const [calendar, setCalendar] = useState(initialCalendar);
  const hasCalendar = calendar.length > 0;
  const [ideas, setIdeas] = useState(initialIdeas);
  const hasIdeas = ideas.length > 0;
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [calendarDirty, setCalendarDirty] = useState(false);
  const [isSavingCalendar, setIsSavingCalendar] = useState(false);

  // Quick generate state
  const [topicInput, setTopicInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const topicRef = useRef<HTMLInputElement>(null);

  const generateIdeas = async () => {
    const topic = topicInput.trim();
    if (!topic || isGenerating) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/ideas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, count: 3 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to generate");
      }
      const data = await res.json() as { ideas: Idea[] };
      setIdeas((prev) => [...data.ideas, ...prev].slice(0, 15));
      setTopicInput("");
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveCalendar = async (updatedCalendar: CalendarDay[]) => {
    setIsSavingCalendar(true);
    try {
      const res = await fetch("/api/overview/refresh", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyCalendar: updatedCalendar }),
      });
      if (res.ok) setCalendarDirty(false);
    } catch {
      // silent fail — data is still in local state
    } finally {
      setIsSavingCalendar(false);
    }
  };

  const updateDay = (index: number, title: string) => {
    const updated = calendar.map((d, i) =>
      i === index ? { ...d, title, status: title.trim() ? d.status : "REST" } : d
    );
    setCalendar(updated);
    setCalendarDirty(true);
    setEditingDay(null);
    saveCalendar(updated);
  };

  const clearDay = (index: number) => {
    const updated = calendar.map((d, i) =>
      i === index ? { ...d, title: "Rest day", status: "REST", viewsMin: 0, viewsMax: 0 } : d
    );
    setCalendar(updated);
    setCalendarDirty(true);
    setEditingDay(null);
    saveCalendar(updated);
  };

  const slotIdeaToDay = (index: number, idea: Idea) => {
    const updated = calendar.map((d, i) =>
      i === index
        ? { ...d, title: idea.title, viewsMin: idea.viewsMin, viewsMax: idea.viewsMax, status: idea.signal === "POST" ? "POST" : "TEST" }
        : d
    );
    setCalendar(updated);
    setCalendarDirty(true);
    setEditingDay(null);
    saveCalendar(updated);
  };

  return (
    <div className="min-h-full px-6 py-7" style={{ background: "#080808" }}>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[20px] font-bold" style={{ color: C.text }}>
          Content Calendar
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: C.muted }}>
          Your AI-generated posting schedule and content pipeline
        </p>
      </div>

      {/* Post about this — quick generate */}
      <div className="mb-7">
        <form
          onSubmit={(e) => { e.preventDefault(); generateIdeas(); }}
          className="flex items-center gap-2"
        >
          <div
            className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
          >
            <span style={{ color: "#7C5CFC", fontSize: "13px" }}>✦</span>
            <input
              ref={topicRef}
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="I want to post about..."
              className="flex-1 bg-transparent text-[13px] outline-none"
              style={{ color: C.text }}
              disabled={isGenerating}
            />
          </div>
          <button
            type="submit"
            disabled={!topicInput.trim() || isGenerating}
            className="px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all shrink-0"
            style={{
              background: topicInput.trim() ? "#7C5CFC" : "rgba(124,92,252,0.15)",
              color: topicInput.trim() ? "white" : "#7C5CFC",
              boxShadow: topicInput.trim() ? "0 4px 20px rgba(124,92,252,0.35)" : "none",
              opacity: isGenerating ? 0.6 : 1,
            }}
          >
            {isGenerating ? "Generating..." : "Generate Ideas"}
          </button>
        </form>
        {generateError && (
          <p className="text-[12px] mt-2 px-1" style={{ color: C.red }}>
            {generateError}
          </p>
        )}
      </div>

      {!hasCalendar && !hasIdeas ? (
        <div style={CARD} className="p-10 text-center">
          <p className="text-[14px] font-medium mb-1" style={{ color: C.text }}>
            No calendar yet
          </p>
          <p className="text-[13px]" style={{ color: C.muted }}>
            Sync your accounts and chat with your AI strategist to generate a content plan.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Weekly calendar */}
          {hasCalendar && (
            <section>
              <Label>This Week</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-3">
                {calendar.map((d, i) => {
                  const isRest = d.status === "REST";
                  const isEditing = editingDay === i;
                  return (
                    <div
                      key={i}
                      style={{
                        ...CARD,
                        opacity: isRest && !isEditing ? 0.5 : 1,
                        borderLeft: `2px solid ${statusColor(d.status)}`,
                      }}
                      className="p-3 relative group cursor-pointer"
                      onClick={() => {
                        if (!isEditing) {
                          setEditingDay(i);
                          setEditTitle(isRest ? "" : d.title);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold" style={{ color: C.text }}>
                          {d.day}
                        </span>
                        <span className="text-[10px]" style={{ color: C.muted }}>
                          {d.date}
                        </span>
                      </div>

                      {isEditing ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") updateDay(i, editTitle);
                              if (e.key === "Escape") setEditingDay(null);
                            }}
                            placeholder="Content title..."
                            className="w-full text-[12px] bg-transparent outline-none mb-2 px-1 py-0.5 rounded"
                            style={{
                              color: C.text,
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(124,92,252,0.30)",
                            }}
                          />
                          <div className="flex items-center gap-1 mb-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => updateDay(i, editTitle)}
                              className="text-[10px] px-2 py-0.5 rounded font-medium"
                              style={{ background: "rgba(124,92,252,0.15)", color: "#A78BFA" }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => clearDay(i)}
                              className="text-[10px] px-2 py-0.5 rounded font-medium"
                              style={{ background: "rgba(239,68,68,0.10)", color: C.red }}
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingDay(null)}
                              className="text-[10px] px-2 py-0.5 rounded"
                              style={{ color: C.muted }}
                            >
                              Cancel
                            </button>
                          </div>
                          {/* Quick slot from ideas */}
                          {ideas.length > 0 && (
                            <div>
                              <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>
                                Slot an idea
                              </p>
                              <div className="space-y-0.5 max-h-[80px] overflow-y-auto">
                                {ideas.slice(0, 4).map((idea, j) => (
                                  <button
                                    key={j}
                                    type="button"
                                    onClick={() => slotIdeaToDay(i, idea)}
                                    className="w-full text-left text-[10px] px-1.5 py-1 rounded truncate transition-colors"
                                    style={{ color: C.sub }}
                                    onMouseEnter={(e) => {
                                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,92,252,0.08)";
                                    }}
                                    onMouseLeave={(e) => {
                                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                                    }}
                                  >
                                    {idea.title}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <p
                            className="text-[12px] leading-snug mb-2"
                            style={{ color: isRest ? C.muted : C.sub, minHeight: "32px" }}
                          >
                            {isRest ? "Rest day" : d.title}
                          </p>
                          {!isRest && (
                            <div className="flex items-center justify-between">
                              <span
                                className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                                style={{
                                  color: statusColor(d.status),
                                  background: `${statusColor(d.status)}15`,
                                }}
                              >
                                {d.status}
                              </span>
                              <span className="text-[10px]" style={{ color: C.muted }}>
                                {fmt(d.viewsMin)}–{fmt(d.viewsMax)}
                              </span>
                            </div>
                          )}
                          {/* Edit hint on hover */}
                          <div
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: C.muted }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              {isSavingCalendar && (
                <p className="text-[11px] mt-2 animate-pulse" style={{ color: "#A78BFA" }}>
                  Saving calendar...
                </p>
              )}
            </section>
          )}

          {/* Content ideas pipeline */}
          {hasIdeas && (
            <section>
              <Label>Content Ideas Pipeline</Label>
              <div className="mt-3 space-y-2">
                {ideas.map((idea, i) => {
                  const posted = postedIdeas.find(
                    (p) => p.title.toLowerCase() === idea.title.toLowerCase()
                  );
                  return (
                    <div
                      key={i}
                      style={{
                        ...CARD,
                        borderLeft: `2px solid ${posted ? C.green : signalColor(idea.signal)}`,
                      }}
                      className="p-4 flex items-center gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[13px] font-medium truncate" style={{ color: C.text }}>
                            {idea.title}
                          </p>
                          {posted && (
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-md shrink-0 font-medium"
                              style={{ background: "rgba(74,222,128,0.12)", color: C.green }}
                            >
                              Posted
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-md"
                            style={{ background: "rgba(124,92,252,0.12)", color: "#A78BFA" }}
                          >
                            {idea.format}
                          </span>
                          {idea.hook && (
                            <span className="text-[11px] italic truncate" style={{ color: C.muted }}>
                              &quot;{idea.hook.slice(0, 50)}&quot;
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-medium" style={{ color: C.text }}>
                          {fmt(idea.viewsMin)}–{fmt(idea.viewsMax)}
                        </p>
                        <span
                          className="text-[10px] font-semibold uppercase"
                          style={{ color: posted ? C.green : signalColor(idea.signal) }}
                        >
                          {posted ? "DONE" : idea.signal}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Recently posted */}
          {recentPosts.length > 0 && (
            <section>
              <Label>Recently Posted</Label>
              <div className="mt-3 space-y-1.5">
                {recentPosts.slice(0, 10).map((p) => {
                  const matched = postedIdeas.find((pi) => pi.matchedPostId === p.id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: p.platform === "instagram" ? C.ig : p.platform === "tiktok" ? C.tt : C.purple }}
                      />
                      <p className="text-[12px] flex-1 truncate" style={{ color: C.sub }}>
                        {p.caption.slice(0, 60) || "Untitled"}
                      </p>
                      {matched && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: "rgba(124,92,252,0.12)", color: "#A78BFA" }}
                        >
                          from idea
                        </span>
                      )}
                      <span className="text-[12px] font-medium shrink-0" style={{ color: C.text }}>
                        {fmt(p.views)} views
                      </span>
                      <span className="text-[11px] shrink-0" style={{ color: C.muted }}>
                        {p.postedAt ? new Date(p.postedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
