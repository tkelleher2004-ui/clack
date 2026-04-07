import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getChatContext, getLatestBriefing, saveBriefing } from "@/lib/dashboard-data";

// GET: return cached briefing (if it exists and is fresh enough)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const briefing = await getLatestBriefing(user.id);
  if (!briefing) return NextResponse.json({ briefing: null });

  // Check if briefing was generated after the most recent account sync
  const { data: latestSync } = await supabase
    .from("social_accounts")
    .select("last_synced_at")
    .eq("user_id", user.id)
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const briefingTime = new Date(briefing.generatedAt).getTime();
  const syncTime = latestSync?.last_synced_at
    ? new Date(latestSync.last_synced_at).getTime()
    : 0;

  // Return cached if briefing is newer than last sync, or if briefing is < 6 hours old
  const ageHours = (Date.now() - briefingTime) / 3_600_000;
  if (briefingTime >= syncTime || ageHours < 6) {
    return NextResponse.json({ briefing: briefing.content, generatedAt: briefing.generatedAt });
  }

  return NextResponse.json({ briefing: null });
}

// POST: generate a new briefing and cache it
export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let ctx: Awaited<ReturnType<typeof getChatContext>>;
  try {
    ctx = await getChatContext(user.id);
  } catch (err) {
    console.error("[briefing] getChatContext error:", err);
    return NextResponse.json({ error: "Failed to load context" }, { status: 500 });
  }

  if (ctx.top20Posts.length === 0) {
    return NextResponse.json({ briefing: null });
  }

  // Get last post date for cadence check
  const lastPost = ctx.top20Posts
    .filter((p) => p.postedAt)
    .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())[0];

  const daysSinceLastPost = lastPost
    ? Math.floor((Date.now() - new Date(lastPost.postedAt).getTime()) / 86_400_000)
    : null;

  // Find top performer from last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentPosts = ctx.top20Posts.filter(
    (p) => p.postedAt && new Date(p.postedAt) >= sevenDaysAgo
  );
  const allPostsForAvg = ctx.top20Posts;
  const avgViews =
    allPostsForAvg.length > 0
      ? Math.round(allPostsForAvg.reduce((s, p) => s + p.views, 0) / allPostsForAvg.length)
      : 0;
  const topRecent = recentPosts.sort((a, b) => b.views - a.views)[0];
  const topRecentMultiplier =
    topRecent && avgViews > 0
      ? (topRecent.views / avgViews).toFixed(1)
      : null;

  // Get follower counts
  const totalFollowers = ctx.accounts.reduce((s, a) => s + a.followers, 0);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const prompt = `You are a concise marketing strategist AI. Write a morning briefing for a content creator. It should feel like a smart friend texting them their morning update — specific, direct, 3-4 sentences max.

Data:
- Today: ${today}
- Platforms: ${ctx.accounts.map((a) => `${a.platform} @${a.username} (${a.followers.toLocaleString()} followers)`).join(", ")}
- Total followers: ${totalFollowers.toLocaleString()}
- Days since last post: ${daysSinceLastPost ?? "unknown"}
- Optimal posting cadence from their data: daily
- Top post this week: "${topRecent?.caption?.slice(0, 60) ?? "none"}" — ${topRecent?.views?.toLocaleString() ?? 0} views (${topRecentMultiplier ? `${topRecentMultiplier}x their average` : "no comparison"})
- Current goal: ${ctx.userGoal?.currentFocus ?? "not set"}
- Top content idea ready: "${ctx.simulatedIdeas[0]?.title ?? "none"}"

Write the briefing in second person, present tense. Don't start with "Good morning". Be specific. End with one actionable suggestion (what to post today). No bullet points — just flowing sentences.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const content =
      msg.content[0]?.type === "text" ? msg.content[0].text.trim() : null;
    if (!content) return NextResponse.json({ briefing: null });

    await saveBriefing(user.id, content);
    return NextResponse.json({ briefing: content });
  } catch (err) {
    console.error("[briefing] Claude error:", err);
    return NextResponse.json({ error: "Failed to generate briefing" }, { status: 500 });
  }
}
