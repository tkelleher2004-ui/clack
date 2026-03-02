// Must be imported before @anthropic-ai/sdk to force fetch-based runtime in Edge
import "@anthropic-ai/sdk/shims/web";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "edge";

const SYSTEM_PROMPT = `You are Clack AI — an expert social media marketing strategist. You are the user's personal marketing brain.

Your personality: Direct, confident, data-driven. You speak like a knowledgeable friend, not a corporate advisor. Give specific, actionable advice — never vague platitudes. Celebrate wins. Be honest about what's not working.

Your capabilities: Analyze social media content and metrics. Identify what works and what doesn't with specific reasoning. Generate content plans. Score content for virality (1-10). Identify trends and content gaps. Platform-specific advice for Instagram, TikTok, YouTube, LinkedIn, X.

Rules:
- Learn goals through natural conversation, never forms
- If no accounts connected, still be useful: general strategy, algorithms, trends
- If accounts connected, reference specific posts, metrics, dates
- Keep responses concise but thorough
- Use markdown sparingly — bold for emphasis only
- Never say 'as an AI' or 'I don't have access to' — stay in character as their strategist`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("[chat] ANTHROPIC_API_KEY is not set");
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  if (!apiKey.startsWith("sk-ant-")) {
    console.error("[chat] ANTHROPIC_API_KEY does not start with sk-ant- — key may be malformed");
  }

  let body: { messages: Array<{ role: string; content: string }> };
  try {
    body = await req.json();
  } catch (e) {
    console.error("[chat] Failed to parse request body:", e);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey });

  const anthropicMessages: Array<{ role: "user" | "assistant"; content: string }> =
    messages.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

  try {
    const stream = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: anthropicMessages,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta" &&
              event.delta.text
            ) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              );
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
    // Log the full error object for debugging — Anthropic APIError has status, headers, and body
    console.error("[chat] Claude API error — full object:", err);

    if (err instanceof Anthropic.APIError) {
      console.error("[chat] status:", err.status);
      console.error("[chat] message:", err.message);
      console.error("[chat] error body:", JSON.stringify(err.error));
      return NextResponse.json(
        { error: `Anthropic API error ${err.status}: ${err.message}` },
        { status: err.status ?? 500 }
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error("[chat] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
