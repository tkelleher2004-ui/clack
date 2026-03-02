"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageTransition } from "@/components/ui";
import { PlatformIcon } from "@/components/social/PlatformIcon";
import { createClient } from "@/lib/supabase/client";
import type { SocialPlatform, SocialAccount } from "@/lib/types/social";
import { PLATFORM_CONFIG } from "@/lib/types/social";
import { toast } from "sonner";

const PLATFORMS: SocialPlatform[] = ["instagram", "tiktok", "youtube", "linkedin", "twitter"];
const CONNECTABLE_PLATFORMS: SocialPlatform[] = ["instagram", "tiktok"];

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "Authentication was cancelled or failed. Please try again.",
  token_exchange: "Failed to authenticate. Please try again.",
  long_lived_token: "Failed to get a long-term connection. Please try again.",
  no_pages:
    "No Facebook Page found. You need a Facebook Page linked to an Instagram Business or Creator account.",
  no_ig_business:
    "No Instagram Business account found. Make sure your Instagram is set up as a Business or Creator account and linked to a Facebook Page.",
  save_failed: "Connected successfully but failed to save. Please try again.",
  invalid_state: "Session expired. Please try again.",
  config: "OAuth is not configured. Please contact support.",
  unknown: "Something went wrong. Please try again.",
};

const PLATFORM_META: Record<SocialPlatform, { gradient: string; description: string }> = {
  instagram: {
    gradient: "linear-gradient(135deg, #833AB4 0%, #E1306C 50%, #F77737 100%)",
    description: "Posts, Reels, Stories, audience insights",
  },
  tiktok: {
    gradient: "linear-gradient(135deg, #010101 0%, #69C9D0 100%)",
    description: "Videos, analytics, audience data",
  },
  youtube: {
    gradient: "linear-gradient(135deg, #FF0000 0%, #CC0000 100%)",
    description: "Videos, Shorts, channel analytics",
  },
  linkedin: {
    gradient: "linear-gradient(135deg, #0A66C2 0%, #0077B5 100%)",
    description: "Posts, articles, engagement",
  },
  twitter: {
    gradient: "linear-gradient(135deg, #1DA1F2 0%, #0d8ddb 100%)",
    description: "Tweets, spaces, analytics",
  },
  facebook: {
    gradient: "linear-gradient(135deg, #1877F2 0%, #0d65d9 100%)",
    description: "Pages, posts, insights",
  },
};

function formatFollowerCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatLastSynced(iso: string | null): string {
  if (!iso) return "Never synced";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3600_000);
  const diffDays = Math.floor(diffMs / 86400_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `Synced ${diffMins}m ago`;
  if (diffHours < 24) return `Synced ${diffHours}h ago`;
  if (diffDays < 7) return `Synced ${diffDays}d ago`;
  return `Synced ${d.toLocaleDateString()}`;
}

function getAccountDisplay(account: SocialAccount) {
  const username = account.username ?? account.account_name ?? "Unknown";
  const avatar =
    account.account_data?.profile_picture_url ??
    account.account_data?.avatar_url ??
    account.account_avatar_url ??
    null;
  const followers =
    account.account_data?.followers_count ?? account.follower_count ?? 0;
  const videoCount = account.account_data?.video_count ?? 0;
  const lastSynced = account.last_synced_at ?? null;
  return { username, avatar, followers, videoCount, lastSynced };
}

