"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";
import { ArtifactCard } from "@/components/dashboard/chat/ArtifactCard";

const SUGGESTION_CHIPS = [
  "I'm posting every day but not growing",
  "What should I post this week?",
  "Analyze why my last video flopped",
  "Build me a plan to hit 10K followers",
  "Help me get brand deals",
];

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0z" />
    </svg>
  );
}

const INSTAGRAM_WELCOME_MESSAGE =
  "I've connected to your Instagram! Let me analyze your content and build a strategy tailored to what's actually working for you. What would you like to focus on first — growth, content ideas, or understanding your audience?";

type Message = {
  id: string;
  role: "ai" | "user";
  content: string;
  richContent?: React.ReactNode;
};

type ArtifactItem = {
  id: string;
  node: React.ReactNode;
};

export default function ChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const artifactsScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [hasConnectedAccounts, setHasConnectedAccounts] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .from("social_accounts")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setHasConnectedAccounts((count ?? 0) > 0));
  }, []);

  const triggerDeepDive = useCallback((skipPoll = false) => {
    const progressId = crypto.randomUUID();
    const progressContent =
      "Analyzing your Instagram...\n\nThis takes about 30 seconds. Looking at every post, audience patterns, and engagement trends.";

    setMessages((prev) => [
      ...prev,
      { id: progressId, role: "ai", content: progressContent },
    ]);

    const updateProgress = (append: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === progressId ? { ...m, content: m.content + append } : m))
      );
    };

    const runAnalysis = () => {
      setTimeout(() => updateProgress("\n\n— Pulled all your recent posts"), 2000);
      setTimeout(() => updateProgress("\n— Analyzing engagement patterns"), 4000);
      setTimeout(() => updateProgress("\n— Mapping audience behavior"), 6000);
      setTimeout(() => updateProgress("\n— Scoring content and building strategy..."), 8000);

      fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "instagram" }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            const artifactId = crypto.randomUUID();
            const analysis = data.analysis as { overall_score?: number; summary?: string };

            // Move artifact to the right panel
            setArtifacts((prev) => [
              ...prev,
              {
                id: artifactId,
                node: (
                  <ArtifactCard
                    title="Instagram Deep Dive"
                    type="deep_dive"
                    id={data.artifact_id}
                    data={data.analysis}
                    pinned
                  />
                ),
              },
            ]);

            setMessages((prev) =>
              prev.map((m) =>
                m.id === progressId
                  ? {
                      ...m,
                      content: `Here's your complete Instagram deep dive — it's now in the panel on the right.\n\nOverall score: ${analysis.overall_score ?? "—"}/10\n\n${analysis.summary ?? ""}\n\nWant me to break down any specific area in more detail?`,
                    }
                  : m
              )
            );
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === progressId
                  ? {
                      ...m,
                      content:
                        "Something went wrong with the analysis. Let me try again — or you can ask me to 'analyze my Instagram' anytime.",
                    }
                  : m
              )
            );
          }
        })
        .catch(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === progressId
                ? {
                    ...m,
                    content:
                      "Something went wrong with the analysis. Let me try again — or you can ask me to 'analyze my Instagram' anytime.",
                  }
                : m
            )
          );
        });
    };

    if (skipPoll) {
      runAnalysis();
      return;
    }

    const supabase = createClient();
    let attempts = 0;
    const maxAttempts = 15;
    const poll = () => {
      supabase
        .from("social_posts")
        .select("id", { count: "exact", head: true })
        .eq("platform", "instagram")
        .then(({ count }) => {
          if ((count ?? 0) > 0) {
            runAnalysis();
          } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(poll, 2000);
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === progressId
                  ? {
                      ...m,
                      content:
                        "Your posts are still syncing. Go to Accounts and click Sync, then return here — or ask me to 'analyze my Instagram' once sync is done.",
                    }
                  : m
              )
            );
          }
        });
    };
    poll();
  }, []);

  useEffect(() => {
    const welcome = searchParams.get("welcome");
    if (welcome === "instagram" && messages.length === 0) {
      setMessages([{ id: crypto.randomUUID(), role: "ai", content: INSTAGRAM_WELCOME_MESSAGE }]);
      window.history.replaceState({}, "", "/dashboard/chat");
      triggerDeepDive();
    }
  }, [searchParams, messages.length, triggerDeepDive]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (artifacts.length > 0) {
      artifactsScrollRef.current?.scrollTo({
        top: artifactsScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [artifacts]);

  const sendMessage = async (userContent: string) => {
    setError(null);
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: userContent },
    ]);
    setIsTyping(true);

    const apiMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userContent },
    ];

    const aiMessageId = crypto.randomUUID();
    let aiMessageAdded = false;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6);
            if (payload === "[DONE]") continue;
            try {
              const chunk = JSON.parse(payload) as { error?: string; text?: string };
              if (chunk.error) throw new Error(chunk.error);
              if (chunk.text) {
                fullText += chunk.text;
                if (!aiMessageAdded) {
                  aiMessageAdded = true;
                  setMessages((prev) => [
                    ...prev,
                    { id: aiMessageId, role: "ai", content: fullText },
                  ]);
                } else {
                  setMessages((prev) =>
                    prev.map((m) => (m.id === aiMessageId ? { ...m, content: fullText } : m))
                  );
                }
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      if (fullText === "" && !aiMessageAdded) {
        setMessages((prev) => [
          ...prev,
          { id: aiMessageId, role: "ai", content: "I couldn't generate a response. Try again." },
        ]);
      }

      // Show Connect Instagram card inline if AI references accounts and user has none
      if (
        !hasConnectedAccounts &&
        (fullText.toLowerCase().includes("connect") ||
          fullText.toLowerCase().includes("link") ||
          fullText.toLowerCase().includes("account"))
      ) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMessageId
              ? {
                  ...m,
                  richContent: (
                    <div
                      className="mt-3 rounded-xl p-4"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                          <InstagramIcon />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" style={{ color: "#E8E8F0" }}>
                            Connect Instagram
                          </p>
                          <p className="text-xs" style={{ color: "#6B6B80" }}>
                            I&apos;ll analyze your posts, audience, and growth patterns
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => router.push("/dashboard/accounts")}
                          className="text-sm font-medium px-3 py-1.5 rounded-lg transition-all flex-shrink-0"
                          style={{ color: "#E8E8F0" }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background =
                              "rgba(255,255,255,0.08)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                          }}
                        >
                          Connect →
                        </button>
                      </div>
                    </div>
                  ),
                }
              : m
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      if (aiMessageAdded) {
        setMessages((prev) => prev.filter((m) => m.id !== aiMessageId));
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    if (trimmed.toLowerCase().includes("analyze my instagram")) {
      triggerDeepDive(true);
      return;
    }
    sendMessage(trimmed);
  };

  const handleSuggestionClick = (text: string) => {
    if (text.toLowerCase().includes("analyze my instagram")) {
      triggerDeepDive(true);
      return;
    }
    sendMessage(text);
  };

  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
  };

  const hasText = inputValue.trim().length > 0;
  const showEmptyState = messages.length === 0;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel: Chat (35%) ── */}
      <div
        className="flex flex-col overflow-hidden min-h-0"
        style={{ width: "35%", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Messages scroll area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-5 py-8 space-y-6">
          {showEmptyState ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-2">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                style={{
                  background: "rgba(124,92,252,0.12)",
                  border: "1px solid rgba(124,92,252,0.20)",
                  boxShadow: "0 0 24px rgba(124,92,252,0.15)",
                }}
              >
                <span style={{ color: "#A78BFA", fontSize: "18px" }}>✦</span>
              </div>

              <h1 className="text-xl font-semibold mb-2" style={{ color: "#E8E8F0" }}>
                Your AI Marketing Brain
              </h1>
              <p className="text-sm leading-relaxed mb-8" style={{ color: "#6B6B80" }}>
                I analyze your social media, find what works, and tell you exactly what to do next.
              </p>

              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleSuggestionClick(chip)}
                    className="text-[12px] px-3 py-2 rounded-xl transition-all cursor-pointer"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#9898B0",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor =
                        "rgba(255,255,255,0.15)";
                      (e.currentTarget as HTMLButtonElement).style.color = "#E8E8F0";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor =
                        "rgba(255,255,255,0.08)";
                      (e.currentTarget as HTMLButtonElement).style.color = "#9898B0";
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) =>
                msg.role === "user" ? (
                  /* User message */
                  <div key={msg.id} className="flex justify-end">
                    <div
                      className="max-w-[85%] rounded-2xl px-4 py-2.5"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <p className="text-[13px] leading-relaxed" style={{ color: "#E8E8F0" }}>
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* AI message */
                  <div key={msg.id} className="flex gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: "#7C5CFC", boxShadow: "0 0 12px rgba(124,92,252,0.4)" }}
                    >
                      <span className="text-white" style={{ fontSize: "10px", fontWeight: 700 }}>
                        ✦
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 ai-prose">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => (
                            <p className="text-[13px] leading-relaxed mb-3 last:mb-0" style={{ color: "#C4C4D4" }}>
                              {children}
                            </p>
                          ),
                          strong: ({ children }) => (
                            <strong style={{ color: "#E8E8F0", fontWeight: 600 }}>{children}</strong>
                          ),
                          em: ({ children }) => (
                            <em style={{ color: "#C4C4D4", fontStyle: "italic" }}>{children}</em>
                          ),
                          ul: ({ children }) => (
                            <ul className="text-[13px] leading-relaxed mb-3 last:mb-0 space-y-1 pl-4" style={{ color: "#C4C4D4" }}>
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="text-[13px] leading-relaxed mb-3 last:mb-0 space-y-1 pl-4 list-decimal" style={{ color: "#C4C4D4" }}>
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="relative pl-2 before:content-['–'] before:absolute before:-left-2 before:opacity-40">
                              {children}
                            </li>
                          ),
                          code: ({ children }) => (
                            <code
                              className="text-[12px] px-1.5 py-0.5 rounded-md font-mono"
                              style={{ background: "rgba(255,255,255,0.08)", color: "#9898B0" }}
                            >
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre
                              className="text-[12px] p-3 rounded-xl mb-3 overflow-x-auto font-mono"
                              style={{ background: "rgba(255,255,255,0.05)", color: "#C4C4D4", border: "1px solid rgba(255,255,255,0.06)" }}
                            >
                              {children}
                            </pre>
                          ),
                          h1: ({ children }) => (
                            <h1 className="text-[14px] font-semibold mb-2 mt-1" style={{ color: "#E8E8F0" }}>{children}</h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-[13px] font-semibold mb-2 mt-1" style={{ color: "#E8E8F0" }}>{children}</h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-[13px] font-medium mb-1 mt-1" style={{ color: "#E8E8F0" }}>{children}</h3>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                      {msg.richContent}
                    </div>
                  </div>
                )
              )}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex gap-3">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "#7C5CFC", boxShadow: "0 0 12px rgba(124,92,252,0.4)" }}
                  >
                    <span className="text-white" style={{ fontSize: "10px", fontWeight: 700 }}>
                      ✦
                    </span>
                  </div>
                  <div className="flex items-center gap-1 py-2">
                    {[0, 150, 300].map((delay) => (
                      <div
                        key={delay}
                        className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ background: "#6B6B80", animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex gap-3">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "#7C5CFC" }}
                  >
                    <span className="text-white" style={{ fontSize: "10px", fontWeight: 700 }}>
                      ✦
                    </span>
                  </div>
                  <p className="text-[13px]" style={{ color: "rgba(229,115,115,0.7)" }}>
                    Something went wrong. Try again.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Chat input — fixed at panel bottom */}
        <div
          className="flex-none px-4 pb-5 pt-3"
          style={{
            background: "linear-gradient(to top, #0A0A0A 70%, transparent)",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "16px",
              padding: "4px",
            }}
          >
            <div className="flex items-end gap-2 px-3 py-2">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onInput={handleTextareaInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message your AI strategist..."
                className="flex-1 bg-transparent text-[13px] placeholder-[#6B6B80] outline-none resize-none"
                style={{ maxHeight: "128px", lineHeight: "1.5", color: "#E8E8F0" }}
                disabled={isTyping}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={isTyping || !hasText}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0 mb-0.5"
                style={{
                  background: hasText ? "#7C5CFC" : "transparent",
                  color: hasText ? "white" : "#6B6B80",
                  boxShadow: hasText ? "0 4px 16px rgba(124,92,252,0.3)" : "none",
                }}
              >
                <ArrowUpIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-center mt-2" style={{ fontSize: "11px", color: "#6B6B80" }}>
            Clack can make mistakes. Verify important advice.
          </p>
        </div>
      </div>

      {/* ── Right panel: Artifacts workspace (65%) ── */}
      <div
        ref={artifactsScrollRef}
        className="flex-1 overflow-y-auto"
        style={{ background: "transparent" }}
      >
        {artifacts.length === 0 ? (
          /* Artifacts empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <svg
                className="w-7 h-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.25}
                style={{ color: "#6B6B80" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium mb-1.5" style={{ color: "#9898B0" }}>
              Your reports and plans will appear here
            </p>
            <p className="text-xs leading-relaxed max-w-xs" style={{ color: "#6B6B80" }}>
              Ask me to analyze your accounts, build a content plan, or score your videos — results
              will show up in this workspace.
            </p>
          </div>
        ) : (
          /* Artifacts list */
          <div className="p-6 space-y-4">
            {artifacts.map((artifact) => (
              <div key={artifact.id}>{artifact.node}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
