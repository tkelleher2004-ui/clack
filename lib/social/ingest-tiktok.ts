import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decryptTokens } from "@/lib/crypto/tokens";

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

  let tokens: { access_token: string; refresh_token?: string; token_expires_at?: number };
  try {
    tokens = decryptTokens(account.encrypted_tokens);
  } catch {
    throw new Error("Failed to decrypt tokens");
  }

  const accessToken = await ensureValidToken(supabase, accountId, tokens);

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

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const hashtags = extractHashtags(v.video_description ?? v.title ?? "");

    await supabase.from("social_posts").upsert(
      {
        user_id: account.user_id,
        social_account_id: accountId,
        platform: "tiktok",
        post_type: "video",
        title: v.title ?? null,
        caption: v.video_description ?? null,
        hashtags: hashtags.length ? hashtags : null,
        thumbnail_url: v.cover_image_url ?? null,
        media_url: v.share_url ?? null,
        published_at: v.create_time ? new Date(v.create_time * 1000).toISOString() : null,
        external_post_id: v.id,
        raw_data: v as unknown as Record<string, unknown>,
      },
      { onConflict: "social_account_id,external_post_id" }
    );

    const views = v.view_count ?? 0;
    const likes = v.like_count ?? 0;
    const comments = v.comment_count ?? 0;
    const shares = v.share_count ?? 0;
    const engagementRate =
      views > 0 ? ((likes + comments + shares) / views) * 100 : 0;

    const { data: post } = await supabase
      .from("social_posts")
      .select("id")
      .eq("social_account_id", accountId)
      .eq("external_post_id", v.id)
      .single();

    if (post) {
      await supabase.from("post_analytics").upsert(
        {
          social_post_id: post.id,
          views,
          likes,
          comments,
          shares,
          engagement_rate: engagementRate,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "social_post_id" }
      );
    }

    onProgress?.(`Syncing posts... ${i + 1}/${videos.length}`);
  }

  onProgress?.("Pulling analytics...");

  const userRes = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,follower_count,following_count,video_count",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  let followerCount = account.follower_count ?? 0;
  if (userRes.ok) {
    const userData = (await userRes.json()) as {
      data?: { user?: { follower_count?: number; following_count?: number } };
    };
    followerCount = userData.data?.user?.follower_count ?? followerCount;
    await supabase.from("audience_data").insert({
      social_account_id: accountId,
      follower_count: followerCount,
      following_count: userData.data?.user?.following_count ?? 0,
      fetched_at: new Date().toISOString(),
    });
  }

  const totalViews = videos.reduce((s, v) => s + (v.view_count ?? 0), 0);
  const avgEngagement =
    videos.length > 0
      ? videos.reduce((s, v) => {
          const views = v.view_count ?? 0;
          const likes = v.like_count ?? 0;
          const comments = v.comment_count ?? 0;
          const shares = v.share_count ?? 0;
          return s + (views > 0 ? ((likes + comments + shares) / views) * 100 : 0);
        }, 0) / videos.length
      : 0;

  await supabase.from("channel_analytics").insert({
    social_account_id: accountId,
    total_views: totalViews,
    avg_engagement_rate: avgEngagement,
    posting_frequency: 0,
    top_content_types: ["video"],
    fetched_at: new Date().toISOString(),
  });

  await supabase
    .from("social_accounts")
    .update({
      sync_status: "synced",
      sync_progress: null,
      sync_error: null,
      last_synced_at: new Date().toISOString(),
      follower_count: followerCount,
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
    throw new Error("Token expired and no refresh token");
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
    throw new Error("Token refresh failed");
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const newExpires = data.expires_in ? Date.now() + data.expires_in * 1000 : undefined;

  const { encryptTokens } = await import("@/lib/crypto/tokens");
  const encrypted = encryptTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    token_expires_at: newExpires,
  });

  await supabase
    .from("social_accounts")
    .update({ encrypted_tokens: encrypted, updated_at: new Date().toISOString() })
    .eq("id", accountId);

  return data.access_token;
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w]+/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}
