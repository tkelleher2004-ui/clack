import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/seed — Seeds realistic demo data for the current logged-in user.
// Idempotent: clears existing seed data first, then re-inserts.
// REMOVE or gate behind env check before production.

const IG_POSTS = [
  { caption: "3 Claude Code MCP servers that replaced paid tools for me", views: 798000, likes: 21172, comments: 293, shares: 2100, post_type: "reel", days_ago: 8 },
  { caption: "Claude Code as your full-stack marketing manager", views: 128597, likes: 7328, comments: 141, shares: 1130, post_type: "reel", days_ago: 13 },
  { caption: "3 Claude Code skills worth installing right now", views: 109465, likes: 4764, comments: 48, shares: 955, post_type: "reel", days_ago: 18 },
  { caption: "Motion + Claude Code video editing workflow", views: 34809, likes: 1974, comments: 1657, shares: 890, post_type: "reel", days_ago: 22 },
  { caption: "Context handoff vs /compact — which is better?", views: 18375, likes: 858, comments: 42, shares: 310, post_type: "reel", days_ago: 27 },
  { caption: "OpenClaw 3 variants compared", views: 14195, likes: 664, comments: 17, shares: 245, post_type: "reel", days_ago: 33 },
  { caption: "Write like a human framework for AI content", views: 8730, likes: 358, comments: 9, shares: 140, post_type: "reel", days_ago: 38 },
  { caption: "Subscription audit using Claude Code in 10 min", views: 3950, likes: 199, comments: 24, shares: 88, post_type: "reel", days_ago: 44 },
  { caption: "Anthropic vs OpenClaw for production apps", views: 3735, likes: 135, comments: 10, shares: 72, post_type: "reel", days_ago: 50 },
  { caption: "CSS methods for AI-generated interfaces", views: 2435, likes: 86, comments: 2, shares: 45, post_type: "image", days_ago: 56 },
  { caption: "AI automation tools that save me 5 hours a week", views: 1852, likes: 47, comments: 7, shares: 33, post_type: "reel", days_ago: 62 },
  { caption: "Claude Code 3 new features breakdown", views: 1281, likes: 108, comments: 2, shares: 28, post_type: "reel", days_ago: 68 },
  { caption: "Building a SaaS in 48 hours using only Claude Code", views: 52000, likes: 2800, comments: 134, shares: 620, post_type: "reel", days_ago: 73 },
];

const TT_POSTS = [
  { caption: "3 Claude Code MCP servers that replaced paid tools for me", views: 381000, likes: 23500, comments: 441, shares: 4065, post_type: "video", days_ago: 8 },
  { caption: "Claude Code as your full-stack marketing manager", views: 66700, likes: 6050, comments: 141, shares: 1618, post_type: "video", days_ago: 13 },
  { caption: "3 Claude Code skills worth installing right now", views: 129400, likes: 10300, comments: 48, shares: 3200, post_type: "video", days_ago: 18 },
  { caption: "Motion + Claude Code video editing workflow", views: 22400, likes: 1240, comments: 87, shares: 510, post_type: "video", days_ago: 22 },
  { caption: "Context handoff vs /compact — which is better?", views: 9800, likes: 490, comments: 18, shares: 220, post_type: "video", days_ago: 27 },
  { caption: "OpenClaw 3 variants compared", views: 7200, likes: 320, comments: 11, shares: 180, post_type: "video", days_ago: 33 },
  { caption: "Write like a human framework for AI content", views: 4100, likes: 155, comments: 6, shares: 95, post_type: "video", days_ago: 38 },
  { caption: "Building a SaaS in 48 hours using only Claude Code", views: 31000, likes: 1900, comments: 95, shares: 780, post_type: "video", days_ago: 73 },
];

