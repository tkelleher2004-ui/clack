import { createClient } from "@supabase/supabase-js";

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

  // Refresh long-lived token if close to expiry (Instagram tokens expire in ~60 days)
  let accessToken: string = account.access_token;
  if (account.token_expires_at) {
    const expiresAt = new Date(account.token_expires_at).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (expiresAt < Date.now() + sevenDaysMs) {
      const appId = process.env.META_APP_ID;
      const appSecret = process.env.META_APP_SECRET;
      if (appId && appSecret) {
        try {
          const refreshUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
          refreshUrl.searchParams.set("grant_type", "fb_exchange_token");
          refreshUrl.searchParams.set("client_id", appId);
          refreshUrl.searchParams.set("client_secret", appSecret);
          refreshUrl.searchParams.set("fb_exchange_token", accessToken);
          const refreshRes = await fetch(refreshUrl.toString());
          if (refreshRes.ok) {
            const refreshData = (await refreshRes.json()) as {
              access_token?: string;
              expires_in?: number;
            };
            if (refreshData.access_token) {
              accessToken = refreshData.access_token;
              const newExpiresAt = refreshData.expires_in
                ? new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
                : null;
              await supabase
                .from("social_accounts")
                .update({
                  access_token: accessToken,
                  token_expires_at: newExpiresAt,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", accountId);
            }
          }
        } catch {
          // Token refresh is best-effort; continue with existing token
        }
      }
    }
  }

  const igUserId = account.platform_account_id;

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
  let nextUrl: string | null =
    `https://graph.facebook.com/v18.0/${igUserId}/media?fields=id,media_type,media_url,thumbnail_url,caption,timestamp,permalink,like_count,comments_count&limit=50&access_token=${accessToken}`;

  while (nextUrl) {
    const res = await fetch(nextUrl);

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

  const posts = media.map((m) => {
    const contentType =
      m.media_type === "VIDEO"
        ? "video"
        : m.media_type === "CAROUSEL_ALBUM"
          ? "carousel"
          : "image";

    return {
      user_id: account.user_id,
      social_account_id: accountId,
      platform: "instagram" as const,
      platform_post_id: m.id,
      content_type: contentType,
      caption: m.caption ?? null,
      thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
      media_url: m.media_url ?? m.permalink ?? null,
      permalink: m.permalink ?? null,
      posted_at: m.timestamp ?? null,
      metrics: {
        likes: m.like_count ?? 0,
        comments: m.comments_count ?? 0,
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

  const profileRes = await fetch(
    `https://graph.facebook.com/v18.0/${igUserId}?fields=followers_count,follows_count,media_count,name,username,biography,profile_picture_url&access_token=${accessToken}`
  );

  const existingData = (account.account_data ?? {}) as Record<string, unknown>;
  let updatedAccountData = { ...existingData };

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

    updatedAccountData = {
      ...updatedAccountData,
      followers_count: profile.followers_count ?? existingData.followers_count ?? 0,
      follows_count: profile.follows_count ?? existingData.follows_count ?? 0,
      media_count: profile.media_count ?? existingData.media_count ?? 0,
      biography: profile.biography ?? existingData.biography ?? null,
      profile_picture_url: profile.profile_picture_url ?? existingData.profile_picture_url ?? null,
    };

    const updatePayload: Record<string, unknown> = {
      account_data: updatedAccountData,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (profile.username) updatePayload.username = profile.username;
    if (profile.name) updatePayload.display_name = profile.name;
    if (profile.profile_picture_url) updatePayload.profile_image_url = profile.profile_picture_url;

    await supabase.from("social_accounts").update(updatePayload).eq("id", accountId);
  } else {
    await supabase
      .from("social_accounts")
      .update({
        account_data: updatedAccountData,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);
  }
}
