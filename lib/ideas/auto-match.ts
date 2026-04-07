import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * After a sync, check if any recently synced posts match unmatched "posted_idea" artifacts.
 * Uses word overlap between the idea title/hook and the post caption.
 */
export async function matchPostedIdeas(userId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // Get unmatched posted ideas
  const { data: ideas } = await supabase
    .from("ai_artifacts")
    .select("id, data")
    .eq("user_id", userId)
    .eq("type", "posted_idea")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!ideas || ideas.length === 0) return;

  const unmatched = ideas.filter((i) => {
    const d = i.data as { matched_post_id?: string | null } | null;
    return !d?.matched_post_id;
  });

  if (unmatched.length === 0) return;

  // Get recent posts (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: posts } = await supabase
    .from("social_posts")
    .select("id, caption, metrics, posted_at")
    .eq("user_id", userId)
    .gte("posted_at", thirtyDaysAgo)
    .order("posted_at", { ascending: false });

  if (!posts || posts.length === 0) return;

  // For each unmatched idea, find the best matching post
  for (const idea of unmatched) {
    const d = idea.data as { title?: string; hook?: string } | null;
    const ideaText = `${d?.title ?? ""} ${d?.hook ?? ""}`.toLowerCase();
    const ideaWords = ideaText.split(/\s+/).filter((w) => w.length > 3);
    if (ideaWords.length === 0) continue;

    let bestMatch: { id: string; score: number; metrics: Record<string, number> } | null = null;

    for (const post of posts) {
      const caption = (post.caption ?? "").toLowerCase();
      const matches = ideaWords.filter((w) => caption.includes(w)).length;
      const score = matches / ideaWords.length;
      // Require at least 30% word overlap
      if (score >= 0.3 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = {
          id: post.id,
          score,
          metrics: (post.metrics ?? {}) as Record<string, number>,
        };
      }
    }

    if (bestMatch) {
      await supabase
        .from("ai_artifacts")
        .update({
          data: {
            ...(idea.data as Record<string, unknown>),
            matched_post_id: bestMatch.id,
            matched_score: bestMatch.score,
            matched_metrics: bestMatch.metrics,
          },
        })
        .eq("id", idea.id);
    }
  }
}
