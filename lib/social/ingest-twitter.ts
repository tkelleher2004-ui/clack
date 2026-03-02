import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decryptTokens } from "@/lib/crypto/tokens";

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

  let tokens: { access_token: string; refresh_token?: string; token_expires_at?: number };
  try {
    tokens = decryptTokens(account.encrypted_tokens);
  } catch {
    throw new Error("Failed to decrypt tokens");
  }

  const accessToken = await ensureValidToken(supabase, accountId, tokens);
  const userId = account.external_account_id;

  onProgress?.("Syncing posts...");

  const tweets: Array<{
    id: string;
    text?: string;
    created_at?: string;
    public_metrics?: { like_count?: number; reply_count?: number; retweet_count?: number; impression_count?: number };
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

  for (let i = 0; i < tweets.length; i++) {
    const t = tweets[i];
    const hashtags = extractHashtags(t.text ?? "");

    await supabase.from("social_posts").upsert(
      {
        user_id: account.user_id,
        social_account_id: accountId,
        platform: "twitter",
        post_type: "text",
        title: null,
        caption: t.text ?? null,
        hashtags: hashtags.length ? hashtags : null,
        thumbnail_url: null,
        media_url: `https://twitter.com/i/status/${t.id}`,
        published_at: t.created_at ?? null,
        external_post_id: t.id,
        raw_data: t as unknown as Record<string, unknown>,
      },
      { onConflict: "social_account_id,external_post_id" }
    );

    const metrics = t.public_metrics ?? {};
    const impressions = metrics.impression_count ?? 0;
    const likes = metrics.like_count ?? 0;
    const replies = metrics.reply_count ?? 0;
    const retweets = metrics.retweet_count ?? 0;
    const engagementRate =
      impressions > 0 ? ((likes + replies + retweets) / impressions) * 100 : 0;

    const { data: postRow } = await supabase
      .from("social_posts")
      .select("id")
      .eq("social_account_id", accountId)
      .eq("external_post_id", t.id)
      .single();

    if (postRow) {
      await supabase.from("post_analytics").upsert(
        {
          social_post_id: postRow.id,
          views: impressions,
          likes,
          comments: replies,
          shares: retweets,
          impressions,
          engagement_rate: engagementRate,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "social_post_id" }
      );
    }

    onProgress?.(`Syncing posts... ${i + 1}/${tweets.length}`);
  }

  onProgress?.("Pulling analytics...");

  const userRes = await fetch(
    `https://api.twitter.com/2/users/${userId}?user.fields=public_metrics`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  let followerCount = account.follower_count ?? 0;
  if (userRes.ok) {
    const userData = (await userRes.json()) as {
      data?: { public_metrics?: { followers_count?: number; following_count?: number } };
    };
    followerCount = userData.data?.public_metrics?.followers_count ?? followerCount;
    await supabase.from("audience_data").insert({
      social_account_id: accountId,
      follower_count: followerCount,
      following_count: userData.data?.public_metrics?.following_count ?? 0,
      fetched_at: new Date().toISOString(),
    });
  }

  const totalImpressions = tweets.reduce(
    (s, t) => s + (t.public_metrics?.impression_count ?? 0),
    0
  );
  const avgEngagement =
    tweets.length > 0
      ? tweets.reduce((s, t) => {
          const imp = t.public_metrics?.impression_count ?? 0;
          const likes = t.public_metrics?.like_count ?? 0;
          const replies = t.public_metrics?.reply_count ?? 0;
          const rts = t.public_metrics?.retweet_count ?? 0;
          return s + (imp > 0 ? ((likes + replies + rts) / imp) * 100 : 0);
        }, 0) / tweets.length
      : 0;

  await supabase.from("channel_analytics").insert({
    social_account_id: accountId,
    total_views: totalImpressions,
    avg_engagement_rate: avgEngagement,
    posting_frequency: 0,
    top_content_types: ["text"],
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
