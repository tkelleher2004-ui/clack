"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";
import { useUserGoal } from "@/lib/context/UserGoalContext";
import { ArtifactRenderer, cleanMessageText } from "@/components/dashboard/chat/ArtifactRenderer";
import type { UserGoal } from "@/lib/types/social";

const SUGGESTION_CHIPS = [
  "What should I post this week?",
  "Why is my growth slowing down?",
  "Score my next post idea",
  "Build me a content plan",
  "What's working best right now?",
];

type Message = {
  id: string;
  role: "ai" | "user";
  content: string;
};

type ChatSidebarProps = Record<string, never>;

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}


function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="text-[13px] leading-relaxed mb-2 last:mb-0" style={{ color: "#9090AA" }}>
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong style={{ color: "#F0F0F8", fontWeight: 600 }}>{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="text-[13px] leading-relaxed mb-2 space-y-1 pl-4" style={{ color: "#9090AA" }}>
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="text-[13px] leading-relaxed mb-2 space-y-1 pl-4 list-decimal" style={{ color: "#9090AA" }}>
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
            style={{ background: "rgba(255,255,255,0.08)", color: "#C4B5FD" }}
          >
            {children}
          </code>
        ),
        h1: ({ children }) => (
          <h1 className="text-[14px] font-semibold mb-2 mt-1" style={{ color: "#F0F0F8" }}>
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-[13px] font-semibold mb-1.5 mt-1" style={{ color: "#F0F0F8" }}>
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-[13px] font-medium mb-1 mt-1" style={{ color: "#F0F0F8" }}>
            {children}
          </h3>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function ChatSidebar({}: ChatSidebarProps) {
  const { userGoal, setUserGoal, triggerRefresh, chatContext, clearChatContext } = useUserGoal();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationIdRef = useRef<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);

  // Persist messages to Supabase
  const persistMessages = useCallback(async (msgs: Message[]) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const payload = msgs.map((m) => ({ id: m.id, role: m.role, content: m.content }));
    const cid = conversationIdRef.current;
    try {
      if (cid) {
        await supabase
          .from("ai_conversations")
          .update({ messages: payload, updated_at: new Date().toISOString() })
          .eq("id", cid)
          .eq("user_id", user.id);
      } else {
        const { data, error: insertError } = await supabase
          .from("ai_conversations")
          .insert({ user_id: user.id, messages: payload })
          .select("id")
          .single();
        if (!insertError && data) {
          conversationIdRef.current = data.id;
        }
      }
    } catch (err) {
      console.error("[chat] persist error:", err);
    }
  }, []);

  // Check for Instagram welcome flag
  useEffect(() => {
    const welcome = localStorage.getItem("clack_chat_welcome");
    if (welcome === "instagram" && messages.length === 0 && !isLoadingConversation) {
      localStorage.removeItem("clack_chat_welcome");
      const welcomeMsg: Message = {
        id: crypto.randomUUID(),
        role: "ai",
        content:
          "I've connected to your Instagram! Analyzing your content and building a strategy tailored to what's actually working for you. Ask me anything — what do you want to focus on first?",
      };
      setMessages([welcomeMsg]);
    }
  }, [isLoadingConversation, messages.length]);

  // Load conversation on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setIsLoadingConversation(false);
        return;
      }

      const { data: conv } = await supabase
        .from("ai_conversations")
        .select("id, messages")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cancelled && conv?.messages && Array.isArray(conv.messages) && conv.messages.length > 0) {
        const loaded = (
          conv.messages as Array<{ id?: string; role?: string; content?: string }>
        ).map((m) => ({
          id: m.id ?? crypto.randomUUID(),
          role: (m.role === "user" ? "user" : "ai") as "ai" | "user",
          content: m.content ?? "",
        }));
        setMessages(loaded);
        conversationIdRef.current = conv.id;
      }
      setIsLoadingConversation(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (userContent: string) => {
    setError(null);
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userContent,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsTyping(true);
    persistMessages(newMessages);

    const apiMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userContent },
    ];

    const aiMessageId = crypto.randomUUID();
    let aiMessageAdded = false;
    let fullText = "";

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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const chunk = JSON.parse(payload) as {
              error?: string;
              text?: string;
              goalUpdate?: {
                primaryGoal: string;
                currentFocus: string;
                weeklyTarget: string;
              } | null;
              dashboardRefresh?: boolean;
            };

            if (chunk.error) throw new Error(chunk.error);

            if (chunk.goalUpdate || chunk.dashboardRefresh) {
              console.log("[ChatSidebar] goal_update received — goalUpdate:", chunk.goalUpdate, "dashboardRefresh:", chunk.dashboardRefresh);
            }

            if (chunk.goalUpdate) {
              // Apply goal update to global state, then trigger refresh AFTER write completes
              const updatedGoal: UserGoal = {
                primaryGoal: chunk.goalUpdate.primaryGoal as UserGoal["primaryGoal"],
                currentFocus: chunk.goalUpdate.currentFocus,
                weeklyTarget: chunk.goalUpdate.weeklyTarget,
                updatedAt: new Date().toISOString(),
              };
              setUserGoal(updatedGoal)
                .then(() => {
                  if (chunk.dashboardRefresh) {
                    console.log("[ChatSidebar] setUserGoal complete — calling triggerRefresh");
                    triggerRefresh();
                  }
                })
                .catch(console.error);
            } else if (chunk.dashboardRefresh) {
              console.log("[ChatSidebar] dashboardRefresh=true (no goal change) — calling triggerRefresh");
              triggerRefresh();
            }

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

      const aiContent = fullText || "I couldn't generate a response. Try again.";
      if (!aiMessageAdded) {
        setMessages((prev) => [
          ...prev,
          { id: aiMessageId, role: "ai", content: aiContent },
        ]);
      }

      persistMessages([
        ...newMessages,
        { id: aiMessageId, role: "ai" as const, content: aiContent },
      ]);

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
    if (!trimmed || isTyping) return;
    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    // Prepend context if a card was pinned
    const ctx = chatContext;
    if (ctx) clearChatContext();
    const fullContent = ctx
      ? `[Context: ${ctx.label} = ${ctx.detail}]\n\n${trimmed}`
      : trimmed;
    sendMessage(fullContent);
  };

  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const t = e.target as HTMLTextAreaElement;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
  };

  const hasText = inputValue.trim().length > 0;
  const showEmptyState = messages.length === 0 && !isLoadingConversation;

  // Collect current goal display
  const currentGoalText = userGoal
    ? `${userGoal.primaryGoal.replace(/_/g, " ")}${userGoal.currentFocus ? ` · ${userGoal.currentFocus}` : ""}`
    : null;

  return (
    <aside
      className="flex flex-col h-full shrink-0 overflow-hidden"
      style={{
        width: "40vw",
        minWidth: "40vw",
        borderLeft: "1px solid rgba(255,255,255,0.07)",
        background: "#0E0E0E",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(124,92,252,0.20)", border: "1px solid rgba(124,92,252,0.35)" }}
          >
            <span style={{ color: "#C4B5FD", fontSize: "11px" }}>✦</span>
          </div>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "#F0F0F8" }}>
              AI Strategist
            </p>
            {currentGoalText && (
              <p className="text-[10px] truncate max-w-[200px]" style={{ color: "#5A5A78" }}>
                {currentGoalText}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-4 py-5 space-y-5">
        {isLoadingConversation ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <p className="text-[13px]" style={{ color: "#5A5A78" }}>
              Loading...
            </p>
          </div>
        ) : showEmptyState ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
              style={{
                background: "rgba(124,92,252,0.15)",
                border: "1px solid rgba(124,92,252,0.30)",
                boxShadow: "0 0 24px rgba(124,92,252,0.20)",
              }}
            >
              <span style={{ color: "#C4B5FD", fontSize: "16px" }}>✦</span>
            </div>
            <p className="text-[14px] font-semibold mb-1.5" style={{ color: "#F0F0F8" }}>
              Your AI Brain
            </p>
            <p className="text-[12px] leading-relaxed mb-6" style={{ color: "#5A5A78" }}>
              I know your content, metrics, and patterns. Ask me anything.
            </p>
            <div className="flex flex-col gap-1.5 w-full">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => sendMessage(chip)}
                  className="text-[12px] px-3 py-2 rounded-xl transition-all text-left"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    color: "#9090AA",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(124,92,252,0.40)";
                    (e.currentTarget as HTMLButtonElement).style.color = "#F0F0F8";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.09)";
                    (e.currentTarget as HTMLButtonElement).style.color = "#9090AA";
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
                <div key={msg.id} className="flex justify-end">
                  <div
                    className="max-w-[88%] rounded-2xl px-3.5 py-2.5"
                    style={{
                      background: "rgba(124,92,252,0.12)",
                      border: "1px solid rgba(124,92,252,0.22)",
                    }}
                  >
                    <p className="text-[13px] leading-relaxed" style={{ color: "#F0F0F8" }}>
                      {msg.content}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex gap-2.5">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "#7C5CFC", boxShadow: "0 0 10px rgba(124,92,252,0.4)" }}
                  >
                    <span className="text-white" style={{ fontSize: "9px", fontWeight: 700 }}>
                      ✦
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <MarkdownMessage content={cleanMessageText(msg.content)} />
                    <ArtifactRenderer raw={msg.content} />
                  </div>
                </div>
              )
            )}

            {isTyping && (
              <div className="flex gap-2.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "#7C5CFC", boxShadow: "0 0 10px rgba(124,92,252,0.4)" }}
                >
                  <span className="text-white" style={{ fontSize: "9px", fontWeight: 700 }}>
                    ✦
                  </span>
                </div>
                <div className="flex items-center gap-1 py-1.5">
                  {[0, 150, 300].map((delay) => (
                    <div
                      key={delay}
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: "#5A5A78", animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="text-[12px] pl-7" style={{ color: "rgba(220,38,38,0.7)" }}>
                Something went wrong. Try again.
              </p>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <div
        className="shrink-0 px-3 pb-4 pt-2"
        style={{ background: "linear-gradient(to top, #0E0E0E 70%, transparent)" }}
      >
        {/* Context pill */}
        {chatContext && (
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium"
              style={{
                background: "rgba(124,92,252,0.08)",
                border: "1px solid rgba(124,92,252,0.2)",
                color: "#7C5CFC",
              }}
            >
              <span style={{ fontSize: "10px" }}>✦</span>
              <span>{chatContext.label}: <strong>{chatContext.value}</strong></span>
              <button
                type="button"
                onClick={clearChatContext}
                className="ml-1 opacity-50 hover:opacity-100 transition-opacity leading-none"
                style={{ color: "#7C5CFC", fontSize: "13px", lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          </div>
        )}
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: "14px",
            padding: "3px",
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
              placeholder="Ask your AI strategist..."
              className="flex-1 bg-transparent text-[13px] placeholder-[#5A5A78] outline-none resize-none"
              style={{ maxHeight: "120px", lineHeight: "1.5", color: "#F0F0F8" }}
              disabled={isTyping}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isTyping || !hasText}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 mb-0.5"
              style={{
                background: hasText ? "#7C5CFC" : "transparent",
                color: hasText ? "white" : "#5A5A78",
                boxShadow: hasText ? "0 4px 20px rgba(124,92,252,0.45)" : "none",
              }}
            >
              <ArrowUpIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
