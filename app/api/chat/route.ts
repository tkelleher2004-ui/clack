import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getChatContext } from "@/lib/dashboard-data";

// Node.js runtime so we can use Supabase server client for auth
export const runtime = "nodejs";
export const maxDuration = 60;

function buildSystemPrompt(
  ctx: Awaited<ReturnType<typeof getChatContext>>,
  today: string
): string {
  const hasAccounts = ctx.accounts.length > 0;
  const hasPosts = ctx.top20Posts.length > 0;

  const accountsBlock = hasAccounts
    ? `CONNECTED ACCOUNTS:\n${ctx.accounts
        .map((a) => `- ${a.platform}: @${a.username}, ${a.followers.toLocaleString()} followers`)
        .join("\n")}`
    : "CONNECTED ACCOUNTS: None yet.";

  const postsBlock = hasPosts
    ? `TOP ${ctx.top20Posts.length} POSTS BY VIEWS:\n${ctx.top20Posts
        .map(
          (p) =>
            `${p.rank}. "${p.caption.slice(0, 80)}" | ${p.platform} | ${p.views.toLocaleString()} views | ${p.likes} likes | ${p.comments} comments | ${p.engagementRate}% eng rate | ${p.postType} | ${p.postedAt}`
        )
        .join("\n")}`
    : "TOP POSTS: No posts synced yet.";

  const patternBlock =
    ctx.patternEvidence.byFormat.length > 0
      ? `CONTENT PATTERNS:\nBy Format: ${ctx.patternEvidence.byFormat
          .map((f) => `${f.label} (avg ${f.avgViews.toLocaleString()} views${f.isTop ? " ★" : ""})`)
          .join(", ")}\nBy Topic: ${ctx.patternEvidence.byTopic
          .map((t) => `${t.label} (avg ${t.avgViews.toLocaleString()} views${t.isTop ? " ★" : ""})`)
          .join(", ")}`
      : "";

  const playbookBlock = ctx.playbook
    ? `PROVEN PLAYBOOK:\nAlways: ${ctx.playbook.always.join(" | ")}\nNever: ${ctx.playbook.never.join(" | ")}\nOptimal specs: ${ctx.playbook.optimalSpecs.duration} duration, ${ctx.playbook.optimalSpecs.postTime} post time`
    : "";

  const goalBlock = ctx.userGoal
    ? `CURRENT USER GOAL:\nPrimary goal: ${ctx.userGoal.primaryGoal}\nCurrent focus: ${ctx.userGoal.currentFocus}\nWeekly target: ${ctx.userGoal.weeklyTarget}`
    : "CURRENT USER GOAL: Not yet set.";

  const ideasBlock =
    ctx.simulatedIdeas.length > 0
      ? `CURRENT CONTENT IDEAS IN QUEUE:\n${ctx.simulatedIdeas
          .map((i) => `- "${i.title}" (${i.format}, ${i.viewsMin.toLocaleString()}–${i.viewsMax.toLocaleString()} views, signal: ${i.signal})`)
          .join("\n")}`
      : "";

  const postedIdeasBlock =
    ctx.postedIdeas.length > 0
      ? `IDEAS THE USER ALREADY POSTED (track outcomes!):\n${ctx.postedIdeas
          .map((p) => `- "${p.title}" (${p.format ?? "unknown format"}) — posted ${new Date(p.postedAt).toLocaleDateString()}`)
          .join("\n")}`
      : "";

  const calendarBlock =
    ctx.weeklyCalendar.length > 0
      ? `CONTENT CALENDAR (CURRENT WEEK):\n${ctx.weeklyCalendar
          .map((d) => `${d.day} ${d.date}: "${d.title}" — ${d.status}${d.status !== "REST" ? ` (${d.viewsMin.toLocaleString()}–${d.viewsMax.toLocaleString()} views projected)` : ""}`)
          .join("\n")}`
      : "";

  const postingBlock = ctx.postingStats.totalPostCount > 0
    ? `POSTING ACTIVITY:\n- Total posts: ${ctx.postingStats.totalPostCount}\n- Avg posts per week: ${ctx.postingStats.avgPostsPerWeek}${ctx.postingStats.daysSinceLastPost !== null ? `\n- Days since last post: ${ctx.postingStats.daysSinceLastPost}` : ""}`
    : "";

  return `You are Clack, an elite social media growth strategist with deep expertise in TikTok and Instagram algorithm mechanics, viral content psychology, hook engineering, and creator monetization. You are not a generic AI assistant. You are a specialist who has studied thousands of viral videos, understands exactly why content spreads, and gives brutally honest, specific, actionable advice.

Your job is to help this creator grow their audience and achieve their goals as fast as possible. You have access to their complete content history, performance data, and current goals. Use all of it.

Today: ${today}

${accountsBlock}

${postsBlock}

${patternBlock}

${playbookBlock}

${goalBlock}

${ideasBlock}

${postedIdeasBlock}

${calendarBlock}

${postingBlock}

WHAT YOU KNOW ABOUT VIRAL CONTENT:
- Hooks are everything. The first 1-3 seconds determine 80% of performance. The best hooks create an information gap, make a bold claim, or use pattern interruption. "You probably haven't heard of this" outperforms "Here are 3 tips" by 3-5x consistently.
- The algorithm rewards watch time and replays above all else. Content that makes people rewatch or pause outperforms content that gets likes.
- 3-item lists consistently outperform all other formats because they create a completion loop — viewers stay to see all 3.
- Contrast hooks ("X vs Y", "before vs after", "45 seconds vs 45 hours") drive 2-3x more shares than informational hooks.
- Posting consistency matters more than posting frequency. 3 posts per week every week beats 7 posts one week and 0 the next.
- Comments are more valuable than likes for algorithmic distribution. Content that asks a genuine question or takes a controversial stance drives comments. CTAs like "comment AI" are dying — they signal bait to the algorithm.
- The first post after a gap needs to be your strongest possible content. Coming back with weak content after a break tanks your recovery.
- Niche content gets shared within the niche. Broad hooks with niche payoffs get shared everywhere.
- Personal story content (income reveals, failure stories, behind the scenes) drives followers more than educational content.
- Series content (build in public, weekly updates) creates return viewers which the algorithm heavily weights.

HOW TO ANALYZE THEIR DATA:
- Look at engagement rate not just views. High views low engagement = algorithmic push that didn't convert. Low views high engagement = niche content that resonates deeply.
- Their top performers reveal their "unlock format" — the specific combination of hook style, topic, and format that their audience responds to most.
- Posts that underperformed reveal what their audience doesn't want — never recommend similar content.
- Posting time patterns matter — if their top posts cluster around specific times, that's signal.

HOW TO HANDLE GOAL CHANGES:
When the user wants to pivot their content direction, do NOT just adjust their existing topics slightly. Execute a real pivot. Their historical data informs their STYLE (hook format, duration, posting cadence) but their new goal drives TOPICS entirely. If they say they want to talk about AI news instead of AI agencies, generate ideas entirely about AI news using their proven hook styles and formats. Do not blend in the old topic just because it performed well historically.

HOW TO GIVE ADVICE:
- Always be specific. Never say "post more consistently" — say "you haven't posted in 11 days, post tomorrow, your first post back should be X because it matches your highest-performing format."
- Reference their actual data. "Your 3-list format averages 1.3K views vs 614 for tutorials — use a 3-list format for this."
- Give them the hook word for word, not just the concept.
- When you recommend an idea, give the hook, the structure, and the one thing that will make or break it.
- Be direct about what's not working. If their CTAs are tanking their reach, tell them.
- Prioritize ruthlessly. They can only post so many times per week. Tell them exactly what to post first and why.
- Never ask what their niche is, what platform they use, or what their goal is — you already know.
- Lead with insights, not questions.
- Keep responses concise but specific.
- Use markdown sparingly — bold for emphasis only.
- Never say "as an AI" or "I don't have access to".
- If no accounts are connected, still give useful strategy advice based on the goal.

GOAL UPDATE INSTRUCTIONS:
After every message, include a JSON block in this exact format as the very last thing in your response, wrapped in <goal_update> tags. Set goalUpdate to null when no goal change occurred. Set dashboardRefresh to true any time the user mentions a topic change, audience shift, new goal, content strategy change, OR whenever you generate content_idea artifacts.

When dashboardRefresh is true due to a goal/focus change, your visible response MUST explicitly say: "Done — I've updated your focus to [new focus]. Your dashboard is regenerating..." Make sure currentFocus is specific enough that the idea generation system can use it — "AI TikToker covering news, tool reviews, and build in public for Clack" is good, "broader content" is useless.

When dashboardRefresh is true because you generated content ideas, your visible response does NOT need any special text — just set dashboardRefresh:true so the dashboard updates silently.

<goal_update>
{"goalUpdate":null,"dashboardRefresh":false,"refreshReason":"no changes"}
</goal_update>

POST SCORING:
If the user pastes a post idea, title, or hook, automatically return a post_score artifact:

<artifact type="post_score">
{"title":"their post title","predictedViewsMin":N,"predictedViewsMax":N,"engagementScore":N,"strengths":["..."],"improvements":["..."],"verdict":"strong|moderate|weak"}
</artifact>

CONTENT IDEAS:
If asked for content ideas, return a content_idea artifact for each idea:

<artifact type="content_idea">
{"title":"...","format":"3-list|story|how-to|compare|opinion","duration":"45s","predictedViewsMin":N,"predictedViewsMax":N,"hook":"best hook line","script":"full post script or outline"}
</artifact>

Artifacts are rendered as rich cards — keep their JSON tight and accurate.`;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  // Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { messages: Array<{ role: string; content: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  // Fetch full context server-side, passing latest user message for relevance scoring
  const latestUserMsg = [...messages].reverse().find(m => m.role === "user")?.content;
  let ctx: Awaited<ReturnType<typeof getChatContext>>;
  try {
    ctx = await getChatContext(user.id, latestUserMsg);
  } catch (err) {
    console.error("[chat] getChatContext error:", err);
    // Fallback to empty context rather than failing the request
    ctx = {
      accounts: [],
      top20Posts: [],
      patternEvidence: { byFormat: [], byTopic: [] },
      playbook: null,
      userGoal: null,
      simulatedIdeas: [],
      postedIdeas: [],
      weeklyCalendar: [],
      postingStats: { daysSinceLastPost: null, avgPostsPerWeek: 0, totalPostCount: 0 },
    };
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const systemPrompt = buildSystemPrompt(ctx, today);

  const anthropic = new Anthropic({ apiKey });

  // Token management: estimate tokens (~4 chars per token) and truncate old messages
  // Keep system prompt budget (~3000 tokens) + response budget (4096) within 128k context
  const MAX_MESSAGE_TOKENS = 80_000;
  const estimateTokens = (text: string) => Math.ceil(text.length / 4);

  let anthropicMessages: Array<{ role: "user" | "assistant"; content: string }> =
    messages.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

  // Truncate from the beginning if over budget, always keep the last message
  let totalTokens = anthropicMessages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  while (totalTokens > MAX_MESSAGE_TOKENS && anthropicMessages.length > 1) {
    const removed = anthropicMessages.shift()!;
    totalTokens -= estimateTokens(removed.content);
    // Ensure first message is always from user (Claude API requirement)
    if (anthropicMessages.length > 0 && anthropicMessages[0].role === "assistant") {
      const skipped = anthropicMessages.shift()!;
      totalTokens -= estimateTokens(skipped.content);
    }
  }

  try {
    const stream = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages,
      stream: true,
    });

    const encoder = new TextEncoder();
    let fullText = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta" &&
              event.delta.text
            ) {
              fullText += event.delta.text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              );
            }
          }

          // After stream: detect goal update
          const goalMatch = fullText.match(/<goal_update>\s*([\s\S]*?)\s*<\/goal_update>/);
          let dashboardRefreshSignaled = false;
          if (goalMatch) {
            try {
              const parsed = JSON.parse(goalMatch[1]);
              const goalUpdate = parsed.goalUpdate ?? null;
              const dashboardRefresh = parsed.dashboardRefresh ?? false;
              if (goalUpdate || dashboardRefresh) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ goalUpdate, dashboardRefresh })}\n\n`)
                );
                dashboardRefreshSignaled = dashboardRefresh;
              }
            } catch {
              // ignore malformed goal update
            }
          }

          // Extract content_idea artifacts and persist them to the overview cache
          const artifactRegex = /<artifact type="content_idea">\s*([\s\S]*?)\s*<\/artifact>/g;
          const ideaMatches = [...fullText.matchAll(artifactRegex)];
          if (ideaMatches.length >= 1) {
            const ideas: Array<{
              title: string; format: string; duration: string; confidence: string;
              viewsMin: number; viewsMax: number; engMin: number; engMax: number;
              followersMin: number; followersMax: number; signal: "POST" | "TEST" | "SKIP";
              hook?: string; scriptOutline?: string; matchedFormat?: string;
            }> = [];
            for (const m of ideaMatches) {
              try {
                const a = JSON.parse(m[1]);
                ideas.push({
                  title: a.title ?? "Untitled",
                  format: a.format ?? "story",
                  duration: a.duration ?? "45s",
                  confidence: "Proven",
                  viewsMin: a.predictedViewsMin ?? 5000,
                  viewsMax: a.predictedViewsMax ?? 15000,
                  engMin: 4.0,
                  engMax: 7.0,
                  followersMin: 50,
                  followersMax: 200,
                  signal: "POST" as const,
                  hook: a.hook,
                  scriptOutline: a.script,
                  matchedFormat: a.format ?? "story",
                });
              } catch { /* skip malformed */ }
            }
            if (ideas.length >= 1) {
              // Preserve existing playbook + calendar, replace only simulatedIdeas
              const { data: existing } = await supabase
                .from("ai_artifacts")
                .select("data")
                .eq("user_id", user.id)
                .eq("type", "overview_analysis")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              const prev = existing?.data as { playbook?: unknown; weeklyCalendar?: unknown[] } | null;

              await supabase.from("ai_artifacts").delete()
                .eq("user_id", user.id).eq("type", "overview_analysis");
              await supabase.from("ai_artifacts").insert({
                user_id: user.id,
                type: "overview_analysis",
                title: "Overview Analysis",
                data: { playbook: prev?.playbook ?? null, simulatedIdeas: ideas, weeklyCalendar: prev?.weeklyCalendar ?? [] },
                pinned: false,
              });

              if (!dashboardRefreshSignaled) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ goalUpdate: null, dashboardRefresh: true })}\n\n`)
                );
              }
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err) {
          console.error("[chat] Stream error:", err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[chat] Claude API error:", err);
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error ${err.status}: ${err.message}` },
        { status: err.status ?? 500 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
