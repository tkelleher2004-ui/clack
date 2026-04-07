import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getOverviewData } from "@/lib/dashboard-data";
import type { AIAnalysis } from "@/app/dashboard/overview/page";

export const maxDuration = 60;

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Get latest goal
  const { data: goalArtifact } = await supabase
    .from("ai_artifacts")
    .select("data")
    .eq("user_id", user.id)
    .eq("type", "user_goal")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const userGoal = goalArtifact?.data as
    | { primaryGoal: string; currentFocus: string; weeklyTarget: string }
    | null;

  // Check for very fresh cache (< 3 min) written by chat — return it directly
  const { data: freshCache } = await supabase
    .from("ai_artifacts")
    .select("data, created_at")
    .eq("user_id", user.id)
    .eq("type", "overview_analysis")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (freshCache?.data && freshCache.created_at) {
    const ageMs = Date.now() - new Date(freshCache.created_at).getTime();
    if (ageMs < 3 * 60 * 1000) {
      return NextResponse.json({ analysis: freshCache.data as AIAnalysis });
    }
  }

  const overviewData = await getOverviewData(user.id);
  if (overviewData.allPosts.length < 3) {
    return NextResponse.json({ analysis: null });
  }

  // Delete old cache to force fresh generation
  await supabase
    .from("ai_artifacts")
    .delete()
    .eq("user_id", user.id)
    .eq("type", "overview_analysis");

  const top20 = overviewData.allPosts
    .slice()
    .sort((a, b) => b.views - a.views)
    .slice(0, 20)
    .map(
      (p, i) =>
        `${i + 1}. "${p.caption.slice(0, 80)}" | ${p.platform} | ${p.views} views | ${p.likes} likes | ${p.comments} comments | type: ${p.postType} | date: ${p.postedAt}`
    )
    .join("\n");

  const goalContext = userGoal
    ? `

CRITICAL — USER'S CURRENT GOAL:
Primary goal: ${userGoal.primaryGoal}
Current focus: "${userGoal.currentFocus}"
Weekly target: "${userGoal.weeklyTarget}"

TOPIC RULE: The currentFocus above drives 100% of topic selection. Do NOT generate ideas based on historical post titles or topics. Use historical data ONLY to determine: which format works best (3-list, how-to, story, comparison), optimal duration, optimal hook style, and optimal posting times. Every single idea title, hook, and topic must be within the scope of "${userGoal.currentFocus}". Do not blend in old topics even if they performed well historically.`
    : "";

  const prompt = `You are analyzing social media performance data for a content creator. Based on their post history, generate strategic recommendations.${goalContext}

Post data:
${top20}

Generate a JSON response (no markdown, just raw JSON) with this structure:
{
  "playbook": {
    "always": ["specific actionable rule with data evidence", "rule 2", "rule 3", "rule 4"],
    "never": ["specific rule about what hurts performance", "rule 2", "rule 3", "rule 4"],
    "optimalSpecs": {
      "duration": "40-57s",
      "words": "130-145",
      "postTime": "4-6 PM",
      "listItems": "3"
    }
  },
  "simulatedIdeas": [
    {
      "title": "Specific content idea title — the exact hook word-for-word",
      "format": "3-list",
      "duration": "45s",
      "confidence": "Proven",
      "viewsMin": 180000,
      "viewsMax": 350000,
      "engMin": 5.2,
      "engMax": 6.8,
      "followersMin": 800,
      "followersMax": 2000,
      "signal": "POST",
      "hook": "The exact first line of the video word-for-word",
      "scriptOutline": "Two sentences: what the intro sets up and how the video pays it off.",
      "matchedFormat": "3-list"
    }
  ],
  "weeklyCalendar": [
    {
      "day": "MON",
      "date": "Mar 17",
      "title": "Content title",
      "viewsMin": 100000,
      "viewsMax": 250000,
      "status": "POST"
    }
  ]
}

Rules:
- simulatedIdeas must have exactly 7 items
- weeklyCalendar must have exactly 7 days starting from next Monday
- signal values: POST (high confidence), TEST (medium confidence), SKIP (low ROI)
- status values: BEST (optimal day), POST (good day), TEST (experimental), REST (skip)
- Ideas must be genuinely specific, not generic. "The AI tool I can't stop using" is too generic. "Why everyone switched from Notion to this AI tool in 48 hours" is specific.
- Always write the exact hook word-for-word in the hook field — not a description of a hook, the actual hook line
- scriptOutline must be exactly 2 sentences that tell the creator how to structure the video
- matchedFormat must reference the proven format from the post history data that this idea uses
- Base viewsMin/viewsMax on how closely the idea matches their top-performing format, duration, and hook style combinations${userGoal ? `\n- ALL 7 ideas must be within the topic scope: "${userGoal.currentFocus}" — topics come from the goal, not from historical post titles` : ""}
- Use historical data only to determine format, hook style, duration, and posting time — not topics`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ analysis: null });

    const analysis = JSON.parse(jsonMatch[0]) as AIAnalysis;

    // Cache it (fire and forget)
    void supabase.from("ai_artifacts").insert({
      user_id: user.id,
      type: "overview_analysis",
      title: "Overview Analysis",
      data: analysis,
      pinned: false,
    });

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("[overview/refresh] error:", err);
    return NextResponse.json({ error: "Failed to generate analysis" }, { status: 500 });
  }
}
