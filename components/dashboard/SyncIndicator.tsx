"use client";

import { useEffect, useState } from "react";

export interface SyncDelta {
  followersGained: number;
  topPostViews: number;
  topPostCaption: string;
  accountsCount: number;
}

interface SyncIndicatorProps {
  onSyncComplete?: (delta: SyncDelta | null) => void;
}

export function SyncIndicator({ onSyncComplete }: SyncIndicatorProps) {
  const [status, setStatus] = useState<"idle" | "checking" | "syncing" | "done">("idle");
  const [notification, setNotification] = useState<{
    message: string;
  } | null>(null);

  useEffect(() => {
    const sessionKey = "clack_synced_session";
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(sessionKey)) {
      return;
    }

    let cancelled = false;

    async function runSync() {
      setStatus("checking");

      let accounts: Array<{
        id: string;
        platform: string;
        username: string;
        lastSyncedAt: string | null;
        currentFollowers: number;
      }> = [];

      try {
        const res = await fetch("/api/sync/auto");
        if (!res.ok) return;
        const data = await res.json() as { accounts: typeof accounts };
        accounts = data.accounts ?? [];
      } catch {
        setStatus("idle");
        return;
      }

      if (cancelled) return;

      // Only sync accounts that haven't been synced in the last 6 hours
      const sixHoursAgo = Date.now() - 6 * 3_600_000;
      const staleAccounts = accounts.filter(
        (a) =>
          (a.platform === "tiktok" || a.platform === "instagram") &&
          a.username &&
          (!a.lastSyncedAt || new Date(a.lastSyncedAt).getTime() < sixHoursAgo)
      );

      if (staleAccounts.length === 0) {
        sessionStorage.setItem(sessionKey, "1");
        setStatus("idle");
        return;
      }

      setStatus("syncing");

      // Store baseline follower counts
      const baseline: Record<string, number> = {};
      for (const a of staleAccounts) {
        baseline[a.id] = a.currentFollowers;
      }

      // Fire sync requests for each account in parallel
      const syncResults = await Promise.allSettled(
        staleAccounts.map((a) =>
          fetch("/api/apify/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform: a.platform, username: a.username }),
          }).then((r) => r.json())
        )
      );

      if (cancelled) return;

      // Compute delta
      let totalFollowersGained = 0;
      let topPostViews = 0;
      let topPostCaption = "";

      for (let i = 0; i < syncResults.length; i++) {
        const result = syncResults[i];
        if (result.status === "fulfilled") {
          const data = result.value as { followers?: number; posts?: number; ok?: boolean };
          if (data.ok && data.followers !== undefined) {
            const gained = (data.followers ?? 0) - (baseline[staleAccounts[i].id] ?? 0);
            if (gained > 0) totalFollowersGained += gained;
          }
        }
      }

      // Get top post from last 7 days
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: topPost } = await supabase
          .from("social_posts")
          .select("caption, metrics")
          .gte("posted_at", sevenDaysAgo.toISOString())
          .order("metrics->views", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (topPost) {
          const m = (topPost.metrics ?? {}) as Record<string, number>;
          topPostViews = m.views ?? m.play_count ?? m.impressions ?? 0;
          topPostCaption = (topPost.caption ?? "").slice(0, 40);
        }
      } catch {
        // ignore
      }

      const delta: SyncDelta = {
        followersGained: totalFollowersGained,
        topPostViews,
        topPostCaption,
        accountsCount: staleAccounts.length,
      };

      // Build notification message
      let msg = "Sync complete.";
      if (delta.followersGained > 0) {
        msg += ` You gained ${delta.followersGained} follower${delta.followersGained === 1 ? "" : "s"}.`;
      }
      if (delta.topPostViews > 1000) {
        const fmt = (n: number) =>
          n >= 1_000_000
            ? `${(n / 1_000_000).toFixed(1)}M`
            : n >= 1_000
              ? `${(n / 1_000).toFixed(1)}K`
              : n.toLocaleString();
        msg += ` Your top post this week hit ${fmt(delta.topPostViews)} views.`;
      }

      sessionStorage.setItem(sessionKey, "1");
      setStatus("done");
      setNotification({ message: msg });

      onSyncComplete?.(delta);

      // Generate briefing after sync
      fetch("/api/briefing", { method: "POST" }).catch(() => {});

      // Auto-dismiss notification after 8 seconds
      setTimeout(() => {
        if (!cancelled) setNotification(null);
      }, 8000);
    }

    runSync().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "idle" && !notification) return null;

  return (
    <>
      {/* Syncing pill */}
      {status === "syncing" && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] transition-all"
          style={{
            background: "rgba(124,92,252,0.15)",
            border: "1px solid rgba(124,92,252,0.32)",
            color: "#C4B5FD",
          }}
        >
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: "#7C5CFC" }}
          />
          Syncing your latest data...
        </div>
      )}

      {/* Completion toast */}
      {notification && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[12px] cursor-pointer transition-all"
          style={{
            background: "rgba(16,185,129,0.10)",
            border: "1px solid rgba(16,185,129,0.25)",
            color: "#9090AA",
            maxWidth: "380px",
          }}
          onClick={() => setNotification(null)}
        >
          <span style={{ color: "#10B981", fontSize: "14px" }}>✓</span>
          <span style={{ color: "#9090AA" }}>{notification.message}</span>
          <button
            type="button"
            className="ml-auto opacity-50 hover:opacity-100 transition-opacity text-[11px]"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
