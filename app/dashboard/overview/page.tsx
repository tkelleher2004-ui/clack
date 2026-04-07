import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOverviewData, type OverviewData } from "@/lib/dashboard-data";
import Anthropic from "@anthropic-ai/sdk";
import { OverviewClient } from "./OverviewClient";

export interface AIAnalysis {
  playbook: {
    always: string[];
    never: string[];
    optimalSpecs: { duration: string; words: string; postTime: string; listItems: string };
  };
  simulatedIdeas: Array<{
    title: string;
    format: string;
    duration: string;
    confidence: string;
    viewsMin: number;
    viewsMax: number;
    engMin: number;
    engMax: number;
    followersMin: number;
    followersMax: number;
    signal: "POST" | "TEST" | "SKIP";
  }>;
  weeklyCalendar: Array<{
    day: string;
    date: string;
    title: string;
    viewsMin: number;
    viewsMax: number;
    status: "BEST" | "POST" | "TEST" | "REST";
  }>;
}

async function getAIAnalysis(
  userId: string,
  overviewData: OverviewData
): Promise<AIAnalysis | null> {
  if (overviewData.allPosts.length < 3) return null;

  const supabase = await createClient();

  const { data: cached } = await supabase
    .from("ai_artifacts")
    .select("data, created_at")
    .eq("user_id", userId)
    .eq("type", "overview_analysis")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached?.data && cached.created_at) {
    const ageHours = (Date.now() - new Date(cached.created_at).getTime()) / 3_600_000;
    if (ageHours < 48) {
      return cached.data as AIAnalysis;
    }
  }

  const top20 = overviewData.allPosts
    .slice()
    .sort((a, b) => b.views - a.views)
    .slice(0, 20)
    .map((p, i) => `${i + 1}. "${p.caption.slice(0, 80)}" | ${p.platform} | ${p.views} views | ${p.likes} likes | ${p.comments} comments | type: ${p.postType} | date: ${p.postedAt}`)
    .join("\n");

  const prompt = `You are analyzing social media performance data for a content creator. Based on their post history, generate strategic recommendations.

Post data summary:
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
      "title": "Specific content idea title",
      "format": "3-list",
      "duration": "45s",
      "confidence": "Proven",
      "viewsMin": 180000,
      "viewsMax": 350000,
      "engMin": 5.2,
      "engMax": 6.8,
      "followersMin": 800,
      "followersMax": 2000,
      "signal": "POST"
    }
  ],
  "weeklyCalendar": [
    {
      "day": "MON",
      "date": "Mar 10",
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
- signal values: POST (high confidence, post now), TEST (medium confidence), SKIP (low ROI)
- status values: BEST (optimal day), POST (good day), TEST (experimental), REST (skip)
- format values: 3-list, story, how-to, compare, opinion
- confidence values: Proven, Unproven
- Base projections on actual performance data provided above`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const analysis = JSON.parse(jsonMatch[0]) as AIAnalysis;

    // Cache it — ignore errors (type may not be in CHECK constraint yet)
    void supabase.from("ai_artifacts").insert({
      user_id: userId,
      type: "overview_analysis",
      title: "Overview Analysis",
      data: analysis,
      pinned: false,
    });

    return analysis;
  } catch (err) {
    console.error("[getAIAnalysis] error:", err);
    return null;
  }
}

export default async function OverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const overviewData = await getOverviewData(user.id);
  const aiAnalysis = await getAIAnalysis(user.id, overviewData);

  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim() ?? "";
  const userEmail = user.email ?? "";

  return (
    <OverviewClient
      overviewData={overviewData}
      aiAnalysis={aiAnalysis}
      displayName={fullName || userEmail.split("@")[0]}
      userEmail={userEmail}
    />
  );
}