function InstagramSVG() {
  return (
    <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function ConnectedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{
        background: "rgba(129, 199, 132, 0.12)",
        color: "#81C784",
        border: "1px solid rgba(129, 199, 132, 0.2)",
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      Connected
    </span>
  );
}

function AccountsPageContent() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [disconnecting, setDisconnecting] = useState<Record<string, boolean>>({});
  const searchParams = useSearchParams();
  const supabase = createClient();

  const success = searchParams.get("success");
  const error = searchParams.get("error");

  useEffect(() => {
    if (success === "instagram") {
      toast.success("Instagram connected! Syncing your data...");
      window.history.replaceState({}, "", "/dashboard/accounts");
      router.replace("/dashboard/chat?welcome=instagram");
    }
    if (success === "tiktok") {
      toast.success("TikTok connected!");
      window.history.replaceState({}, "", "/dashboard/accounts");
    }
    if (error) {
      toast.error(ERROR_MESSAGES[error] ?? ERROR_MESSAGES.unknown);
      window.history.replaceState({}, "", "/dashboard/accounts");
    }
  }, [success, error, router]);

  const fetchAccounts = async () => {
    const { data, error } = await supabase
      .from("social_accounts")
      .select("id, user_id, platform, platform_account_id, username, account_data, last_synced_at, created_at, updated_at")
      .order("platform");
    if (error) {
      toast.error("Failed to load accounts");
      return;
    }
    setAccounts((data ?? []) as SocialAccount[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
    const channel = supabase
      .channel("social_accounts")
      .on("postgres_changes", { event: "*", schema: "public", table: "social_accounts" }, () => {
        fetchAccounts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleConnect = (platform: SocialPlatform) => {
    if (!CONNECTABLE_PLATFORMS.includes(platform)) return;
    window.location.href = `/api/auth/${platform}/connect`;
  };

  const handleDisconnect = async (accountId: string, platform: SocialPlatform) => {
    setDisconnecting((p) => ({ ...p, [accountId]: true }));
    const { error: err } = await supabase.from("social_accounts").delete().eq("id", accountId);
    setDisconnecting((p) => ({ ...p, [accountId]: false }));
    if (err) { toast.error("Failed to disconnect"); return; }
    toast.success(`${PLATFORM_CONFIG[platform].name} disconnected`);
    fetchAccounts();
  };

  const handleSyncNow = async (accountId: string, platform: SocialPlatform) => {
    const endpoint =
      platform === "instagram"
        ? "/api/instagram/sync"
        : platform === "tiktok"
          ? "/api/tiktok/sync"
          : null;
    if (!endpoint) return;
    setSyncing((p) => ({ ...p, [accountId]: true }));
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ social_account_id: accountId }),
    });
    setSyncing((p) => ({ ...p, [accountId]: false }));
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error((data as { error?: string }).error ?? "Sync failed");
      return;
    }
    toast.success("Sync completed");
    fetchAccounts();
    if (platform === "instagram") {
      router.push("/dashboard/chat?welcome=instagram");
    }
  };

  const getAccountForPlatform = (platform: SocialPlatform) =>
    accounts.find((a) => a.platform === platform);

  return (
    <PageTransition>
      <div className="min-h-full p-6 md:p-10">
        <div className="max-w-xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <h1
              className="text-2xl font-semibold tracking-tight mb-1.5"
              style={{ color: "#E8E8F0" }}
            >
              Connect your accounts
            </h1>
            <p className="text-sm" style={{ color: "#6B6B80" }}>
              Link your social platforms so your AI strategist can analyze your content and audience.
            </p>
          </div>

          {/* Alert banners */}
          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-xl text-sm"
              style={{
                background: "rgba(229, 115, 115, 0.08)",
                border: "1px solid rgba(229, 115, 115, 0.2)",
                color: "#E57373",
              }}
            >
              {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.unknown}
            </div>
          )}

          {/* Platform cards */}
          <div className="flex flex-col gap-3">
            {PLATFORMS.map((platform) => {
              const account = getAccountForPlatform(platform);
              const connected = !!account;
              const canConnect = CONNECTABLE_PLATFORMS.includes(platform);
              const display = account ? getAccountDisplay(account) : null;
              const meta = PLATFORM_META[platform];

              return (
                <div
                  key={platform}
                  className="group flex items-center gap-4 p-4 rounded-2xl transition-all duration-200"
                  style={{
                    background: "rgba(255, 255, 255, 0.04)",
                    border: connected
                      ? "1px solid rgba(255, 255, 255, 0.12)"
                      : "1px solid rgba(255, 255, 255, 0.07)",
                  }}
                >
                  {/* Platform icon */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: meta.gradient,
                      boxShadow: connected
                        ? `0 4px 16px rgba(0,0,0,0.3)`
                        : "0 2px 8px rgba(0,0,0,0.25)",
                    }}
                  >
                    {platform === "instagram" ? (
                      <InstagramSVG />
                    ) : (
                      <PlatformIcon platform={platform} color="white" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="text-sm font-medium"
                        style={{ color: "#E8E8F0" }}
                      >
                        {PLATFORM_CONFIG[platform].name}
                      </span>
                      {connected && <ConnectedBadge />}
                    </div>

                    {connected && display ? (
                      <div className="flex flex-col gap-0.5">
                        <p className="text-xs" style={{ color: "#9898B0" }}>
                          @{display.username}
                          {display.followers > 0 && (
                            <span style={{ color: "#6B6B80" }}>
                              {" · "}{formatFollowerCount(display.followers)} followers
                            </span>
                          )}
                          {platform === "tiktok" && display.videoCount > 0 && (
                            <span style={{ color: "#6B6B80" }}>
                              {" · "}{formatFollowerCount(display.videoCount)} videos
                            </span>
                          )}
                        </p>
                        <p className="text-[11px]" style={{ color: "#6B6B80" }}>
                          {formatLastSynced(display.lastSynced)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: "#6B6B80" }}>
                        {meta.description}
                      </p>
                    )}
                  </div>

                  {/* Action */}
                  <div className="shrink-0">
                    {canConnect ? (
                      connected ? (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleSyncNow(account!.id, platform)}
                            disabled={syncing[account!.id]}
                            className="text-xs transition-colors duration-150"
                            style={{ color: "#6B6B80" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9898B0"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#6B6B80"; }}
                          >
                            {syncing[account!.id] ? "Syncing…" : "Sync"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDisconnect(account!.id, platform)}
                            disabled={disconnecting[account!.id]}
                            className="text-xs transition-colors duration-150"
                            style={{ color: "rgba(229,115,115,0.5)" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#E57373"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(229,115,115,0.5)"; }}
                          >
                            {disconnecting[account!.id] ? "Removing…" : "Disconnect"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConnect(platform)}
                          className="px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-150"
                          style={{
                            background: "#7C5CFC",
                            color: "#fff",
                            boxShadow: "0 2px 12px rgba(124,92,252,0.35)",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "#8B6DFD";
                            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(124,92,252,0.5)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "#7C5CFC";
                            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 12px rgba(124,92,252,0.35)";
                          }}
                        >
                          Connect
                        </button>
                      )
                    ) : (
                      <span
                        className="text-xs px-3 py-1.5 rounded-xl"
                        style={{
                          color: "#6B6B80",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        Coming soon
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer hint */}
          <p className="mt-6 text-center text-xs" style={{ color: "#6B6B80" }}>
            More platforms coming soon. Connect Instagram to get started.
          </p>
        </div>
      </div>
    </PageTransition>
  );
}

export default function AccountsPage() {
  return (
    <Suspense
      fallback={
        <PageTransition>
          <div className="min-h-full p-6 md:p-10">
            <div className="max-w-xl mx-auto">
              <div className="mb-8">
                <div className="h-7 w-48 rounded-lg mb-2" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="h-4 w-72 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }} />
              </div>
              <div className="flex flex-col gap-3">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-[72px] rounded-2xl animate-pulse"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                  />
                ))}
              </div>
            </div>
          </div>
        </PageTransition>
      }
    >
      <AccountsPageContent />
    </Suspense>
  );
}
