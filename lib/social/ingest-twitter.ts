import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function ingestTwitter(accountId: string, onProgress?: (msg: string) => void) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: account, error: accErr } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (accErr || !account || account.platform !== "twitter") {
    throw new Error("Account not found or not Twitter");
  }

  const accessToken = await ensureValidToken(supabase, accountId, {
    access_token: account.access_token,
    refresh_token: account.refresh_token ?? undefined,
    token_expires_at: account.token_expires_at
      ? new Date(account.token_expires_at).getTime()
      : undefined,
  });

  const userId = account.platform_account_id;

  onProgress?.("Syncing posts...");

  const tweets: Array<{
    id: string;
    text?: string;
    created_at?: string;
    public_metrics?: {
      like_count?: number;
      reply_count?: number;
      retweet_count?: number;
      impression_count?: number;
    };
  }> = [];
  let nextToken: string | undefined;

  do {
    const url = new URL(`https://api.twitter.com/2/users/${userId}/tweets`);
    url.searchParams.set("max_results", "100");
    url.searchParams.set("tweet.fields", "created_at,public_metrics");
    url.searchParams.set("exclude", "retweets");
    if (nextToken) url.searchParams.set("pagination_token", nextToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Twitter API error: ${err}`);
    }

    const data = (await res.json()) as {
      data?: typeof tweets;
      meta?: { next_token?: string };
    };

    if (data.data) tweets.push(...data.data);
    nextToken = data.meta?.next_token;
    onProgress?.(`Syncing posts... ${tweets.length}+`);
  } while (nextToken);

  onProgress?.(`Syncing posts... ${tweets.length}/${tweets.length}`);

  const posts = tweets.map((t) => {
    const metrics = t.public_metrics ?? {};
    return {
      user_id: account.user_id,
      social_account_id: accountId,
      platform: "twitter" as const,
      platform_post_id: t.id,
      content_type: "text" as const,
      caption: t.text ?? null,
      media_url: `https://twitter.com/i/status/${t.id}`,
      permalink: `https://twitter.com/i/status/${t.id}`,
      posted_at: t.created_at ?? null,
      metrics: {
        views: metrics.impression_count ?? 0,
        likes: metrics.like_count ?? 0,
        comments: metrics.reply_count ?? 0,
        shares: metrics.retweet_count ?? 0,
        impressions: metrics.impression_count ?? 0,
      },
    };
  });

  if (posts.length > 0) {
    const { error: postsErr } = await supabase
      .from("social_posts")
      .upsert(posts, { onConflict: "platform,platform_post_id" });
    if (postsErr) throw new Error(`Failed to save posts: ${postsErr.message}`);
  }

  onProgress?.("Pulling analytics...");

  const userRes = await fetch(
    `https://api.twitter.com/2/users/${userId}?user.fields=public_metrics`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const existingData = (account.account_data ?? {}) as Record<string, unknown>;
  let updatedAccountData = { ...existingData };

  if (userRes.ok) {
    const userData = (await userRes.json()) as {
      data?: { public_metrics?: { followers_count?: number; following_count?: number } };
    };
    if (userData.data?.public_metrics) {
      updatedAccountData = {
        ...updatedAccountData,
        followers_count: userData.data.public_metrics.followers_count ?? existingData.followers_count ?? 0,
        following_count: userData.data.public_metrics.following_count ?? existingData.following_count ?? 0,
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

  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Twitter OAuth not configured");
  }

  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    }),
  });

  if (!res.ok) {
    console.warn("[ingest-twitter] Token refresh failed, using existing token");
    return tokens.access_token;
  }

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

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
      refresh_token: data.refresh_token ?? tokens.refresh_token,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  return data.access_token;
}
