"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassSidebar } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/auth/actions";

const NAV_ITEMS = [
  { href: "/dashboard/overview", label: "Overview", icon: <GridIcon /> },
  { href: "/dashboard/accounts", label: "Accounts", icon: <LinkIcon /> },
  { href: "/dashboard/marketing-plan", label: "Marketing Plan", icon: <DocumentIcon /> },
  { href: "/dashboard/clips", label: "Clips", icon: <FilmIcon /> },
  { href: "/dashboard/chat", label: "AI Chat", icon: <SparkleIcon />, showDot: true },
  { href: "/dashboard/settings", label: "Settings", icon: <GearIcon /> },
];

const ARTIFACT_TYPE_COLORS: Record<string, string> = {
  deep_dive: "#7C5CFC",
  weekly_plan: "#06B6D4",
  video_breakdown: "#F59E0B",
  content_gap_report: "#10B981",
  growth_roadmap: "#A78BFA",
  daily_briefing: "#F472B6",
};

export interface PinnedArtifact {
  id: string;
  type: string;
  title: string;
  pinned?: boolean;
  created_at?: string;
}

function GridIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function FilmIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function getFirstName(user: { user_metadata?: { full_name?: string }; email?: string } | null): string {
  if (!user) return "";
  const fullName = user.user_metadata?.full_name as string | undefined;
  if (fullName?.trim()) {
    const first = fullName.trim().split(/\s+/)[0];
    return first ? first.charAt(0).toUpperCase() + first.slice(1) : "";
  }
  const part = user.email?.split("@")[0];
  return part ? part.charAt(0).toUpperCase() + part.slice(1) : "";
}

export interface DashboardSidebarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  pinnedArtifacts?: PinnedArtifact[];
  onExpandedChange?: (expanded: boolean) => void;
}

export function DashboardSidebar({
  onNavigate,
  collapsed = true,
  onCollapsedChange,
  pinnedArtifacts = [],
  onExpandedChange,
}: DashboardSidebarProps = {}) {
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string; user_metadata?: { full_name?: string }; id: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user: u } }) => setUser(u ?? null));
  }, []);

  const pinnedItems = pinnedArtifacts.map((a) => ({
    color: ARTIFACT_TYPE_COLORS[a.type] ?? "#6B6B80",
    title: a.title,
    href: `/dashboard/chat?artifact=${a.id}`,
  }));

  const firstName = getFirstName(user);
  const displayName = firstName || user?.email?.split("@")[0] || "?";

  return (
    <GlassSidebar
      items={NAV_ITEMS}
      pinnedItems={pinnedItems}
      collapsed={collapsed ?? true}
      onToggle={onCollapsedChange ? () => onCollapsedChange(!collapsed) : undefined}
      onLinkClick={onNavigate}
      expandOnHover={true}
      onExpandedChange={onExpandedChange}
      footer={(expanded) => (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 w-full px-2 py-2 text-left transition-all duration-150 rounded-lg hover:bg-white/[0.04]"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
              style={{ background: "#1E1E22", color: "#A1A1AA" }}
            >
              {displayName[0]?.toUpperCase() ?? "?"}
            </div>
            {expanded && (
              <span className="truncate text-[11px] text-zinc-600">{user?.email ?? "Account"}</span>
            )}
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setMenuOpen(false)} />
              <div
                className="absolute bottom-full left-0 mb-2 py-1 z-20 rounded-xl"
                style={{
                  minWidth: "180px",
                  background: "#141416",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                }}
              >
                <Link
                  href="/dashboard/settings"
                  className="block px-4 py-2 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  Settings
                </Link>
                <form
                  action={async () => {
                    await signOut();
                    router.refresh();
                  }}
                >
                  <button
                    type="submit"
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    Log out
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    />
  );
}
