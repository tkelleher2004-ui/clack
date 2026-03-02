import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard-data";
import { OverviewClient, type GoalProgress } from "./OverviewClient";

// Timeframe → total days
const TIMEFRAME_DAYS: Record<string, number> = {
  "1_month": 30,
  "3_months": 90,
  "6_months": 180,
  "1_year": 365,
  none: 90,
};

/** Parse a number like "10k", "10,000", "1M", "500" from free text. */
function parseTargetNumber(text: string): number | null {
  const m = text.match(/\b(\d[\d,]*\.?\d*)\s*([kKmM])?\b/);
  if (!m) return null;
  const base = parseFloat(m[1].replace(/,/g, ""));
  if (m[2]?.toLowerCase() === "k") return base * 1_000;
  if (m[2]?.toLowerCase() === "m") return base * 1_000_000;
  return base;
}

export default async function OverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const dashboardData = await getDashboardData(user.id);
  const profile = dashboardData.profile;

  const goalsRaw = profile?.goals_raw ?? null;
  const goalsTimeframe = profile?.goals_timeframe ?? null;
  const hasConnectedAccounts = dashboardData.accounts.length > 0;

  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim();
  const firstName = fullName?.split(/\s+/)[0];
  const displayFirstName = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1)
    : "";

  // ── Compute goal progress from real data ───────────────────────────────────
  let goalProgress: GoalProgress | null = null;

  if (goalsRaw && dashboardData.accounts.length > 0) {
    const raw = goalsRaw.toLowerCase();

    // Detect goal metric
    const isFollowers = /follower|subscriber|fan/i.test(raw);
    const isViews = /view|watch|impression/i.test(raw);

    // Detect platform
    const platform =
      /instagram/i.test(raw) ? "instagram" :
      /tiktok/i.test(raw)    ? "tiktok" :
      /youtube/i.test(raw)   ? "youtube" :
      /linkedin/i.test(raw)  ? "linkedin" :
      null;

    const targetValue = parseTargetNumber(goalsRaw);

    if (targetValue && (isFollowers || isViews)) {
      const account = platform
        ? dashboardData.accounts.find((a) => a.platform === platform)
        : dashboardData.accounts[0];

      if (account) {
        // Current value
        const currentValue = isFollowers
          ? (account.follower_count ?? 0)
          : dashboardData.stats.totalViews;

        // Audience data history for daily tracking (followers only)
        let gainedToday = 0;
        let sevenDayAvg = 0;

        if (isFollowers) {
          const { data: audienceHistory } = await supabase
            .from("audience_data")
            .select("follower_count, fetched_at")
            .eq("social_account_id", account.id)
            .order("fetched_at", { ascending: false })
            .limit(10);

          if (audienceHistory && audienceHistory.length > 0) {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const todaySnapshot = audienceHistory.find(
              (d) => new Date(d.fetched_at) >= todayStart
            );
            const yesterdaySnapshot = audienceHistory.find(
              (d) => new Date(d.fetched_at) < todayStart
            );

            if (todaySnapshot && yesterdaySnapshot) {
              gainedToday = (todaySnapshot.follower_count ?? 0) - (yesterdaySnapshot.follower_count ?? 0);
            }

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const weekAgoSnapshot = audienceHistory.find(
              (d) => new Date(d.fetched_at) <= sevenDaysAgo
            );
            if (weekAgoSnapshot) {
              sevenDayAvg = Math.round(
                (currentValue - (weekAgoSnapshot.follower_count ?? 0)) / 7
              );
            }
          }
        }

        // Days left
        const totalDays = TIMEFRAME_DAYS[goalsTimeframe ?? "none"] ?? 90;
        const goalsUpdatedAt = profile?.goals_updated_at as string | null | undefined;
        const daysElapsed = goalsUpdatedAt
          ? Math.floor((Date.now() - new Date(goalsUpdatedAt).getTime()) / 86_400_000)
          : 0;
        const daysLeft = Math.max(0, totalDays - daysElapsed);

        // Daily needed to hit goal
        const remaining = Math.max(0, targetValue - currentValue);
        const dailyNeeded = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : 0;

        // Human-readable target
        const targetLabel =
          targetValue >= 1_000_000
            ? `${(targetValue / 1_000_000).toFixed(1)}M`
            : targetValue >= 1_000
            ? `${Math.round(targetValue / 1_000)}K`
            : String(targetValue);

        const platformLabel = account.account_name
          ? account.account_name
          : (account.platform ?? "").charAt(0).toUpperCase() + (account.platform ?? "").slice(1);

        goalProgress = {
          statement: `Grow ${platformLabel} to ${targetLabel} ${isFollowers ? "followers" : "views"}`,
          currentValue,
          goalValue: targetValue,
          unit: isFollowers ? "followers" : "views",
          gainedToday,
          sevenDayAvg,
          dailyNeeded,
          daysLeft,
        };
      }
    }
  }

  return (
    <OverviewClient
      dashboardData={{
        hasData: dashboardData.hasData,
        stats: dashboardData.stats,
        chartData: dashboardData.chartData,
        topContent: dashboardData.topContent,
        recentActivity: dashboardData.recentActivity,
        annotations: dashboardData.annotations,
      }}
      firstName={displayFirstName}
      goalsRaw={goalsRaw}
      goalsTimeframe={goalsTimeframe}
      hasConnectedAccounts={hasConnectedAccounts}
      goalProgress={goalProgress}
    />
  );
}
