import { createClient } from "@/lib/supabase/server";

/** Shared type for dashboard data returned by getDashboardData */
export interface DashboardData {
  connectedAccounts: Array<{
    id: string;
    platform: string;
    username: string;
    followerCount: number;
    lastSynced: string;
  }>;

  stats: {
    totalViews: number;
    totalEngagements: number;
    totalPosts: number;
    avgVirality: number;
  };

  trends: {
    viewsTrend: number;
    engagementsTrend: number;
  };

  chartData: Array<{
    date: string;
    views: number;
    engagements: number;
  }>;

  chartData30D: Array<{
    date: string;
    views: number;
    engagements: number;
  }>;

  topPosts: Array<{
    id: string;
    caption: string;
    contentType: string;
    thumbnailUrl: string;
    engagement: number;
    views: number;
    viralityScore: number | null;
    permalink: string;
  }>;

  latestAnalysis: unknown | null;

  goals: {
    raw: string | null;
    timeframe: string | null;
    structured: unknown | null;
  };

  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
}

type DbSocialAccount = {
  id: string;
  platform: string;
  username: string | null;
  display_name?: string | null;
  account_data?: Record<string, unknown> | null;
  last_synced_at: string | null;
};

type DbSocialPost = {
  id: string;
  caption: string | null;
  content_type?: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  posted_at?: string | null;
  metrics?: Record<string, number> | null;
  ai_analysis?: Record<string, unknown> | null;
};

function getPostDate(p: DbSocialPost): string | null {
  const ts = p.posted_at;
  if (!ts) return null;
  return String(ts).split("T")[0];
}

function getViews(m: Record<string, number> | null | undefined): number {
  if (!m) return 0;
  return m.views ?? m.impressions ?? m.reach ?? 0;
}

function getEngagement(m: Record<string, number> | null | undefined): number {
  if (!m) return 0;
  return (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0);
}

