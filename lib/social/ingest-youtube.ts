import { createClient, SupabaseClient } from "@supabase/supabase-js";

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

  const accessToken = await ensureValidToken(supabase, accountId, {
    access_token: account.access_token,
    refresh_token: account.refresh_token ?? undefined,
    token_expires_at: account.token_expires_at
      ? new Date(account.token_expires_at).getTime()
      : undefined,
  });

  const channelId = account.platform_account_id;

  onProgress?.("Syncing posts...");

  const videos: Array<{
    id: string;
    snippet: { title?: string; description?: string; publishedAt?: string; thumbnails?: { default?: { url?: string } } };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  }> = [];
  let pageToken: string | undefined;

  do {
    const listUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    listUrl.searchParams.set("part", "snippet");
    listUrl.searchParams.set("channelId", channelId);
    listUrl.searchParams.set("type", "video");
    listUrl.searchParams.set("maxResults", "50");
    if (pageToken) listUrl.searchParams.set("pageToken", pageToken);

    const listRes = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listRes.ok) {
      const err = await listRes.text();
      throw new Error(`YouTube API error: ${err}`);
    }

    const listData = (await listRes.json()) as {
      items?: Array<{ id?: { videoId?: string } }>;
      nextPageToken?: string;
    };

    const videoIds = (listData.items ?? [])
      .map((item) => item.id?.videoId)
      .filter(Boolean)
      .join(",");

    if (videoIds) {
      const detailRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (detailRes.ok) {
        const detailData = (await detailRes.json()) as { items?: typeof videos };
        videos.push(...(detailData.items ?? []));
      }
    }

    pageToken = listData.nextPageToken;
    onProgress?.(`Syncing posts... ${videos.length}+`);
  } while (pageToken);

  onProgress?.(`Syncing posts... ${videos.length}/${videos.length}`);

  const posts = videos.map((v) => {
    const snippet = v.snippet ?? {};
    const stats = v.statistics ?? {};
    const views = parseInt(stats.viewCount ?? "0", 10);
    const likes = parseInt(stats.likeCount ?? "0", 10);
    const comments = parseInt(stats.commentCount ?? "0", 10);

    return {
      user_id: account.user_id,
      social_account_id: accountId,
      platform: "youtube" as const,
      platform_post_id: v.id,
      content_type: "video" as const,
      caption: snippet.description ?? null,
      thumbnail_url: snippet.thumbnails?.default?.url ?? null,
      media_url: `https://www.youtube.com/watch?v=${v.id}`,
      permalink: `https://www.youtube.com/watch?v=${v.id}`,
      posted_at: snippet.publishedAt ?? null,
      metrics: { views, likes, comments },
    };
  });

  if (posts.length > 0) {
    const { error: postsErr } = await supabase
      .from("social_posts")
      .upsert(posts, { onConflict: "platform,platform_post_id" });
    if (postsErr) throw new Error(`Failed to save posts: ${postsErr.message}`);
  }

  onProgress?.("Pulling analytics...");

  const channelStatsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const existingData = (account.account_data ?? {}) as Record<string, unknown>;
  let updatedAccountData = { ...existingData };

  if (channelStatsRes.ok) {
    const channelData = (await channelStatsRes.json()) as {
      items?: Array<{
        statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
        snippet?: { title?: string; thumbnails?: { default?: { url?: string } } };
      }>;
    };
    const ch = channelData.items?.[0];
    if (ch) {
      updatedAccountData = {
        ...updatedAccountData,
        followers_count: parseInt(ch.statistics?.subscriberCount ?? "0", 10),
        total_views: parseInt(ch.statistics?.viewCount ?? "0", 10),
        video_count: parseInt(ch.statistics?.videoCount ?? "0", 10),
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
    console.warn("[ingest-youtube] Token refresh failed, using existing token");
    return tokens.access_token;
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    return tokens.access_token;
  }

  const newExpiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;

  await supabase
    .from("social_accounts")
    .update({
      access_token: data.access_token,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  return data.access_token;
}
