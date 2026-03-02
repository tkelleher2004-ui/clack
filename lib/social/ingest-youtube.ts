import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { decryptTokens } from "@/lib/crypto/tokens";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function ingestYouTube(accountId: string, onProgress?: (msg: string) => void) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: account, error: accErr } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (accErr || !account || account.platform !== "youtube") {
    throw new Error("Account not found or not YouTube");
  }

  let tokens: { access_token: string; refresh_token?: string; token_expires_at?: number };
  try {
    tokens = decryptTokens(account.encrypted_tokens);
  } catch {
    throw new Error("Failed to decrypt tokens");
  }

  const accessToken = await ensureValidToken(supabase, accountId, tokens);
  const channelId = account.external_account_id;

  onProgress?.("Syncing posts...");

  const videos: Array<{
    id: string;
    snippet: { title?: string; description?: string; publishedAt?: string; thumbnails?: { default?: { url?: string } } };
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  }> = [];
  let pageToken: string | undefined;

  do {
    const listRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&maxResults=50&pageToken=${pageToken ?? ""}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listRes.ok) {
      const err = await listRes.text();
      throw new Error(`YouTube API error: ${err}`);
    }

    const listData = (await listRes.json()) as {
      items?: Array<{ id?: { videoId?: string }; snippet?: Record<string, unknown> }>;
      nextPageToken?: string;
    };

    for (const item of listData.items ?? []) {
      const videoId = item.id?.videoId;
      if (!videoId) continue;

      const detailRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!detailRes.ok) continue;

      const detailData = (await detailRes.json()) as { items?: typeof videos };
      const v = detailData.items?.[0];
      if (v) videos.push(v);
    }

    pageToken = listData.nextPageToken;
    onProgress?.(`Syncing posts... ${videos.length}+`);
  } while (pageToken);

  onProgress?.(`Syncing posts... ${videos.length}/${videos.length}`);

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const extId = v.id;
    const snippet = v.snippet ?? {};
    const hashtags = extractHashtags(snippet.description ?? snippet.title ?? "");

    await supabase.from("social_posts").upsert(
      {
        user_id: account.user_id,
        social_account_id: accountId,
        platform: "youtube",
        post_type: "video",
        title: snippet.title ?? null,
        caption: snippet.description ?? null,
        hashtags: hashtags.length ? hashtags : null,
        thumbnail_url: snippet.thumbnails?.default?.url ?? null,
        media_url: `https://www.youtube.com/watch?v=${extId}`,
        published_at: snippet.publishedAt ?? null,
        external_post_id: extId,
        raw_data: v as unknown as Record<string, unknown>,
      },
      { onConflict: "social_account_id,external_post_id" }
    );

    const stats = v.statistics ?? {};
    const views = parseInt(stats.viewCount ?? "0", 10);
    const likes = parseInt(stats.likeCount ?? "0", 10);
    const comments = parseInt(stats.commentCount ?? "0", 10);
    const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

    const { data: post } = await supabase
      .from("social_posts")
      .select("id")
      .eq("social_account_id", accountId)
      .eq("external_post_id", extId)
      .single();

    if (post) {
      await supabase.from("post_analytics").upsert(
        {
          social_post_id: post.id,
          views,
          likes,
          comments,
          engagement_rate: engagementRate,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "social_post_id" }
      );
    }

    onProgress?.(`Syncing posts... ${i + 1}/${videos.length}`);
  }

  onProgress?.("Pulling analytics...");

  const channelStatsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const channelStatsData = (await channelStatsRes.json()) as {
    items?: Array<{ statistics?: { subscriberCount?: string } }>;
  };
  const subCount = parseInt(
    channelStatsData?.items?.[0]?.statistics?.subscriberCount ??
      account.follower_count?.toString() ??
      "0",
    10
  );

  await supabase.from("audience_data").insert({
    social_account_id: accountId,
    follower_count: subCount,
    following_count: 0,
    fetched_at: new Date().toISOString(),
  });

  const totalViews = videos.reduce((s, v) => s + parseInt(v.statistics?.viewCount ?? "0", 10), 0);
  const avgEngagement =
    videos.length > 0
      ? videos.reduce((s, v) => {
          const vv = parseInt(v.statistics?.viewCount ?? "0", 10);
          const ll = parseInt(v.statistics?.likeCount ?? "0", 10);
          const cc = parseInt(v.statistics?.commentCount ?? "0", 10);
          return s + (vv > 0 ? ((ll + cc) / vv) * 100 : 0);
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
      follower_count: subCount,
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

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth not configured");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error("Token refresh failed");
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  const newExpires = data.expires_in ? Date.now() + data.expires_in * 1000 : undefined;

  const { encryptTokens } = await import("@/lib/crypto/tokens");
  const encrypted = encryptTokens({
    access_token: data.access_token,
    refresh_token: tokens.refresh_token,
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
