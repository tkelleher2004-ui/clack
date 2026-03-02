"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/auth/actions";

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
  { href: "/dashboard/overview", label: "Overview", icon: "grid" },
  { href: "/dashboard/accounts", label: "Accounts", icon: "link" },
  { href: "/dashboard/marketing-plan", label: "Marketing Plan", icon: "document" },
  { href: "/dashboard/clips", label: "Clips", icon: "film" },
  { href: "/dashboard/chat", label: "AI Chat", icon: "sparkle", showDot: true },
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
  if (name === "document")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  if (name === "film")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
      </svg>
    );
  if (name === "sparkle")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
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
}

export function DashboardLayoutClient({
  children,
  pinnedArtifacts,
}: DashboardLayoutClientProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user: u } }) => setUser(u ?? null));
  }, []);

  const isActive = (href: string) => {
    if (href === "/dashboard/overview") return pathname === "/dashboard/overview";
    if (href === "/dashboard/chat") return pathname === "/dashboard" || pathname === "/dashboard/chat";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const isExpanded = expanded || sidebarOpen;

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#0A0A0A" }}
    >
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={`flex flex-col shrink-0 transition-all duration-200 overflow-hidden fixed inset-y-0 left-0 z-50 md:static ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{
          width: sidebarOpen ? 260 : expanded ? 260 : 56,
          minWidth: sidebarOpen ? 260 : expanded ? 260 : 56,
          background: "rgba(12, 12, 20, 0.75)",
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
          borderRight: "1px solid rgba(255, 255, 255, 0.06)",
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
                  background: active ? "rgba(255,255,255,0.10)" : "transparent",
                  color: active ? "#E8E8F0" : "#6B6B80",
                  justifyContent: isExpanded ? undefined : "center",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)";
                  if (!active) (e.currentTarget as HTMLAnchorElement).style.color = "#9898B0";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  if (!active) (e.currentTarget as HTMLAnchorElement).style.color = "#6B6B80";
                }}
              >
                <span className="relative shrink-0 flex items-center justify-center">
                  <NavIcon name={item.icon} />
                  {item.showDot && (
                    <span
                      className="absolute -right-1 -top-1 w-2 h-2 rounded-full"
                      style={{ background: "#7C5CFC", boxShadow: "0 0 6px rgba(124,92,252,0.8)" }}
                    />
                  )}
                </span>
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
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p
              className="text-[10px] uppercase tracking-widest px-2 mb-2"
              style={{ color: "#6B6B80" }}
            >
              Pinned
            </p>
            {pinnedArtifacts.length > 0 ? (
              <div className="space-y-0.5">
                {pinnedArtifacts.map((a) => (
                  <Link
                    key={a.id}
                    href={`/dashboard/chat?artifact=${a.id}`}
                    className="flex items-center gap-2 py-1.5 rounded-lg px-2 transition-colors duration-100"
                    style={{ color: "#6B6B80" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.color = "#9898B0";
                      (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.color = "#6B6B80";
                      (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: ARTIFACT_TYPE_COLORS[a.type] ?? "#6B6B80" }}
                    />
                    <span className="truncate text-xs">{a.title}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs px-2 italic" style={{ color: "#6B6B80" }}>
                AI reports will appear here
              </p>
            )}
          </div>
        )}

        {/* User section */}
        <div
          className="shrink-0 p-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
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
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "#9898B0",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                {user?.email?.[0]?.toUpperCase() ?? "?"}
              </div>
              {isExpanded && (
                <span className="truncate text-xs" style={{ color: "#6B6B80" }}>
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
                    background: "rgba(18, 18, 28, 0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    backdropFilter: "blur(12px) saturate(180%)",
                    WebkitBackdropFilter: "blur(12px) saturate(180%)",
                  }}
                >
                  <Link
                    href="/dashboard/settings"
                    className="block px-4 py-2 text-sm transition-colors duration-100"
                    style={{ color: "#9898B0" }}
                    onClick={() => setUserMenuOpen(false)}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#E8E8F0"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#9898B0"; }}
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
                      style={{ color: "#E57373" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EF9A9A"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#E57373"; }}
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

      {/* Main content */}
      <main className="flex-1 overflow-auto relative">
        {/* Mobile hamburger — only on non-chat pages */}
        {pathname !== "/dashboard/chat" && pathname !== "/dashboard" && (
          <button
            type="button"
            className="md:hidden fixed top-4 left-4 z-30 p-2 rounded-lg transition-colors"
            style={{ color: "#6B6B80" }}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        {children}
      </main>
    </div>
  );
}
