import { createClient } from "@/lib/supabase/server";

export async function getDashboardData(userId: string) {
  const supabase = await createClient();

  // Get connected accounts
  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("user_id", userId);

  // Get all posts
  const { data: posts } = await supabase
    .from("social_posts")
    .select("*")
    .eq("user_id", userId)
    .order("posted_at", { ascending: false });

  // Get latest analysis artifact
  const { data: latestAnalysis } = await supabase
    .from("ai_artifacts")
    .select("*")
    .eq("user_id", userId)
    .eq("type", "deep_dive")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get pinned artifacts
  const { data: pinnedArtifacts } = await supabase
    .from("ai_artifacts")
    .select("id, type, title, pinned, created_at")
    .eq("user_id", userId)
    .eq("pinned", true)
    .order("created_at", { ascending: false })
    .limit(7);

  // Get recent activity
  const { data: recentActivity } = await supabase
    .from("activity_log")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  // Get user profile with goals (brand_profiles)
  const { data: profile } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // Get clips count
  const { count: clipsCount } = await supabase
    .from("clips")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  // Calculate stats
  const hasData = (posts?.length ?? 0) > 0;

  let stats = {
    totalViews: 0,
    totalEngagements: 0,
    clipsCreated: clipsCount ?? 0,
    avgVirality: 0,
  };

  if (hasData && posts) {
    stats.totalViews = posts.reduce(
      (sum, p) =>
        sum +
        ((p.metrics as Record<string, number>)?.views ??
          (p.metrics as Record<string, number>)?.impressions ??
          (p.metrics as Record<string, number>)?.reach ??
          0),
      0
    );
    stats.totalEngagements = posts.reduce(
      (sum, p) =>
        sum +
        ((p.metrics as Record<string, number>)?.likes ?? 0) +
        ((p.metrics as Record<string, number>)?.comments ?? 0),
      0
    );

    // Avg virality from AI analysis
    const postsWithScores = posts.filter(
      (p) => (p.ai_analysis as Record<string, number>)?.virality_score != null
    );
    if (postsWithScores.length > 0) {
      stats.avgVirality =
        postsWithScores.reduce(
          (sum, p) =>
            sum + ((p.ai_analysis as Record<string, number>)?.virality_score ?? 0),
          0
        ) / postsWithScores.length;
    }
  }

  // Calculate daily metrics for chart (last 7 days)
  const chartData: { day: string; value: number; date: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });

    const dayPosts =
      posts?.filter(
        (p) => p.posted_at && String(p.posted_at).startsWith(dateStr)
      ) ?? [];

    const dayEngagement = dayPosts.reduce(
      (sum, p) =>
        sum +
        ((p.metrics as Record<string, number>)?.likes ?? 0) +
        ((p.metrics as Record<string, number>)?.comments ?? 0),
      0
    );

    chartData.push({ day: dayName, value: dayEngagement, date: dateStr });
  }

  // Top content (top 4 by engagement)
  const topContent =
    posts
      ?.map((p) => ({
        ...p,
        totalEngagement:
          ((p.metrics as Record<string, number>)?.likes ?? 0) +
          ((p.metrics as Record<string, number>)?.comments ?? 0),
      }))
      .sort((a, b) => b.totalEngagement - a.totalEngagement)
      .slice(0, 4) ?? [];

  // AI annotations from latest analysis
  const annotations: Record<string, string> = {};
  if (latestAnalysis?.data) {
    const data = latestAnalysis.data as Record<string, unknown>;
    annotations.goals = (data.growth_prediction as string) ?? "";
    annotations.stats = (data.summary as string) ?? "";
    const bestTimes = data.best_posting_times as Array<{ day?: string; time?: string }> | undefined;
    annotations.chart =
      bestTimes?.[0]?.day && bestTimes?.[0]?.time
        ? `Best time to post: ${bestTimes[0].day} at ${bestTimes[0].time}`
        : "";
    const contentGaps = data.content_gaps as Array<{ gap?: string }> | undefined;
    annotations.content = contentGaps?.[0]?.gap
      ? `Content gap: ${contentGaps[0].gap}`
      : "";
  }

  return {
    hasData,
    accounts: accounts ?? [],
    stats,
    chartData,
    topContent,
    recentActivity: recentActivity ?? [],
    pinnedArtifacts: pinnedArtifacts ?? [],
    profile,
    annotations,
    latestAnalysis: (latestAnalysis?.data as Record<string, unknown>) ?? null,
  };
}

/** Lightweight fetch for sidebar pinned artifacts only */
export async function getPinnedArtifacts(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_artifacts")
    .select("id, type, title, pinned, created_at")
    .eq("user_id", userId)
    .eq("pinned", true)
    .order("created_at", { ascending: false })
    .limit(7);
  return data ?? [];
}