// Weekly follower snapshots — most recent first
const IG_FOLLOWER_HISTORY = [12203, 8537, 4871, 3666, 2178, 945];
const TT_FOLLOWER_HISTORY = [4065, 2447, 1618, 1249, 621, 310];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = user.id;

  // ── 1. Clear existing seed data ───────────────────────────────────────────
  await supabase.from("social_posts").delete().eq("user_id", userId);
  await supabase.from("audience_data").delete().eq("social_account_id",
    // Will be re-deleted after we know the IDs — placeholder
    "00000000-0000-0000-0000-000000000000"
  );
  await supabase.from("social_accounts").delete().eq("user_id", userId);

  // ── 2. Insert social accounts ─────────────────────────────────────────────
  const { data: insertedAccounts, error: accountErr } = await supabase
    .from("social_accounts")
    .insert([
      {
        user_id: userId,
        platform: "instagram",
        platform_account_id: `demo_ig_${userId.slice(0, 8)}`,
        username: "demo_instagram",
        display_name: "Demo Instagram",
        account_data: {
          followers_count: 12203,
          media_count: IG_POSTS.length,
          biography: "AI Tools · Claude Code · Vibe Coding",
        },
        last_synced_at: new Date().toISOString(),
      },
      {
        user_id: userId,
        platform: "tiktok",
        platform_account_id: `demo_tt_${userId.slice(0, 8)}`,
        username: "demo_tiktok",
        display_name: "Demo TikTok",
        account_data: {
          followers_count: 4065,
          video_count: TT_POSTS.length,
        },
        last_synced_at: new Date().toISOString(),
      },
    ])
    .select("id, platform");

  if (accountErr || !insertedAccounts) {
    return NextResponse.json({ error: accountErr?.message ?? "Failed to insert accounts" }, { status: 500 });
  }

  const igAccount = insertedAccounts.find(a => a.platform === "instagram");
  const ttAccount = insertedAccounts.find(a => a.platform === "tiktok");

  if (!igAccount || !ttAccount) {
    return NextResponse.json({ error: "Account insert incomplete" }, { status: 500 });
  }

  // ── 3. Insert posts ───────────────────────────────────────────────────────
  const igPostRows = IG_POSTS.map(p => ({
    user_id: userId,
    social_account_id: igAccount.id,
    platform: "instagram",
    external_post_id: `demo_ig_post_${Math.random().toString(36).slice(2)}`,
    post_type: p.post_type,
    caption: p.caption,
    posted_at: daysAgo(p.days_ago),
    published_at: daysAgo(p.days_ago),
    permalink: "https://instagram.com/p/demo",
    metrics: {
      views: p.views,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      impressions: p.views,
    },
  }));

  const ttPostRows = TT_POSTS.map(p => ({
    user_id: userId,
    social_account_id: ttAccount.id,
    platform: "tiktok",
    external_post_id: `demo_tt_post_${Math.random().toString(36).slice(2)}`,
    post_type: p.post_type,
    caption: p.caption,
    posted_at: daysAgo(p.days_ago),
    published_at: daysAgo(p.days_ago),
    permalink: "https://tiktok.com/@demo",
    metrics: {
      views: p.views,
      play_count: p.views,
      likes: p.likes,
      like_count: p.likes,
      comments: p.comments,
      comment_count: p.comments,
      shares: p.shares,
      share_count: p.shares,
    },
  }));

  const { error: postsErr } = await supabase
    .from("social_posts")
    .insert([...igPostRows, ...ttPostRows]);

  if (postsErr) {
    return NextResponse.json({ error: postsErr.message }, { status: 500 });
  }

  // ── 4. Insert audience_data for follower growth charts ────────────────────
  const audienceRows: {
    social_account_id: string;
    follower_count: number;
    fetched_at: string;
  }[] = [];

  IG_FOLLOWER_HISTORY.forEach((count, i) => {
    audienceRows.push({
      social_account_id: igAccount.id,
      follower_count: count,
      fetched_at: daysAgo(i * 7),
    });
  });

  TT_FOLLOWER_HISTORY.forEach((count, i) => {
    audienceRows.push({
      social_account_id: ttAccount.id,
      follower_count: count,
      fetched_at: daysAgo(i * 7),
    });
  });

  // audience_data might not exist — ignore error
  await supabase.from("audience_data").insert(audienceRows);

  return NextResponse.json({
    ok: true,
    accounts: insertedAccounts.length,
    posts: igPostRows.length + ttPostRows.length,
    message: "Seed complete — refresh /dashboard/overview",
  });
}
