import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncProfile } from "@/lib/apify/scraper";

export const maxDuration = 300;

// POST — add / refresh a competitor
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json() as { platform?: string; username?: string };
  const { platform, username } = body;

  if (!platform || !username) {
    return NextResponse.json({ error: "platform and username are required" }, { status: 400 });
  }

  if (platform !== "tiktok" && platform !== "instagram") {
    return NextResponse.json({ error: "platform must be tiktok or instagram" }, { status: 400 });
  }

  const result = await syncProfile(supabase, platform, username.trim(), user.id, true);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    accountId: result.accountId,
    username: result.username,
    followers: result.followers,
    posts: result.posts,
  });
}

// GET — list saved competitors
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data } = await supabase
    .from("social_accounts")
    .select("id, platform, username, display_name, account_data, last_synced_at")
    .eq("user_id", user.id);

  const competitors = (data ?? []).filter(
    (a) => (a.account_data as { is_competitor?: boolean })?.is_competitor === true
  );

  return NextResponse.json({ competitors });
}

// DELETE — remove a competitor and their posts
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json() as { accountId?: string };
  const { accountId } = body;

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  await supabase.from("social_posts").delete().eq("social_account_id", accountId);
  await supabase.from("social_accounts").delete().eq("id", accountId).eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
