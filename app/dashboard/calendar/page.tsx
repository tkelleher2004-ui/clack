import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarClient } from "./CalendarClient";

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the AI-generated weekly calendar and posted ideas
  const [{ data: analysisRow }, { data: postedIdeas }, { data: recentPosts }] = await Promise.all([
    supabase
      .from("ai_artifacts")
      .select("data")
      .eq("user_id", user.id)
      .eq("type", "overview_analysis")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("ai_artifacts")
      .select("id, data, created_at")
      .eq("user_id", user.id)
      .eq("type", "posted_idea")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("social_posts")
      .select("id, caption, platform, posted_at, metrics")
      .eq("user_id", user.id)
      .order("posted_at", { ascending: false })
      .limit(30),
  ]);

  type AnalysisShape = {
    simulatedIdeas?: Array<{
      title: string;
      format: string;
      viewsMin: number;
      viewsMax: number;
      signal: string;
      hook?: string;
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

  const analysis = analysisRow?.data as AnalysisShape | null;

  return (
    <CalendarClient
      weeklyCalendar={analysis?.weeklyCalendar ?? []}
      ideas={analysis?.simulatedIdeas ?? []}
      postedIdeas={(postedIdeas ?? []).map((p) => {
        const d = p.data as { title?: string; format?: string; posted_at?: string; matched_post_id?: string } | null;
        return {
          id: p.id,
          title: d?.title ?? "Unknown",
          format: d?.format ?? null,
          postedAt: d?.posted_at ?? p.created_at,
          matchedPostId: d?.matched_post_id ?? null,
        };
      })}
      recentPosts={(recentPosts ?? []).map((p) => ({
        id: p.id,
        caption: p.caption ?? "",
        platform: p.platform,
        postedAt: p.posted_at ?? "",
        views: ((p.metrics as Record<string, number> | null)?.views ?? (p.metrics as Record<string, number> | null)?.play_count) ?? 0,
      }))}
    />
  );
}
