import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const platform = (body.platform as string) || "instagram";

  // Fetch account data
  const { data: account } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("platform", platform)
    .single();

  if (!account) {
    return NextResponse.json({ error: "No account found" }, { status: 404 });
  }

  // Fetch all posts
  const { data: posts } = await supabase
    .from("social_posts")
    .select("*")
    .eq("social_account_id", account.id)
    .order("posted_at", { ascending: false });

  if (!posts || posts.length === 0) {
    return NextResponse.json({ error: "No posts found" }, { status: 404 });
  }

  // Fetch user's profile (brand_profiles)
  const { data: profile } = await supabase
    .from("brand_profiles")
    .select("goals_raw, goals_timeframe, business_name, target_audience, brand_voice")
    .eq("user_id", user.id)
    .single();

  // Build the analysis prompt
  const postsFormatted = posts
    .map((p, i) => {
      const metrics = (p.metrics as Record<string, number>) || {};
      return `Post ${i + 1} [${p.content_type}] — ${p.posted_at}
Caption: "${(p.caption || "No caption").slice(0, 200)}"
Likes: ${metrics.likes || 0} | Comments: ${metrics.comments || 0} | Views: ${metrics.views ?? "N/A"} | Saves: ${metrics.saves ?? "N/A"} | Reach: ${metrics.reach ?? "N/A"}`;
    })
    .join("\n\n");

  const accountInfo = (account.account_data as Record<string, unknown>) || {};

  const analysisPrompt = `You are analyzing an Instagram account for a marketing deep dive. Be specific, reference actual posts, give real numbers.

ACCOUNT INFO:
Username: @${account.username ?? "unknown"}
Followers: ${accountInfo.followers_count ?? "Unknown"}
Following: ${accountInfo.follows_count ?? "Unknown"}
Total posts: ${accountInfo.media_count ?? posts.length}
Bio: ${accountInfo.biography ?? "None"}
${profile?.business_name ? `Brand: ${profile.business_name}` : ""}
${profile?.target_audience ? `Target audience: ${profile.target_audience}` : ""}
${profile?.brand_voice ? `Brand voice: ${profile.brand_voice}` : ""}
${profile?.goals_raw ? `Goals: ${profile.goals_raw}` : ""}
${profile?.goals_timeframe ? `Timeframe: ${profile.goals_timeframe}` : ""}

RECENT POSTS (${posts.length} total):
${postsFormatted}

ANALYZE THIS ACCOUNT. Return a JSON object with this EXACT structure (no markdown, no backticks, just raw JSON):
{
  "summary": "2-3 sentence performance overview",
  "overall_score": 7.5,
  "strengths": [
    { "point": "specific strength", "evidence": "referencing actual post data" }
  ],
  "weaknesses": [
    { "point": "specific weakness", "evidence": "referencing actual post data" }
  ],
  "top_posts": [
    {
      "caption_preview": "first 80 chars of caption",
      "content_type": "reel/image/carousel",
      "likes": 0,
      "comments": 0,
      "virality_score": 8.5,
      "why_it_worked": "specific reasons"
    }
  ],
  "worst_posts": [
    {
      "caption_preview": "first 80 chars",
      "likes": 0,
      "comments": 0,
      "virality_score": 2.0,
      "why_it_failed": "specific reasons",
      "improvement": "what to change"
    }
  ],
  "audience_insights": "what we can infer about the audience from engagement patterns",
  "content_gaps": [
    { "gap": "type of content missing", "why": "why it would work", "example": "specific idea" }
  ],
  "best_posting_times": [
    { "day": "Tuesday", "time": "7:00 PM", "reasoning": "based on top post timing" }
  ],
  "recommendations": [
    { "priority": 1, "action": "specific action to take", "expected_impact": "what should happen", "timeframe": "this week/month" }
  ],
  "weekly_plan": {
    "monday": { "type": "Reel", "idea": "specific content idea", "platform_tip": "posting tip" },
    "tuesday": null,
    "wednesday": { "type": "Carousel", "idea": "specific content idea", "platform_tip": "posting tip" },
    "thursday": null,
    "friday": { "type": "Reel", "idea": "specific content idea", "platform_tip": "posting tip" },
    "saturday": null,
    "sunday": { "type": "Story", "idea": "engagement/poll content", "platform_tip": "tip" }
  },
  "growth_prediction": "realistic projection based on current trajectory"
}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: analysisPrompt }],
    });

    // Extract text content
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Parse JSON (strip any markdown fences if present)
    const jsonText = textContent.text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const analysis = JSON.parse(jsonText) as Record<string, unknown>;

    // Save as artifact
    const { data: artifact, error: artifactError } = await supabase
      .from("ai_artifacts")
      .insert({
        user_id: user.id,
        type: "deep_dive",
        title: `Instagram Deep Dive — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        data: analysis,
        pinned: true,
      })
      .select()
      .single();

    if (artifactError) {
      console.error("Artifact save error:", artifactError);
    }

    // Update each post with virality scores from the analysis
    const topPosts = analysis.top_posts as Array<{
      caption_preview?: string;
      virality_score?: number;
      why_it_worked?: string;
    }> | undefined;
    if (topPosts) {
      for (const topPost of topPosts) {
        const preview = (topPost.caption_preview ?? "").slice(0, 40);
        const matchingPost = posts.find(
          (p) => p.caption && p.caption.slice(0, 80).includes(preview)
        );
        if (matchingPost) {
          await supabase
            .from("social_posts")
            .update({
              ai_analysis: {
                virality_score: topPost.virality_score,
                analysis: topPost.why_it_worked,
              },
            })
            .eq("id", matchingPost.id);
        }
      }
    }

    // Log activity
    await supabase.from("activity_log").insert({
      user_id: user.id,
      type: "analysis_complete",
      description: `AI completed Instagram deep dive — analyzed ${posts.length} posts`,
      data: {
        platform: "instagram",
        posts_analyzed: posts.length,
        overall_score: analysis.overall_score,
      },
    });

    return NextResponse.json({
      success: true,
      artifact_id: artifact?.id,
      analysis,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
