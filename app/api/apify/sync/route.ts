import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncProfile } from "@/lib/apify/scraper";

export const maxDuration = 300;

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

  const result = await syncProfile(supabase, platform, username.trim(), user.id, false);

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
