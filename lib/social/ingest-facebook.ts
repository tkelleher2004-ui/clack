import { createClient } from "@supabase/supabase-js";
import { decryptTokens } from "@/lib/crypto/tokens";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function ingestFacebook(accountId: string, onProgress?: (msg: string) => void) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: account, error: accErr } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (accErr || !account || account.platform !== "facebook") {
    throw new Error("Account not found or not Facebook");
  }

  let tokens: { access_token: string; refresh_token?: string; token_expires_at?: number };
  try {
    tokens = decryptTokens(account.encrypted_tokens);
  } catch {
    throw new Error("Failed to decrypt tokens");
  }

  const accessToken = tokens.access_token;
  const pageId = account.external_account_id;

  onProgress?.("Syncing posts...");

  const posts: Array<{
    id: string;
    message?: string;
    created_time?: string;
    full_picture?: string;
    permalink_url?: string;
    type?: string;
  }> = [];
  let nextUrl: string | null = `https://graph.facebook.com/v18.0/${pageId}/feed?fields=id,message,created_time,full_picture,permalink_url,type&limit=50`;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Facebook API error: ${err}`);
    }

    const data = (await res.json()) as {
      data?: typeof posts;
      paging?: { next?: string };
    };

    if (data.data) posts.push(...data.data);
    nextUrl = data.paging?.next ?? null;
    onProgress?.(`Syncing posts... ${posts.length}+`);
  }

  onProgress?.(`Syncing posts... ${posts.length}/${posts.length}`);

  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const hashtags = extractHashtags(p.message ?? "");

    const postType = p.type === "video" ? "video" : p.type === "photo" ? "image" : "text";

    await supabase.from("social_posts").upsert(
      {
        user_id: account.user_id,
        social_account_id: accountId,
        platform: "facebook",
        post_type: postType,
        title: null,
        caption: p.message ?? null,
        hashtags: hashtags.length ? hashtags : null,
        thumbnail_url: p.full_picture ?? null,
        media_url: p.permalink_url ?? p.full_picture ?? null,
        published_at: p.created_time ?? null,
        external_post_id: p.id,
        raw_data: p as unknown as Record<string, unknown>,
      },
      { onConflict: "social_account_id,external_post_id" }
    );

    const { data: postRow } = await supabase
      .from("social_posts")
      .select("id")
      .eq("social_account_id", accountId)
      .eq("external_post_id", p.id)
      .single();

    if (postRow) {
      const insightsRes = await fetch(
        `https://graph.facebook.com/v18.0/${p.id}/insights?metric=post_impressions,post_engaged_users&access_token=${accessToken}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      let impressions = 0;
      let engagement = 0;
      if (insightsRes.ok) {
        const insights = (await insightsRes.json()) as {
          data?: Array<{ name: string; values?: Array<{ value?: number }> }>;
        };
        for (const m of insights.data ?? []) {
          const val = m.values?.[0]?.value ?? 0;
          if (m.name === "post_impressions") impressions = val;
          if (m.name === "post_engaged_users") engagement = val;
        }
      }

      const engagementRate = impressions > 0 ? (engagement / impressions) * 100 : 0;

      await supabase.from("post_analytics").upsert(
        {
          social_post_id: postRow.id,
          views: 0,
          likes: 0,
          comments: 0,
          reach: impressions,
          impressions,
          engagement_rate: engagementRate,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "social_post_id" }
      );
    }

    onProgress?.(`Syncing posts... ${i + 1}/${posts.length}`);
  }

  onProgress?.("Pulling analytics...");

  const pageRes = await fetch(
    `https://graph.facebook.com/v18.0/${pageId}?fields=fan_count&access_token=${accessToken}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  let followerCount = account.follower_count ?? 0;
  if (pageRes.ok) {
    const pageData = (await pageRes.json()) as { fan_count?: number };
    followerCount = pageData.fan_count ?? followerCount;
    await supabase.from("audience_data").insert({
      social_account_id: accountId,
      follower_count: followerCount,
      following_count: 0,
      fetched_at: new Date().toISOString(),
    });
  }

  const totalImpressions = 0;
  const avgEngagement = 0;

  await supabase.from("channel_analytics").insert({
    social_account_id: accountId,
    total_views: totalImpressions,
    avg_engagement_rate: avgEngagement,
    posting_frequency: posts.length,
    top_content_types: ["text", "image", "video"],
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

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w]+/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}
