import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * DEBUG ROUTE — Remove after troubleshooting
 * GET /api/debug — Returns DB state for the current user (must be logged in)
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Not authenticated", authError: authError?.message },
      { status: 401 }
    );
  }

  const userId = user.id;

  // Count social_posts
  const { count: postsCount, error: postsCountErr } = await supabase
    .from("social_posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  // Count social_accounts
  const { count: accountsCount, error: accountsCountErr } = await supabase
    .from("social_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  // Full TikTok account row (all columns except access_token/refresh_token for security)
  const { data: tiktokAccount, error: tiktokErr } = await supabase
    .from("social_accounts")
    .select("id, user_id, platform, platform_account_id, username, display_name, profile_image_url, account_data, last_synced_at, created_at, updated_at")
    .eq("user_id", userId)
    .eq("platform", "tiktok")
    .maybeSingle();

  // First 3 social_posts (all columns)
  const { data: firstPosts, error: postsErr } = await supabase
    .from("social_posts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(3);

  return NextResponse.json({
    user_id: userId,
    user_email: user.email,
    social_posts: {
      count: postsCount ?? 0,
      countError: postsCountErr?.message ?? null,
      firstThree: firstPosts ?? [],
      firstThreeError: postsErr?.message ?? null,
    },
    social_accounts: {
      count: accountsCount ?? 0,
      countError: accountsCountErr?.message ?? null,
      tiktok: tiktokAccount ?? null,
      tiktokError: tiktokErr?.message ?? null,
    },
    hasData:
      (accountsCount ?? 0) > 0 &&
      (postsCount ?? 0) > 0,
  });
}
