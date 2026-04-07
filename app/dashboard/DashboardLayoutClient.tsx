"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/auth/actions";
import { UserGoalProvider } from "@/lib/context/UserGoalContext";
import { ChatSidebar } from "@/components/dashboard/ChatSidebar";
import { SyncIndicator } from "@/components/dashboard/SyncIndicator";
import { GoalBar } from "@/components/dashboard/GoalBar";

export interface PinnedArtifact {
  id: string;
  type: string;
  title: string;
  pinned?: boolean;
  created_at?: string;
}

const ARTIFACT_TYPE_COLORS: Record<string, string> = {
  deep_dive: "#7C5CFC",
  weekly_plan: "#06B6D4",
  video_breakdown: "#F59E0B",
  content_gap_report: "#10B981",
  growth_roadmap: "#A78BFA",
  daily_briefing: "#F472B6",
};

const NAV_ITEMS = [
  { href: "/dashboard/overview", label: "Dashboard", icon: "grid" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "chart" },
  { href: "/dashboard/calendar", label: "Calendar", icon: "calendar" },
  { href: "/dashboard/accounts", label: "Accounts", icon: "link" },
  { href: "/dashboard/settings", label: "Settings", icon: "gear" },
];

function NavIcon({ name }: { name: string }) {
  const cls = "w-5 h-5 shrink-0";
  if (name === "grid")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    );
  if (name === "link")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    );
  if (name === "sparkle")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    );
  if (name === "chart")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    );
  if (name === "calendar")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  if (name === "gear")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  return null;
}

export interface DashboardLayoutClientProps {
  children: React.ReactNode;
  pinnedArtifacts: PinnedArtifact[];
  userId: string;
}

export function DashboardLayoutClient({
  children,
  pinnedArtifacts,
  userId,
}: DashboardLayoutClientProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user: u } }) => setUser(u ?? null));
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const isExpanded = expanded || mobileSidebarOpen;

  return (
    <UserGoalProvider userId={userId}>
      <div
        className="flex h-screen overflow-hidden"
        style={{
          background: "#080808",
        }}
      >
        {/* Mobile overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: "rgba(0,0,0,0.35)" }}
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden
          />
        )}

        {/* Left nav sidebar */}
        <aside
          className={`flex flex-col shrink-0 transition-all duration-200 overflow-hidden fixed inset-y-0 left-0 z-50 md:static ${
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
          style={{
            width: mobileSidebarOpen ? 260 : expanded ? 260 : 56,
            minWidth: mobileSidebarOpen ? 260 : expanded ? 260 : 56,
            background: "#0E0E0E",
            borderRight: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {/* Nav items */}
          <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-all duration-150"
                  style={{
                    background: active ? "rgba(124,92,252,0.12)" : "transparent",
                    color: active ? "#A78BFA" : "#555568",
                    justifyContent: isExpanded ? undefined : "center",
                    boxShadow: active ? "inset 2px 0 0 #7C5CFC" : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)";
                    if (!active) (e.currentTarget as HTMLAnchorElement).style.color = "#AAAACC";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                    if (!active) (e.currentTarget as HTMLAnchorElement).style.color = "#555568";
                  }}
                >
                  <NavIcon name={item.icon} />
                  {isExpanded && (
                    <span className="text-sm truncate font-medium">{item.label}</span>
                  )}
                </Link>
              );
            })}

          </nav>

          {/* Pinned artifacts */}
          {isExpanded && (
            <div
              className="shrink-0 px-2 py-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p
                className="text-[10px] uppercase tracking-widest px-2 mb-2"
                style={{ color: "#3D3D58" }}
              >
                Pinned
              </p>
              {pinnedArtifacts.length > 0 ? (
                <div className="space-y-0.5">
                  {pinnedArtifacts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="w-full flex items-center gap-2 py-1.5 rounded-lg px-2 transition-colors duration-100"
                      style={{ color: "#5A5A78" }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = "#C0C0D8";
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = "#5A5A78";
                        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: ARTIFACT_TYPE_COLORS[a.type] ?? "#6B6B80" }}
                      />
                      <span className="truncate text-xs">{a.title}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs px-2 italic" style={{ color: "#3D3D58" }}>
                  AI reports will appear here
                </p>
              )}
            </div>
          )}

          {/* User section */}
          <div
            className="shrink-0 p-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center w-full rounded-xl px-2 py-2 transition-colors duration-150"
                style={{
                  gap: isExpanded ? "10px" : "0",
                  justifyContent: isExpanded ? undefined : "center",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
                  style={{
                    background: "rgba(124,92,252,0.18)",
                    color: "#C4B5FD",
                    border: "1px solid rgba(124,92,252,0.30)",
                  }}
                >
                  {user?.email?.[0]?.toUpperCase() ?? "?"}
                </div>
                {isExpanded && (
                  <span className="truncate text-xs" style={{ color: "#5A5A78" }}>
                    {user?.email ?? "Account"}
                  </span>
                )}
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" aria-hidden onClick={() => setUserMenuOpen(false)} />
                  <div
                    className="absolute bottom-full left-0 mb-2 py-1 z-20 rounded-xl overflow-hidden"
                    style={{
                      minWidth: "180px",
                      background: "#1A1A1A",
                      border: "1px solid rgba(255,255,255,0.09)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                    }}
                  >
                    <Link
                      href="/dashboard/settings"
                      className="block px-4 py-2 text-sm transition-colors duration-100"
                      style={{ color: "#9090AA" }}
                      onClick={() => setUserMenuOpen(false)}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#F0F0F8"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#9090AA"; }}
                    >
                      Settings
                    </Link>
                    <form
                      action={async () => {
                        await signOut();
                        window.location.reload();
                      }}
                    >
                      <button
                        type="submit"
                        className="w-full text-left px-4 py-2 text-sm transition-colors duration-100"
                        style={{ color: "#EF4444" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#FCA5A5"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
                      >
                        Log out
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Top bar with sync indicator */}
          <div
            className="shrink-0 flex items-center justify-between px-4 py-2 min-h-[44px]"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            {/* Mobile hamburger */}
            <button
              type="button"
              className="md:hidden p-1.5 rounded-lg"
              style={{ color: "#5A5A78" }}
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="hidden md:block" />

            <div className="flex items-center gap-2">
              {/* Mobile chat toggle */}
              <button
                type="button"
                className="md:hidden p-1.5 rounded-lg"
                style={{ color: "#A78BFA", background: "rgba(124,92,252,0.12)" }}
                onClick={() => setMobileChatOpen(true)}
                aria-label="Open AI chat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </button>
              {/* Sync indicator in the top bar */}
              <SyncIndicator />
            </div>
          </div>

          {/* Goal bar */}
          <GoalBar />

          {/* Page content */}
          <main className="flex-1 overflow-auto relative">
            {children}
          </main>
        </div>

        {/* Persistent AI chat panel — sidebar on desktop, overlay on mobile */}
        <div className="hidden md:flex" style={{ width: "40vw", minWidth: "40vw" }}>
          <ChatSidebar />
        </div>
        {mobileChatOpen && (
          <>
            <div
              className="fixed inset-0 z-50 md:hidden"
              style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={() => setMobileChatOpen(false)}
              aria-hidden
            />
            <div className="fixed inset-0 z-50 md:hidden">
              <ChatSidebar onClose={() => setMobileChatOpen(false)} />
            </div>
          </>
        )}
      </div>
    </UserGoalProvider>
  );
}
