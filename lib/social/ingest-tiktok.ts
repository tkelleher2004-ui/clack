import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const VIDEO_FIELDS =
  "id,create_time,cover_image_url,share_url,video_description,duration,title,like_count,comment_count,share_count,view_count";

export async function ingestTikTok(accountId: string, onProgress?: (msg: string) => void) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: account, error: accErr } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (accErr || !account || account.platform !== "tiktok") {
    throw new Error("Account not found or not TikTok");
  }

  const accessToken = await ensureValidToken(supabase, accountId, {
    access_token: account.access_token,
    refresh_token: account.refresh_token ?? undefined,
    token_expires_at: account.token_expires_at
      ? new Date(account.token_expires_at).getTime()
      : undefined,
  });

  onProgress?.("Syncing posts...");

  const videos: Array<{
    id: string;
    create_time?: number;
    cover_image_url?: string;
    share_url?: string;
    video_description?: string;
    duration?: number;
    title?: string;
    like_count?: number;
    comment_count?: number;
    share_count?: number;
    view_count?: number;
  }> = [];
  let cursor: number | undefined;

  do {
    const body: { max_count: number; cursor?: number } = { max_count: 20 };
    if (cursor) body.cursor = cursor;

    const res = await fetch(
      `https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(VIDEO_FIELDS)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`TikTok API error: ${err}`);
    }

    const data = (await res.json()) as {
      data?: { videos?: typeof videos; cursor?: number; has_more?: boolean };
      error?: { code?: string };
    };

    if (data.data?.videos) videos.push(...data.data.videos);
    cursor = data.data?.has_more ? data.data.cursor : undefined;
    onProgress?.(`Syncing posts... ${videos.length}+`);
  } while (cursor);

  onProgress?.(`Syncing posts... ${videos.length}/${videos.length}`);

  const posts = videos.map((v) => ({
    user_id: account.user_id,
    social_account_id: accountId,
    platform: "tiktok" as const,
    platform_post_id: v.id,
    content_type: "video" as const,
    caption: v.video_description ?? v.title ?? null,
    thumbnail_url: v.cover_image_url ?? null,
    media_url: v.share_url ?? null,
    permalink: v.share_url ?? null,
    posted_at: v.create_time ? new Date(v.create_time * 1000).toISOString() : null,
    metrics: {
      views: v.view_count ?? 0,
      likes: v.like_count ?? 0,
      comments: v.comment_count ?? 0,
      shares: v.share_count ?? 0,
    },
  }));

  if (posts.length > 0) {
    const { error: postsErr } = await supabase
      .from("social_posts")
      .upsert(posts, { onConflict: "platform,platform_post_id" });
    if (postsErr) throw new Error(`Failed to save posts: ${postsErr.message}`);
  }

  onProgress?.("Pulling analytics...");

  const userRes = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,follower_count,following_count,video_count",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const existingData = (account.account_data ?? {}) as Record<string, unknown>;
  let updatedAccountData = { ...existingData };

  if (userRes.ok) {
    const userData = (await userRes.json()) as {
      data?: { user?: { follower_count?: number; following_count?: number; video_count?: number } };
    };
    if (userData.data?.user) {
      const u = userData.data.user;
      updatedAccountData = {
        ...updatedAccountData,
        followers_count: u.follower_count ?? existingData.followers_count ?? 0,
        following_count: u.following_count ?? existingData.following_count ?? 0,
        video_count: u.video_count ?? existingData.video_count ?? 0,
      };
    }
  }

  await supabase
    .from("social_accounts")
    .update({
      account_data: updatedAccountData,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);
}

async function ensureValidToken(
  supabase: SupabaseClient,
  accountId: string,
  tokens: { access_token: string; refresh_token?: string; token_expires_at?: number }
): Promise<string> {
  const expiresAt = tokens.token_expires_at ?? 0;
  const bufferMs = 5 * 60 * 1000;
  if (expiresAt > Date.now() + bufferMs) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    return tokens.access_token;
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new Error("TikTok OAuth not configured");
  }

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    }),
  });

  if (!res.ok) {
    // Token refresh failed — fall back to existing token rather than crashing
    console.warn("[ingest-tiktok] Token refresh failed, using existing token");
    return tokens.access_token;
  }

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: { code?: string };
  };

  if (!data.access_token) {
    console.warn("[ingest-tiktok] Token refresh returned no access_token, using existing");
    return tokens.access_token;
  }

  const newExpiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;

  await supabase
    .from("social_accounts")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? tokens.refresh_token,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  return data.access_token;
}