function getVirality(a: Record<string, unknown> | null | undefined): number | null {
  if (!a) return null;
  const v = a.virality_score;
  return typeof v === "number" ? v : null;
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createClient();

  const { data: accounts, error: accountsError } = await supabase
    .from("social_accounts")
    .select("id, platform, username, display_name, account_data, last_synced_at")
    .eq("user_id", userId);

  console.log("[dashboard-data] social_accounts query:", {
    userId,
    count: accounts?.length ?? 0,
    error: accountsError?.message ?? null,
    accounts: accounts?.map((a) => ({ platform: a.platform, username: (a as { username?: string }).username, account_data_keys: (a as { account_data?: Record<string, unknown> }).account_data ? Object.keys((a as { account_data?: Record<string, unknown> }).account_data ?? {}) : [] })),
  });

  const { data: posts, error: postsError } = await supabase
    .from("social_posts")
    .select("id, caption, content_type, thumbnail_url, permalink, posted_at, metrics, ai_analysis")
    .eq("user_id", userId)
    .order("posted_at", { ascending: false });

  console.log("[dashboard-data] social_posts query:", {
    userId,
    count: posts?.length ?? 0,
    error: postsError?.message ?? null,
  });

  const { data: profile } = await supabase
    .from("brand_profiles")
    .select("goals_raw, goals_timeframe, goals_structured")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: latestAnalysis } = await supabase
    .from("ai_artifacts")
    .select("data")
    .eq("user_id", userId)
    .eq("type", "deep_dive")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: recentActivity } = await supabase
    .from("activity_log")
    .select("type, description, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  const dbAccounts = (accounts ?? []) as DbSocialAccount[];
  const dbPosts = (posts ?? []) as DbSocialPost[];

  const connectedAccounts = dbAccounts.map((a) => {
    const ad = (a.account_data ?? {}) as Record<string, number>;
    const followerCount = ad.followers_count ?? ad.follower_count ?? 0;
    return {
      id: a.id,
      platform: a.platform,
      username: a.username ?? a.display_name ?? "",
      followerCount,
      lastSynced: a.last_synced_at ?? "",
    };
  });

  let totalViews = 0;
  let totalEngagements = 0;
  const postsWithVirality: number[] = [];

  for (const p of dbPosts) {
    const m = p.metrics ?? {};
    totalViews += getViews(m);
    totalEngagements += getEngagement(m);
    const v = getVirality(p.ai_analysis ?? undefined);
    if (v != null) postsWithVirality.push(v);
  }

  const avgVirality =
    postsWithVirality.length > 0
      ? postsWithVirality.reduce((s, v) => s + v, 0) / postsWithVirality.length
      : 0;

  const stats = {
    totalViews,
    totalEngagements,
    totalPosts: dbPosts.length,
    avgVirality,
  };

  // Trends: last 7 days vs previous 7 days
  const now = new Date();
  const last7Start = new Date(now);
  last7Start.setDate(last7Start.getDate() - 6);
  last7Start.setHours(0, 0, 0, 0);
  const prev7Start = new Date(last7Start);
  prev7Start.setDate(prev7Start.getDate() - 7);

  let last7Views = 0;
  let last7Eng = 0;
  let prev7Views = 0;
  let prev7Eng = 0;

  for (const p of dbPosts) {
    const d = getPostDate(p);
    if (!d) continue;
    const postDate = new Date(d);
    const m = p.metrics ?? {};
    const v = getViews(m);
    const e = getEngagement(m);

    if (postDate >= last7Start) {
      last7Views += v;
      last7Eng += e;
    } else if (postDate >= prev7Start) {
      prev7Views += v;
      prev7Eng += e;
    }
  }

  const viewsTrend =
    prev7Views > 0 ? ((last7Views - prev7Views) / prev7Views) * 100 : 0;
  const engagementsTrend =
    prev7Eng > 0 ? ((last7Eng - prev7Eng) / prev7Eng) * 100 : 0;

  const trends = { viewsTrend, engagementsTrend };

  // Chart: last 7 or 30 days — daily totals
  const buildChartData = (days: number, useDayNumber = false) => {
    const out: { date: string; views: number; engagements: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const label = useDayNumber ? String(days - i) : d.toLocaleDateString("en-US", { weekday: "short" });

      let views = 0;
      let engagements = 0;

      for (const p of dbPosts) {
        const pd = getPostDate(p);
        if (pd !== dateStr) continue;
        const m = p.metrics ?? {};
        views += getViews(m);
        engagements += getEngagement(m);
      }

      out.push({
        date: label,
        views,
        engagements,
      });
    }
    return out;
  };

  const chartData = buildChartData(7, false);
  const chartData30D = buildChartData(30, true);

  // Top 4 posts by engagement
  const sorted = [...dbPosts].sort((a, b) => {
    const ea = getEngagement(a.metrics ?? {});
    const eb = getEngagement(b.metrics ?? {});
    return eb - ea;
  });

  const topPosts = sorted.slice(0, 4).map((p) => ({
    id: p.id,
    caption: (p.caption ?? "").slice(0, 80) || "Untitled",
    contentType: p.content_type ?? "post",
    thumbnailUrl: p.thumbnail_url ?? "",
    engagement: getEngagement(p.metrics ?? {}),
    views: getViews(p.metrics ?? {}),
    viralityScore: getVirality(p.ai_analysis ?? undefined),
    permalink: p.permalink ?? "#",
  }));

  const recentActivityFormatted = (recentActivity ?? []).map((a) => ({
    type: a.type,
    description: a.description,
    timestamp: a.created_at,
  }));

  return {
    connectedAccounts,
    stats,
    trends,
    chartData,
    chartData30D,
    topPosts,
    latestAnalysis: latestAnalysis?.data ?? null,
    goals: {
      raw: profile?.goals_raw ?? null,
      timeframe: profile?.goals_timeframe ?? null,
      structured: profile?.goals_structured ?? null,
    },
    recentActivity: recentActivityFormatted,
  };
}

// ─── Chat context builder ──────────────────────────────────────────────────────

