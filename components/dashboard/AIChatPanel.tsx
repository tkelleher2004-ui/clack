"use client";

import { useRef, useState, useImperativeHandle, forwardRef } from "react";
import Link from "next/link";
import { PlatformIcon } from "@/components/social/PlatformIcon";
import { InsightCard } from "./chat/InsightCard";
import { ContentSuggestion } from "./chat/ContentSuggestion";
import type { SocialPlatform } from "@/lib/types/social";

const PLATFORMS: SocialPlatform[] = [
  "instagram",
  "tiktok",
  "youtube",
  "linkedin",
  "twitter",
  "facebook",
];

export interface AIChatPanelProps {
  hasConnectedAccounts: boolean;
  fullWidth?: boolean;
  goalsRaw?: string | null;
  goalsTimeframe?: string | null;
  onSetGoals?: (goalsRaw: string, goalsTimeframe: string) => void;
}

export interface AIChatPanelRef {
  focusInput: () => void;
}

export const AIChatPanel = forwardRef<AIChatPanelRef, AIChatPanelProps>(
  function AIChatPanel(
    {
      hasConnectedAccounts,
      fullWidth = false,
      goalsRaw = null,
      goalsTimeframe = null,
      onSetGoals,
    },
    ref
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [messages, setMessages] = useState<
      Array<{
        id: string;
        role: "ai" | "user";
        content: string;
        richContent?: React.ReactNode;
      }>
    >([]);
    const [inputValue, setInputValue] = useState("");

    useImperativeHandle(ref, () => ({
      focusInput: () => inputRef.current?.focus(),
    }));

    const handleSend = () => {
      const trimmed = inputValue.trim();
      if (!trimmed) return;

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: trimmed },
      ]);
      setInputValue("");

      // Mock AI response
      setTimeout(() => {
        const aiResponse = hasConnectedAccounts
          ? "Great question! Based on your connected accounts and recent performance, I'd recommend focusing on short-form video content this week. Your Instagram Reels have been outperforming — consider repurposing your top clips for TikTok."
          : "I'm still learning about your brand. Connect your social accounts so I can give you personalized insights!";

        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "ai", content: aiResponse },
        ]);
      }, 600);
    };

    const showInitialMessages = messages.length === 0;
    const hasGoals = !!goalsRaw?.trim();
    const firstGoalDescription = hasGoals
      ? goalsRaw!.split(/[.!?]/)[0]?.trim() || goalsRaw!.slice(0, 80)
      : "";

    const [inlineGoalsInput, setInlineGoalsInput] = useState("");
    const [inlineGoalsTimeframe, setInlineGoalsTimeframe] = useState("");

    const handleSetGoalsFromChat = async () => {
      if (!inlineGoalsInput.trim() || !onSetGoals) return;
      onSetGoals(inlineGoalsInput.trim(), inlineGoalsTimeframe || "none");
      setInlineGoalsInput("");
      setInlineGoalsTimeframe("");
    };

    return (
      <div
        className={`flex flex-col ${fullWidth ? "max-w-3xl mx-auto w-full" : ""}`}
        style={{
          height: fullWidth ? "100%" : undefined,
          minHeight: fullWidth ? "400px" : undefined,
        }}
      >
        <div
          className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-[20px]"
          style={{
            background: "transparent",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: [
              "inset 0 1px 0 0 rgba(255,255,255,0.30)",
              "inset 0 -1px 0 0 rgba(0,0,0,0.04)",
              "inset 1px 0 0 0 rgba(255,255,255,0.18)",
              "inset -1px 0 0 0 rgba(0,0,0,0.06)",
              "0 4px 24px rgba(0,0,0,0.5)",
            ].join(", "),
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2">
              <span style={{ color: "#6B6B80" }}>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
              </span>
              <span
                className="text-sm font-semibold"
                style={{ color: "#E4E4E7" }}
              >
                AI Strategist
              </span>
            </div>
            <button
              type="button"
              className="p-1"
              style={{ color: "#71717A" }}
              aria-label="More options"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            {/* Goals exist + accounts connected */}
            {showInitialMessages && hasGoals && hasConnectedAccounts && (
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span style={{ color: "#8B5CF6" }}>✦</span>
                    <span className="text-xs" style={{ color: "#6B6B80" }}>
                      Clack AI
                    </span>
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "#A1A1AA" }}
                  >
                    Good morning! Quick update on your goals:
                  </p>
                  <div
                    className="rounded-[14px] p-4 mt-2 space-y-3"
                    style={{
                      background: "transparent",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      boxShadow: [
                        "inset 0 1px 0 0 rgba(255,255,255,0.15)",
                        "0 2px 8px rgba(0,0,0,0.3)",
                      ].join(", "),
                    }}
                  >
                    {[
                      { desc: "Grow Instagram to 10K followers", pct: 28, cur: 2847, tgt: 10000 },
                      { desc: "Start getting brand deals", pct: 0, cur: 0, tgt: null },
                    ].map((g, i) => (
                      <div key={i}>
                        <p className="text-sm" style={{ color: "#A1A1AA" }}>{g.desc}</p>
                        <div
                          className="mt-1.5 h-1.5 rounded-full overflow-hidden"
                          style={{ background: "rgba(255,255,255,0.06)" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${g.pct}%`,
                              background: "linear-gradient(to right, #8B5CF6, #A78BFA)",
                            }}
                          />
                        </div>
                        <p className="text-xs mt-1" style={{ color: "#71717A" }}>
                          {g.tgt != null ? `${g.pct}% · ${g.cur.toLocaleString()} / ${g.tgt.toLocaleString()}` : `${g.pct}%`}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p
                    className="text-sm leading-relaxed mt-2"
                    style={{ color: "#A1A1AA" }}
                  >
                    Your Instagram growth rate suggests you&apos;ll hit 10K by May — ahead of your June deadline. Keep the Reels momentum going.
                  </p>
                </div>
              </>
            )}

            {/* Goals exist + no accounts */}
            {showInitialMessages && hasGoals && !hasConnectedAccounts && (
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span style={{ color: "#8B5CF6" }}>✦</span>
                    <span className="text-xs" style={{ color: "#6B6B80" }}>
                      Clack AI
                    </span>
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "#A1A1AA" }}
                  >
                    I can see you&apos;re aiming to {firstGoalDescription}. Let&apos;s build a plan around that.
                    <br />
                    <br />
                    To help you get there, I need to connect to your social accounts so I can see where you&apos;re starting from and build a roadmap.
                  </p>
                  <div
                    className="rounded-[14px] p-4 mt-2"
                    style={{
                      background: "transparent",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      boxShadow: [
                        "inset 0 1px 0 0 rgba(255,255,255,0.15)",
                        "0 2px 8px rgba(0,0,0,0.3)",
                      ].join(", "),
                    }}
                  >
                    <p className="text-sm font-medium" style={{ color: "#E4E4E7" }}>
                      Connect Your Accounts
                    </p>
                    <div className="mt-3 flex gap-3 flex-wrap">
                      {PLATFORMS.map((p) => (
                        <PlatformIcon key={p} platform={p} size="sm" color="#A1A1AA" />
                      ))}
                    </div>
                    <Link
                      href="/dashboard/accounts"
                      className="mt-3 inline-block rounded-full px-4 py-2 text-sm font-medium"
                      style={{
                        color: "#8B5CF6",
                        background: "rgba(139,92,246,0.1)",
                        border: "1px solid rgba(139,92,246,0.2)",
                      }}
                    >
                      Connect
                    </Link>
                    <p className="mt-3 text-xs" style={{ color: "#71717A" }}>
                      I&apos;ll analyze every post, video, and metric to build your complete marketing profile.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span style={{ color: "#8B5CF6" }}>✦</span>
                    <span className="text-xs" style={{ color: "#6B6B80" }}>Clack AI</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
                    Once connected, I can:
                    <br />• Break down every video — what worked, what didn&apos;t, and why
                    <br />• Show you exactly when and what to post
                    <br />• Find content gaps your competitors are filling
                    <br />• Alert you to trending topics in your niche
                    <br />• Generate a complete weekly marketing plan
                    <br />
                    <br />
                    What platforms do you use the most?
                  </p>
                </div>
              </>
            )}

            {/* No goals set */}
            {showInitialMessages && !hasGoals && (
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span style={{ color: "#8B5CF6" }}>✦</span>
                    <span className="text-xs" style={{ color: "#6B6B80" }}>Clack AI</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
                    I&apos;m your AI marketing strategist. Before I can help you grow, I need to know — what are you trying to accomplish?
                    <br />
                    <br />
                    Tell me your goals in your own words. Something like &quot;I want to grow my TikTok to 50K and start landing brand deals by summer.&quot; I&apos;ll build your strategy around that.
                  </p>
                  <div
                    className="rounded-[14px] p-4 mt-2"
                    style={{
                      background: "transparent",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      boxShadow: [
                        "inset 0 1px 0 0 rgba(255,255,255,0.15)",
                        "0 2px 8px rgba(0,0,0,0.3)",
                      ].join(", "),
                    }}
                  >
                    <textarea
                      rows={4}
                      className="w-full px-4 py-3 transition-all duration-200 outline-none resize-y min-h-[80px]"
                      style={{
                        background: "transparent",
                        borderRadius: "14px",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "#E4E4E7",
                        boxShadow: [
                          "inset 0 1px 0 0 rgba(255,255,255,0.22)",
                          "inset 1px 0 0 0 rgba(255,255,255,0.12)",
                          "0 2px 12px rgba(0,0,0,0.3)",
                        ].join(", "),
                      }}
                      placeholder="e.g. I want to grow my Instagram to 10K followers by June, start getting brand deals..."
                      value={inlineGoalsInput}
                      onChange={(e) => setInlineGoalsInput(e.target.value)}
                    />
                    <select
                      className="mt-3 w-full px-4 py-2 rounded-[14px] outline-none"
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "#E4E4E7",
                      }}
                      value={inlineGoalsTimeframe}
                      onChange={(e) => setInlineGoalsTimeframe(e.target.value)}
                    >
                      <option value="">Select timeframe</option>
                      <option value="1_month">1 month — I need results fast</option>
                      <option value="3_months">3 months — steady growth</option>
                      <option value="6_months">6 months — building long-term</option>
                      <option value="1_year">1 year — playing the long game</option>
                      <option value="none">No specific timeframe</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleSetGoalsFromChat}
                      disabled={!inlineGoalsInput.trim() || !onSetGoals}
                      className="mt-3 inline-block rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
                      style={{
                        color: "#8B5CF6",
                        background: "rgba(139,92,246,0.1)",
                        border: "1px solid rgba(139,92,246,0.2)",
                      }}
                    >
                      Set Goals
                    </button>
                  </div>
                </div>
              </>
            )}

            {messages.map((msg) =>
              msg.role === "user" ? (
                <div
                  key={msg.id}
                  className="flex justify-end"
                >
                  <div
                    className="max-w-[80%] rounded-2xl px-4 py-2"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      boxShadow: [
                        "inset 0 1px 0 0 rgba(255,255,255,0.15)",
                        "inset 0 -1px 0 0 rgba(0,0,0,0.03)",
                        "inset 1px 0 0 0 rgba(255,255,255,0.08)",
                        "inset -1px 0 0 0 rgba(0,0,0,0.04)",
                      ].join(", "),
                    }}
                  >
                    <p
                      className="text-sm"
                      style={{ color: "#E4E4E7" }}
                    >
                      {msg.content}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span style={{ color: "#8B5CF6" }}>✦</span>
                    <span className="text-xs" style={{ color: "#6B6B80" }}>
                      Clack AI
                    </span>
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "#A1A1AA" }}
                  >
                    {msg.content}
                  </p>
                  {msg.richContent}
                </div>
              )
            )}
          </div>

          {/* Input */}
          <div
            className="shrink-0 p-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex gap-2 items-center">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Ask about your content, audience, or strategy..."
                className="flex-1 px-4 py-3 rounded-[14px] outline-none transition-all"
                style={{
                  background: "transparent",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#E4E4E7",
                  boxShadow: [
                    "inset 0 1px 0 0 rgba(255,255,255,0.22)",
                    "inset 1px 0 0 0 rgba(255,255,255,0.12)",
                    "inset -1px 0 0 0 rgba(255,255,255,0.05)",
                    "inset 0 -1px 0 0 rgba(255,255,255,0.03)",
                    "0 2px 12px rgba(0,0,0,0.3)",
                  ].join(", "),
                }}
              />
              <button
                type="button"
                onClick={handleSend}
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
                style={{
                  background: "transparent",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow: [
                    "inset 0 1px 0 0 rgba(255,255,255,0.15)",
                    "0 2px 8px rgba(0,0,0,0.3)",
                  ].join(", "),
                  color: "#8B5CF6",
                }}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
