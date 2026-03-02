import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { Transcript } from "@/lib/types/video";

export type ClipType = "hook" | "value_bomb" | "emotional_peak" | "cta" | "story";

export interface AnalyzedClip {
  title: string;
  start_time: number;
  end_time: number;
  type: ClipType;
  score: number;
  reasoning: string;
  suggested_caption: string;
  suggested_hashtags: string[];
}

export interface ClipAnalysisResult {
  clips: AnalyzedClip[];
  summary: string;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

if (!process.env.ANTHROPIC_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn("ANTHROPIC_API_KEY is not set. Clip analysis will fail until configured.");
}

function buildPrompt(params: {
  transcript: Transcript;
  brandProfile: any | null;
}) {
  const { transcript, brandProfile } = params;

  const brandContext = brandProfile
    ? `
Brand profile:
- Business name: ${brandProfile.business_name}
- Industry: ${brandProfile.industry}
- Website: ${brandProfile.website_url}
- Target audience: ${brandProfile.target_audience}
- Audience age range: ${brandProfile.audience_age_range}
- Brand voice: ${brandProfile.brand_voice}
`
    : "Brand profile: (none provided, default to clear, engaging, educational tone).";

  return `
You are an AI video marketing strategist for short-form content (TikTok, Reels, Shorts, LinkedIn, X).

Your task:
- Analyze the following full transcript from a long-form video.
- Identify 3–7 of the strongest potential short-form clips.
- Each clip should be 15–90 seconds long.
- Focus on moments that are highly hooky, emotionally engaging, or deliver strong value.
- Make sure your suggestions align with the brand profile and audience.

${brandContext}

Transcript (structured with segments and timestamps):
${JSON.stringify(transcript, null, 2)}

You MUST respond with STRICT JSON ONLY in the following shape:
{
  "clips": [
    {
      "title": string,
      "start_time": number, // in seconds from start of video
      "end_time": number,   // in seconds from start of video
      "type": "hook" | "value_bomb" | "emotional_peak" | "cta" | "story",
      "score": number,      // 1-10, virality potential
      "reasoning": string,  // why this will perform well
      "suggested_caption": string,
      "suggested_hashtags": string[]
    }
  ],
  "summary": string
}

Requirements:
- 3–7 clips total.
- Each clip must be between 15 and 90 seconds.
- Use the existing timestamps from the transcript to set start_time and end_time precisely.
- Do NOT include any explanation outside of the JSON object.
`;
}

export async function analyzeTranscriptWithClaude(params: {
  videoId: string;
  transcript: Transcript;
}): Promise<ClipAnalysisResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: brandProfile } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const systemPrompt =
    "You are an expert short-form video strategist. You ONLY respond with strict JSON that matches the requested schema. Never include commentary.";

  const prompt = buildPrompt({
    transcript: params.transcript,
    brandProfile,
  });

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    temperature: 0.4,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  // We use streaming so that in the future the UI can surface progress;
  // for now we just await the full text response.
  const finalText = await stream.finalText();

  let parsed: ClipAnalysisResult;
  try {
    // Try to extract JSON if Claude wrapped it in markdown code blocks or added explanation
    let jsonText = finalText.trim();
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      const lines = jsonText.split('\n');
      const jsonStart = lines.findIndex(l => l.trim().startsWith('{'));
      const jsonEnd = lines.findIndex((l, i) => i > jsonStart && l.trim() === '```');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        jsonText = lines.slice(jsonStart, jsonEnd).join('\n');
      } else if (jsonStart >= 0) {
        jsonText = lines.slice(jsonStart).join('\n').replace(/```\s*$/, '');
      }
    }
    // Find the first { and last } to extract JSON object
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonText = jsonText.substring(firstBrace, lastBrace + 1);
    }
    parsed = JSON.parse(jsonText) as ClipAnalysisResult;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to parse Claude clip analysis JSON", err, finalText);
    throw new Error("Failed to parse clip analysis from Claude");
  }

  return parsed;
}

