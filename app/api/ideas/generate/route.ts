import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getChatContext } from "@/lib/dashboard-data";

export const maxDuration = 30;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { topic: string; count?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.topic?.trim()) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }

  const count = Math.min(body.count ?? 3, 5);
  const ctx = await getChatContext(user.id, body.topic);

  // Build a compact context for idea generation
  const patternInfo = ctx.patternEvidence.byFormat.length > 0
    ? `Top formats: ${ctx.patternEvidence.byFormat.slice(0, 3).map(f => `${f.label} (avg ${f.avgViews} views)`).join(", ")}`
    : "";

  const playbookInfo = ctx.playbook
    ? `Proven playbook: duration ${ctx.playbook.optimalSpecs.duration}, post time ${ctx.playbook.optimalSpecs.postTime}. Always: ${ctx.playbook.always.slice(0, 3).join("; ")}. Never: ${ctx.playbook.never.slice(0, 2).join("; ")}.`
    : "";

  const topPostsInfo = ctx.top20Posts.slice(0, 5)
    .map(p => `"${p.caption}" (${p.views} views, ${p.postType})`)
    .join("\n");

  const prompt = `Generate ${count} content ideas about "${body.topic}" for a social media creator.

Their data:
${patternInfo}
${playbookInfo}
Top posts:
${topPostsInfo}

Return a JSON array (no markdown, just raw JSON) with this structure:
[
  {
    "title": "Specific title",
    "format": "3-list|story|how-to|compare|opinion",
    "duration": "45s",
    "predictedViewsMin": 50000,
    "predictedViewsMax": 150000,
    "hook": "The exact opening line/hook",
    "script": "Brief script outline (2-3 sentences)",
    "signal": "POST|TEST"
  }
]

Rules:
- Base predictions on their actual performance data
- Use their proven formats and hook styles
- Each idea should be distinct
- Hooks should be specific and compelling, not generic`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse ideas" }, { status: 500 });
    }

    const ideas = JSON.parse(jsonMatch[0]) as Array<{
      title: string;
      format: string;
      duration: string;
      predictedViewsMin: number;
      predictedViewsMax: number;
      hook: string;
      script: string;
      signal: string;
    }>;

    // Also persist to overview_analysis so they show up in the pipeline
    const { data: existing } = await supabase
      .from("ai_artifacts")
      .select("data")
      .eq("user_id", user.id)
      .eq("type", "overview_analysis")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    type AnalysisData = {
      playbook?: unknown;
      simulatedIdeas?: Array<Record<string, unknown>>;
      weeklyCalendar?: unknown[];
    };
    const prev = existing?.data as AnalysisData | null;
    const existingIdeas = prev?.simulatedIdeas ?? [];

    const newIdeas = ideas.map((i) => ({
      title: i.title,
      format: i.format,
      duration: i.duration,
      confidence: "Unproven",
      viewsMin: i.predictedViewsMin,
      viewsMax: i.predictedViewsMax,
      engMin: 4.0,
      engMax: 7.0,
      followersMin: 50,
      followersMax: 200,
      signal: i.signal as "POST" | "TEST",
      hook: i.hook,
      scriptOutline: i.script,
    }));

    // Prepend new ideas to existing ones (max 15 total)
    const mergedIdeas = [...newIdeas, ...existingIdeas].slice(0, 15);

    await supabase.from("ai_artifacts").delete()
      .eq("user_id", user.id).eq("type", "overview_analysis");
    await supabase.from("ai_artifacts").insert({
      user_id: user.id,
      type: "overview_analysis",
      title: "Overview Analysis",
      data: {
        playbook: prev?.playbook ?? null,
        simulatedIdeas: mergedIdeas,
        weeklyCalendar: prev?.weeklyCalendar ?? [],
      },
      pinned: false,
    });

    return NextResponse.json({ ideas });
  } catch (err) {
    console.error("[ideas/generate] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
