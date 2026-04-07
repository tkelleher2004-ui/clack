import { createClient } from "@supabase/supabase-js";

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

  const accessToken: string = account.access_token;
  const pageId = account.platform_account_id;

  onProgress?.("Syncing posts...");

  const posts: Array<{
    id: string;
    message?: string;
    created_time?: string;
    full_picture?: string;
    permalink_url?: string;
    type?: string;
  }> = [];
  let nextUrl: string | null =
    `https://graph.facebook.com/v18.0/${pageId}/feed?fields=id,message,created_time,full_picture,permalink_url,type&limit=50&access_token=${accessToken}`;

  while (nextUrl) {
    const res = await fetch(nextUrl);

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

  const postRows = posts.map((p) => {
    const contentType =
      p.type === "video" ? "video" : p.type === "photo" ? "image" : "text";

    return {
      user_id: account.user_id,
      social_account_id: accountId,
      platform: "facebook" as const,
      platform_post_id: p.id,
      content_type: contentType,
      caption: p.message ?? null,
      thumbnail_url: p.full_picture ?? null,
      media_url: p.permalink_url ?? p.full_picture ?? null,
      permalink: p.permalink_url ?? null,
      posted_at: p.created_time ?? null,
      metrics: { likes: 0, comments: 0, impressions: 0 },
    };
  });

  if (postRows.length > 0) {
    const { error: postsErr } = await supabase
      .from("social_posts")
      .upsert(postRows, { onConflict: "platform,platform_post_id" });
    if (postsErr) throw new Error(`Failed to save posts: ${postsErr.message}`);
  }

  onProgress?.("Pulling analytics...");

  const pageRes = await fetch(
    `https://graph.facebook.com/v18.0/${pageId}?fields=fan_count,name&access_token=${accessToken}`
  );

  const existingData = (account.account_data ?? {}) as Record<string, unknown>;
  let updatedAccountData = { ...existingData };

  if (pageRes.ok) {
    const pageData = (await pageRes.json()) as { fan_count?: number; name?: string };
    updatedAccountData = {
      ...updatedAccountData,
      followers_count: pageData.fan_count ?? existingData.followers_count ?? 0,
    };
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
