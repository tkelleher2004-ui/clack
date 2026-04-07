import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("id, platform, username, display_name, account_data, last_synced_at")
    .eq("user_id", user.id);

  const result = ((accounts ?? []) as Array<{
    id: string;
    platform: string;
    username: string | null;
    display_name: string | null;
    account_data: Record<string, unknown> | null;
    last_synced_at: string | null;
  }>)
    .filter((a) => !a.account_data?.is_competitor)
    .map((a) => ({
      id: a.id,
      platform: a.platform,
      username: a.username ?? a.display_name ?? "",
      lastSyncedAt: a.last_synced_at,
      currentFollowers:
        (a.account_data?.followers_count as number) ??
        (a.account_data?.follower_count as number) ??
        0,
    }));

  return NextResponse.json({ accounts: result });
}