export interface ChatContextData {
  accounts: Array<{ platform: string; username: string; followers: number }>;
  top20Posts: Array<{
    rank: number;
    caption: string;
    platform: string;
    views: number;
    likes: number;
    comments: number;
    engagementRate: number;
    postedAt: string;
    postType: string;
  }>;
  patternEvidence: {
    byFormat: Array<{ label: string; avgViews: number; isTop: boolean }>;
    byTopic: Array<{ label: string; avgViews: number; isTop: boolean }>;
  };
  playbook: {
    always: string[];
    never: string[];
    optimalSpecs: { duration: string; words: string; postTime: string; listItems: string };
  } | null;
  userGoal: { primaryGoal: string; currentFocus: string; weeklyTarget: string } | null;
  simulatedIdeas: Array<{
    title: string;
    format: string;
    viewsMin: number;
    viewsMax: number;
    signal: string;
  }>;
  weeklyCalendar: Array<{
    day: string;
    date: string;
    title: string;
    viewsMin: number;
    viewsMax: number;
    status: string;
  }>;
  postingStats: {
    daysSinceLastPost: number | null;
    avgPostsPerWeek: number;
    totalPostCount: number;
  };
}

export async function getChatContext(userId: string): Promise<ChatContextData> {
  const supabase = await createClient();

  const [{ data: accounts }, { data: posts }, { data: cachedAnalysis }, { data: goalArtifact }] =
    await Promise.all([
      supabase
        .from("social_accounts")
        .select("id, platform, username, display_name, account_data")
        .eq("user_id", userId),
      supabase
        .from("social_posts")
        .select("id, platform, social_account_id, caption, content_type, posted_at, metrics")
        .eq("user_id", userId)
        .order("posted_at", { ascending: false }),
      supabase
        .from("ai_artifacts")
        .select("data, created_at")
        .eq("user_id", userId)
        .eq("type", "overview_analysis")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("ai_artifacts")
        .select("data")
        .eq("user_id", userId)
        .eq("type", "user_goal")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const dbAccounts = ((accounts ?? []) as DbSocialAccount[]).filter(
    (a) => !(a.account_data as Record<string, unknown> | null)?.is_competitor
  );

  type ChatPost = {
    id: string;
    platform: string | null;
    social_account_id: string | null;
    caption: string | null;
    content_type?: string | null;
    posted_at?: string | null;
    metrics?: Record<string, number> | null;
  };
  const dbPosts = (posts ?? []) as ChatPost[];

  const accountsList = dbAccounts.map((a) => {
    const ad = (a.account_data ?? {}) as Record<string, number>;
    return {
      platform: a.platform,
      username: a.username ?? a.display_name ?? "",
      followers: ad.followers_count ?? ad.follower_count ?? 0,
    };
  });

  // Compute per-account follower counts for engagement rate
  const followersByPlatform: Record<string, number> = {};
  for (const acc of accountsList) {
    followersByPlatform[acc.platform] = acc.followers;
  }

  // Build post rows with engagement rate
  const postRows = dbPosts.map((p) => {
    const m = p.metrics ?? {};
    const views = getViews(m);
    const likes = (m as Record<string, number>).likes ?? (m as Record<string, number>).like_count ?? 0;
    const comments = (m as Record<string, number>).comments ?? (m as Record<string, number>).comment_count ?? 0;
    const followers = followersByPlatform[p.platform ?? "unknown"] ?? 0;
    const engRate = followers > 0 ? ((likes + comments) / followers) * 100 : 0;
    return {
      caption: (p.caption ?? "").slice(0, 100) || "Untitled",
      platform: (p.platform ?? "unknown") as string,
      views,
      likes,
      comments,
      engagementRate: Math.round(engRate * 10) / 10,
      postedAt: getPostDate(p as unknown as DbSocialPost) ?? "",
      postType: (p.content_type ?? "video") as string,
    };
  });

  // Top 20 by views
  const sorted = [...postRows].sort((a, b) => b.views - a.views);
  const top20Posts = sorted.slice(0, 20).map((p, i) => ({ rank: i + 1, ...p }));

  // Pattern evidence
  const formatGroups: Record<string, number[]> = {};
  for (const p of postRows) {
    const key = p.postType || "video";
    if (!formatGroups[key]) formatGroups[key] = [];
    formatGroups[key].push(p.views);
  }
  const byFormatRaw = Object.entries(formatGroups)
    .map(([label, views]) => ({
      label,
      avgViews: views.length > 0 ? Math.round(views.reduce((s, v) => s + v, 0) / views.length) : 0,
    }))
    .sort((a, b) => b.avgViews - a.avgViews);
  const maxFmt = byFormatRaw[0]?.avgViews ?? 1;
  const byFormat = byFormatRaw.map((f, i) => ({
    label: f.label.charAt(0).toUpperCase() + f.label.slice(1),
    avgViews: f.avgViews,
    isTop: i === 0 || f.avgViews >= maxFmt * 0.7,
  }));

  const TOPIC_KEYWORDS: Record<string, string[]> = {
    "Claude Code": ["claude", "code", "coding"],
    Tutorial: ["tutorial", "how to", "how-to", "learn", "guide"],
    "AI Tools": ["ai", "artificial intelligence", "chatgpt", "gpt", "llm"],
    Tips: ["tip", "tips", "trick", "hacks", "hack"],
    News: ["news", "update", "release", "new", "just dropped"],
    Review: ["review", "vs", "versus", "compare", "comparison"],
    Story: ["story", "i did", "i tried", "challenge", "journey"],
  };
  const topicGroups: Record<string, number[]> = {};
  for (const p of postRows) {
    const cap = p.caption.toLowerCase();
    for (const [topic, kws] of Object.entries(TOPIC_KEYWORDS)) {
      if (kws.some((kw) => cap.includes(kw))) {
        if (!topicGroups[topic]) topicGroups[topic] = [];
        topicGroups[topic].push(p.views);
      }
    }
  }
  const byTopicRaw = Object.entries(topicGroups)
    .filter(([, v]) => v.length > 0)
    .map(([label, views]) => ({
      label,
      avgViews: Math.round(views.reduce((s, v) => s + v, 0) / views.length),
    }))
    .sort((a, b) => b.avgViews - a.avgViews);
  const maxTopic = byTopicRaw[0]?.avgViews ?? 1;
  const byTopic = byTopicRaw.map((t, i) => ({
    label: t.label,
    avgViews: t.avgViews,
    isTop: i === 0 || t.avgViews >= maxTopic * 0.7,
  }));

  type AnalysisShape = {
    playbook?: {
      always: string[];
      never: string[];
      optimalSpecs: { duration: string; words: string; postTime: string; listItems: string };
    };
    simulatedIdeas?: Array<{
      title: string;
      format: string;
      viewsMin: number;
      viewsMax: number;
      signal: string;
    }>;
    weeklyCalendar?: Array<{
      day: string;
      date: string;
      title: string;
      viewsMin: number;
      viewsMax: number;
      status: string;
    }>;
  };
  const analysis = cachedAnalysis?.data as AnalysisShape | null;

  // Posting frequency stats
  const sortedByDate = [...dbPosts]
    .filter((p) => p.posted_at)
    .sort((a, b) => new Date(b.posted_at!).getTime() - new Date(a.posted_at!).getTime());
  const mostRecentPost = sortedByDate[0];
  const oldestPost = sortedByDate[sortedByDate.length - 1];
  const daysSinceLastPost = mostRecentPost?.posted_at
    ? Math.floor((Date.now() - new Date(mostRecentPost.posted_at).getTime()) / 86_400_000)
    : null;
  let avgPostsPerWeek = 0;
  if (sortedByDate.length >= 2 && mostRecentPost?.posted_at && oldestPost?.posted_at) {
    const spanDays = Math.max(
      1,
      (new Date(mostRecentPost.posted_at).getTime() - new Date(oldestPost.posted_at).getTime()) / 86_400_000
    );
    avgPostsPerWeek = Math.round((sortedByDate.length / (spanDays / 7)) * 10) / 10;
  }

  return {
    accounts: accountsList,
    top20Posts,
    patternEvidence: { byFormat, byTopic },
    playbook: analysis?.playbook ?? null,
    userGoal: goalArtifact?.data as ChatContextData["userGoal"] ?? null,
    simulatedIdeas: analysis?.simulatedIdeas?.slice(0, 7) ?? [],
    weeklyCalendar: analysis?.weeklyCalendar ?? [],
    postingStats: {
      daysSinceLastPost,
      avgPostsPerWeek,
      totalPostCount: dbPosts.length,
    },
  };
}

// ─── User goal helpers ─────────────────────────────────────────────────────────

export async function getLatestBriefing(
  userId: string
): Promise<{ content: string; generatedAt: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_artifacts")
    .select("data, created_at")
    .eq("user_id", userId)
    .eq("type", "daily_briefing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const d = data.data as { content?: string } | null;
  return d?.content
    ? { content: d.content, generatedAt: (data as { created_at: string }).created_at }
    : null;
}

export async function saveBriefing(
  userId: string,
  content: string
): Promise<void> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("ai_artifacts")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "daily_briefing")
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("ai_artifacts")
      .update({ data: { content }, created_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("ai_artifacts").insert({
      user_id: userId,
      type: "daily_briefing",
      title: "Daily Briefing",
      data: { content },
      pinned: false,
    });
  }
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

// ─── Overview types ────────────────────────────────────────────────────────────

export interface ChannelStat {
  platform: string;
  username: string;
  followers: number;
  followerGrowthPct: number;
  postCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
}

export interface PostRow {
  id: string;
  platform: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  postedAt: string;
  isViral: boolean;
  permalink: string;
  postType: string;
}

export interface PatternBar {
  label: string;
  avgViews: number;
  isTop: boolean;
}

export interface CompetitorStat {
  id: string;
  platform: string;
  username: string;
  followers: number;
  postCount: number;
  totalViews: number;
  avgViews: number;
  totalLikes: number;
  avgEngRate: number;
  lastSynced: string;
}

export interface OverviewData {
  channels: ChannelStat[];
  combined: {
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalFollowers: number;
    perPlatform: Record<string, { views: number; likes: number; comments: number; followers: number }>;
  };
  followerGrowth: Array<{ platform: string; weeks: Array<{ label: string; count: number }> }>;
  topPerformers: PostRow[];
  allPosts: PostRow[];
  crossPlatform: Array<{
    title: string;
    igViews: number;
    ttPlays: number;
    igEngPct: number;
    ttEngPct: number;
    winner: "ig" | "tt";
    multiplier: string;
  }>;
  patternEvidence: {
    byFormat: PatternBar[];
    byTopic: PatternBar[];
  };
  competitors: CompetitorStat[];
}

type DbOverviewPost = {
  id: string;
  platform: string;
  social_account_id: string;
  caption: string | null;
  content_type?: string | null;
  thumbnail_url?: string | null;
  permalink: string | null;
  posted_at?: string | null;
  metrics?: Record<string, number> | null;
  ai_analysis?: Record<string, unknown> | null;
};

type DbAudienceRow = {
  social_account_id: string;
  follower_count: number | null;
  fetched_at: string;
};

function ovViews(m: Record<string, number> | null | undefined): number {
  if (!m) return 0;
  return m.views ?? m.play_count ?? m.impressions ?? m.reach ?? 0;
}

function ovLikes(m: Record<string, number> | null | undefined): number {
  if (!m) return 0;
  return m.likes ?? m.like_count ?? 0;
}

function ovComments(m: Record<string, number> | null | undefined): number {
  if (!m) return 0;
  return m.comments ?? m.comment_count ?? 0;
}

function ovShares(m: Record<string, number> | null | undefined): number {
  if (!m) return 0;
  return m.shares ?? m.share_count ?? m.reposts ?? 0;
}

function ovPostDate(p: DbOverviewPost): string {
  const ts = p.posted_at;
  if (!ts) return "";
  return String(ts).split("T")[0];
}

export async function getOverviewData(userId: string): Promise<OverviewData> {
  const supabase = await createClient();

  const { data: allAccounts, error: accountsErr } = await supabase
    .from("social_accounts")
    .select("id, platform, username, display_name, account_data, last_synced_at")
    .eq("user_id", userId);
  if (accountsErr) console.error("[getOverviewData] accounts query error:", accountsErr.message);

  const dbAllAccounts = (allAccounts ?? []) as DbSocialAccount[];
  const accounts = dbAllAccounts.filter(
    (a) => !(a.account_data as Record<string, unknown> | null)?.is_competitor
  );
  const competitorAccounts = dbAllAccounts.filter(
    (a) => (a.account_data as Record<string, unknown> | null)?.is_competitor === true
  );

  const { data: posts } = await supabase
    .from("social_posts")
    .select("id, platform, social_account_id, caption, content_type, thumbnail_url, permalink, posted_at, metrics, ai_analysis")
    .eq("user_id", userId)
    .order("posted_at", { ascending: false });

  const { data: audienceRaw } = await supabase
    .from("audience_data")
    .select("social_account_id, follower_count, fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(50);

  const dbAccounts = accounts;
  const dbPosts = (posts ?? []) as DbOverviewPost[];
  const dbAudience = (audienceRaw ?? []) as DbAudienceRow[];

  // Build account lookup
  const accountById: Record<string, DbSocialAccount> = {};
  for (const a of dbAccounts) {
    accountById[a.id] = a;
  }

  // Per-account aggregation from posts
  const accountStats: Record<string, { views: number; likes: number; comments: number; shares: number; postCount: number }> = {};
  for (const p of dbPosts) {
    const key = p.social_account_id ?? "";
    if (!accountStats[key]) {
      accountStats[key] = { views: 0, likes: 0, comments: 0, shares: 0, postCount: 0 };
    }
    const m = p.metrics ?? {};
    accountStats[key].views += ovViews(m);
    accountStats[key].likes += ovLikes(m);
    accountStats[key].comments += ovComments(m);
    accountStats[key].shares += ovShares(m);
    accountStats[key].postCount += 1;
  }

  // channels
  const channels: ChannelStat[] = dbAccounts.map((a) => {
    const ad = (a.account_data ?? {}) as Record<string, number>;
    const followers = ad.followers_count ?? ad.follower_count ?? 0;
    const plat = a.platform;
    const ps = accountStats[a.id] ?? { views: 0, likes: 0, comments: 0, shares: 0, postCount: 0 };

    // Growth: compare most recent vs oldest audience snapshot for this account
    const snapshots = dbAudience
      .filter((d) => d.social_account_id === a.id)
      .sort((x, y) => new Date(x.fetched_at).getTime() - new Date(y.fetched_at).getTime());
    let followerGrowthPct = 0;
    if (snapshots.length >= 2) {
      const oldest = snapshots[0].follower_count ?? 0;
      const newest = snapshots[snapshots.length - 1].follower_count ?? 0;
      if (oldest > 0) followerGrowthPct = Math.round(((newest - oldest) / oldest) * 100);
    }

    return {
      platform: plat,
      username: a.username ?? a.display_name ?? "",
      followers,
      followerGrowthPct,
      postCount: ps.postCount,
      totalViews: ps.views,
      totalLikes: ps.likes,
      totalComments: ps.comments,
      totalShares: ps.shares,
    };
  });

  // combined
  const perPlatform: Record<string, { views: number; likes: number; comments: number; followers: number }> = {};
  for (const ch of channels) {
    perPlatform[ch.platform] = {
      views: ch.totalViews,
      likes: ch.totalLikes,
      comments: ch.totalComments,
      followers: ch.followers,
    };
  }
  const combined = {
    totalViews: channels.reduce((s, c) => s + c.totalViews, 0),
    totalLikes: channels.reduce((s, c) => s + c.totalLikes, 0),
    totalComments: channels.reduce((s, c) => s + c.totalComments, 0),
    totalFollowers: channels.reduce((s, c) => s + c.followers, 0),
    perPlatform,
  };

  // followerGrowth: group audience snapshots into weekly buckets per account
  const followerGrowth: OverviewData["followerGrowth"] = [];
  for (const a of dbAccounts) {
    const snapshots = dbAudience
      .filter((d) => d.social_account_id === a.id)
      .sort((x, y) => new Date(x.fetched_at).getTime() - new Date(y.fetched_at).getTime());

    const weeks: Array<{ label: string; count: number }> = [];
    if (snapshots.length > 0) {
      // Downsample to at most 6 data points
      const step = Math.max(1, Math.floor(snapshots.length / 6));
      for (let i = 0; i < snapshots.length; i += step) {
        const snap = snapshots[i];
        const d = new Date(snap.fetched_at);
        const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        weeks.push({ label, count: snap.follower_count ?? 0 });
        if (weeks.length >= 6) break;
      }
      // Always include the most recent
      const last = snapshots[snapshots.length - 1];
      const lastLabel = new Date(last.fetched_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (weeks[weeks.length - 1]?.label !== lastLabel) {
        weeks.push({ label: lastLabel, count: last.follower_count ?? 0 });
      }
    }

    followerGrowth.push({ platform: a.platform, weeks });
  }

  // allPosts rows
  const allViewsList = dbPosts.map((p) => ovViews(p.metrics ?? {}));
  allViewsList.sort((a, b) => a - b);
  const p80Index = Math.floor(allViewsList.length * 0.8);
  const viralThreshold = allViewsList[p80Index] ?? 0;

  const allPosts: PostRow[] = dbPosts.map((p) => {
    const m = p.metrics ?? {};
    const views = ovViews(m);
    const likes = ovLikes(m);
    const comments = ovComments(m);
    const shares = ovShares(m);
    const followers = channels.find((c) => c.platform === p.platform)?.followers ?? 0;
    const engRate = followers > 0 ? ((likes + comments + shares) / followers) * 100 : 0;
    return {
      id: p.id,
      platform: p.platform ?? "unknown",
      caption: (p.caption ?? "").slice(0, 100) || "Untitled",
      views,
      likes,
      comments,
      shares,
      engagementRate: Math.round(engRate * 10) / 10,
      postedAt: ovPostDate(p),
      isViral: views > viralThreshold && viralThreshold > 0,
      permalink: p.permalink ?? "#",
      postType: p.content_type ?? "video",
    };
  });

  // topPerformers
  const topPerformers = [...allPosts]
    .sort((a, b) => b.views - a.views)
    .slice(0, 3);

  // crossPlatform: match posts by caption prefix (first 40 chars) within 3 days
  const igPosts = allPosts.filter((p) => p.platform === "instagram");
  const ttPosts = allPosts.filter((p) => p.platform === "tiktok");

  const crossPlatform: OverviewData["crossPlatform"] = [];
  for (const ig of igPosts) {
    const prefix = ig.caption.slice(0, 40).toLowerCase().trim();
    if (prefix.length < 10) continue;
    const match = ttPosts.find((tt) => {
      const ttPrefix = tt.caption.slice(0, 40).toLowerCase().trim();
      if (ttPrefix.length < 10) return false;
      const overlap = prefix.split(" ").filter((w) => w.length > 3 && ttPrefix.includes(w)).length;
      if (overlap < 2) return false;
      if (ig.postedAt && tt.postedAt) {
        const diffDays = Math.abs(
          (new Date(ig.postedAt).getTime() - new Date(tt.postedAt).getTime()) / 86_400_000
        );
        return diffDays <= 3;
      }
      return true;
    });
    if (match) {
      const igEng = ig.engagementRate;
      const ttEng = match.engagementRate;
      const igWins = ig.views >= match.views;
      const ratio = igWins
        ? match.views > 0 ? ig.views / match.views : 0
        : ig.views > 0 ? match.views / ig.views : 0;
      crossPlatform.push({
        title: ig.caption.slice(0, 60),
        igViews: ig.views,
        ttPlays: match.views,
        igEngPct: igEng,
        ttEngPct: ttEng,
        winner: igWins ? "ig" : "tt",
        multiplier: `${ratio.toFixed(1)}x`,
      });
      if (crossPlatform.length >= 5) break;
    }
  }

  // patternEvidence
  const formatGroups: Record<string, number[]> = {};
  for (const p of allPosts) {
    const key = p.postType || "video";
    if (!formatGroups[key]) formatGroups[key] = [];
    formatGroups[key].push(p.views);
  }
  const byFormatRaw = Object.entries(formatGroups).map(([label, views]) => ({
    label,
    avgViews: views.length > 0 ? Math.round(views.reduce((s, v) => s + v, 0) / views.length) : 0,
  }));
  byFormatRaw.sort((a, b) => b.avgViews - a.avgViews);
  const maxFormatViews = byFormatRaw[0]?.avgViews ?? 1;
  const byFormat: PatternBar[] = byFormatRaw.map((f, i) => ({
    label: f.label.charAt(0).toUpperCase() + f.label.slice(1),
    avgViews: f.avgViews,
    isTop: i === 0 || f.avgViews >= maxFormatViews * 0.7,
  }));

  // Topic patterns: keyword buckets from top/bottom posts
  const TOPIC_KEYWORDS: Record<string, string[]> = {
    "Claude Code": ["claude", "code", "coding"],
    "Tutorial": ["tutorial", "how to", "how-to", "learn", "guide"],
    "AI Tools": ["ai", "artificial intelligence", "chatgpt", "gpt", "llm"],
    "Tips": ["tip", "tips", "trick", "hacks", "hack"],
    "News": ["news", "update", "release", "new", "just dropped"],
    "Review": ["review", "vs", "versus", "compare", "comparison"],
    "Story": ["story", "i did", "i tried", "challenge", "journey"],
  };

  const topicGroups: Record<string, number[]> = {};
  for (const p of allPosts) {
    const cap = p.caption.toLowerCase();
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      if (keywords.some((kw) => cap.includes(kw))) {
        if (!topicGroups[topic]) topicGroups[topic] = [];
        topicGroups[topic].push(p.views);
      }
    }
  }
  const byTopicRaw = Object.entries(topicGroups)
    .filter(([, views]) => views.length > 0)
    .map(([label, views]) => ({
      label,
      avgViews: Math.round(views.reduce((s, v) => s + v, 0) / views.length),
    }));
  byTopicRaw.sort((a, b) => b.avgViews - a.avgViews);
  const maxTopicViews = byTopicRaw[0]?.avgViews ?? 1;
  const byTopic: PatternBar[] = byTopicRaw.map((t, i) => ({
    label: t.label,
    avgViews: t.avgViews,
    isTop: i === 0 || t.avgViews >= maxTopicViews * 0.7,
  }));

  // ── Competitor stats ──────────────────────────────────────────────────────
  const competitorIds = competitorAccounts.map((a) => a.id);
  const competitorPostsRaw = competitorIds.length > 0
    ? await supabase
        .from("social_posts")
        .select("social_account_id, platform, metrics")
        .in("social_account_id", competitorIds)
    : { data: [] };

  const compPostsByAccount: Record<string, { views: number[]; likes: number[]; comments: number[] }> = {};
  for (const p of (competitorPostsRaw.data ?? []) as Array<{ social_account_id: string; platform: string; metrics: Record<string, number> | null }>) {
    if (!compPostsByAccount[p.social_account_id]) {
      compPostsByAccount[p.social_account_id] = { views: [], likes: [], comments: [] };
    }
    const m = p.metrics ?? {};
    compPostsByAccount[p.social_account_id].views.push(ovViews(m));
    compPostsByAccount[p.social_account_id].likes.push(ovLikes(m));
    compPostsByAccount[p.social_account_id].comments.push(ovComments(m));
  }

  const competitors: CompetitorStat[] = competitorAccounts.map((a) => {
    const ad = (a.account_data ?? {}) as Record<string, number>;
    const followers = ad.followers_count ?? ad.follower_count ?? 0;
    const cp = compPostsByAccount[a.id] ?? { views: [], likes: [], comments: [] };
    const totalViews = cp.views.reduce((s, v) => s + v, 0);
    const totalLikes = cp.likes.reduce((s, v) => s + v, 0);
    const avgViews = cp.views.length > 0 ? Math.round(totalViews / cp.views.length) : 0;
    const totalEng = totalLikes + cp.comments.reduce((s, v) => s + v, 0);
    const avgEngRate = followers > 0 && cp.views.length > 0
      ? Math.round((totalEng / cp.views.length / followers) * 1000) / 10
      : 0;
    return {
      id: a.id,
      platform: a.platform,
      username: a.username ?? a.display_name ?? "",
      followers,
      postCount: cp.views.length,
      totalViews,
      avgViews,
      totalLikes,
      avgEngRate,
      lastSynced: a.last_synced_at ?? "",
    };
  });

  return {
    channels,
    combined,
    followerGrowth,
    topPerformers,
    allPosts,
    crossPlatform,
    patternEvidence: { byFormat, byTopic },
    competitors,
  };
}
