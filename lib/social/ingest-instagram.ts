import { createClient } from "@supabase/supabase-js";
import { decryptTokens } from "@/lib/crypto/tokens";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function ingestInstagram(accountId: string, onProgress?: (msg: string) => void) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: account, error: accErr } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (accErr || !account || account.platform !== "instagram") {
    throw new Error("Account not found or not Instagram");
  }

  let tokens: { access_token: string; refresh_token?: string; token_expires_at?: number };
  try {
    tokens = decryptTokens(account.encrypted_tokens);
  } catch {
    throw new Error("Failed to decrypt tokens");
  }

  const igUserId = account.external_account_id;
  const accessToken = tokens.access_token;

  onProgress?.("Syncing posts...");

  const media: Array<{
    id: string;
    media_type: string;
    media_url?: string;
    thumbnail_url?: string;
    caption?: string;
    timestamp?: string;
    permalink?: string;
    like_count?: number;
    comments_count?: number;
  }> = [];
  let nextUrl: string | null = `https://graph.facebook.com/v18.0/${igUserId}/media?fields=id,media_type,media_url,thumbnail_url,caption,timestamp,permalink,like_count,comments_count&limit=50`;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Instagram API error: ${err}`);
    }

    const data = (await res.json()) as {
      data?: typeof media;
      paging?: { next?: string };
    };

    if (data.data) media.push(...data.data);
    nextUrl = data.paging?.next ?? null;
    onProgress?.(`Syncing posts... ${media.length}+`);
  }

  onProgress?.(`Syncing posts... ${media.length}/${media.length}`);

  for (let i = 0; i < media.length; i++) {
    const m = media[i];
    const hashtags = extractHashtags(m.caption ?? "");

    const postType =
      m.media_type === "VIDEO"
        ? "video"
        : m.media_type === "CAROUSEL_ALBUM"
          ? "carousel"
          : "image";

    await supabase.from("social_posts").upsert(
      {
        user_id: account.user_id,
        social_account_id: accountId,
        platform: "instagram",
        post_type: postType,
        title: null,
        caption: m.caption ?? null,
        hashtags: hashtags.length ? hashtags : null,
        thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
        media_url: m.media_url ?? m.permalink ?? null,
        published_at: m.timestamp ?? null,
        external_post_id: m.id,
        raw_data: m as unknown as Record<string, unknown>,
      },
      { onConflict: "social_account_id,external_post_id" }
    );

    const views = 0;
    const likes = m.like_count ?? 0;
    const comments = m.comments_count ?? 0;
    const engagementRate = (likes + comments) > 0 ? ((likes + comments) / Math.max(likes + comments, 1)) * 100 : 0;

    const { data: post } = await supabase
      .from("social_posts")
      .select("id")
      .eq("social_account_id", accountId)
      .eq("external_post_id", m.id)
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

    onProgress?.(`Syncing posts... ${i + 1}/${media.length}`);
  }

  onProgress?.("Pulling analytics...");

  const profileRes = await fetch(
    `https://graph.facebook.com/v18.0/${igUserId}?fields=followers_count,follows_count,media_count,name,username,biography,profile_picture_url`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  let followerCount = account.follower_count ?? 0;
  let accountName = account.account_name;
  let accountAvatar = account.account_avatar_url;
  if (profileRes.ok) {
    const profile = (await profileRes.json()) as {
      followers_count?: number;
      follows_count?: number;
      media_count?: number;
      name?: string;
      username?: string;
      biography?: string;
      profile_picture_url?: string;
    };
    followerCount = profile.followers_count ?? followerCount;
    accountName = profile.username ?? profile.name ?? accountName;
    accountAvatar = profile.profile_picture_url ?? accountAvatar;
    await supabase.from("audience_data").insert({
      social_account_id: accountId,
      follower_count: followerCount,
      following_count: profile.follows_count ?? 0,
      fetched_at: new Date().toISOString(),
    });
  }

  const avgEngagement =
    media.length > 0
      ? media.reduce((s, m) => {
          const likes = m.like_count ?? 0;
          const comments = m.comments_count ?? 0;
          return s + (likes + comments);
        }, 0) / media.length
      : 0;

  const contentTypes = media.reduce(
    (acc, m) => {
      const t = m.media_type === "VIDEO" ? "video" : m.media_type === "CAROUSEL_ALBUM" ? "carousel" : "image";
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  await supabase.from("channel_analytics").insert({
    social_account_id: accountId,
    total_views: 0,
    avg_engagement_rate: avgEngagement,
    posting_frequency: 0,
    top_content_types: contentTypes,
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
      account_name: accountName,
      account_avatar_url: accountAvatar,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w]+/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}
