import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function ingestLinkedIn(accountId: string, onProgress?: (msg: string) => void) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: account, error: accErr } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (accErr || !account || account.platform !== "linkedin") {
    throw new Error("Account not found or not LinkedIn");
  }

  const accessToken: string = account.access_token;

  onProgress?.("Syncing profile...");

  const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!profileRes.ok) {
    throw new Error("Failed to fetch LinkedIn profile");
  }

  const profile = (await profileRes.json()) as {
    sub?: string;
    name?: string;
    picture?: string;
  };

  onProgress?.("Syncing posts...");

  const posts: Array<{
    id: string;
    created?: number;
    commentary?: string;
  }> = [];

  try {
    const personId = (profile.sub ?? account.platform_account_id).replace(/-/g, "");
    const sharesRes = await fetch(
      `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(urn%3Ali%3Aperson%3A${personId})&count=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );

    if (sharesRes.ok) {
      const sharesData = (await sharesRes.json()) as {
        elements?: Array<{
          id?: string;
          createdAt?: number;
          commentary?: string;
        }>;
      };
      if (sharesData.elements) {
        for (const el of sharesData.elements) {
          if (el.id) {
            posts.push({
              id: el.id,
              created: el.createdAt,
              commentary: el.commentary,
            });
          }
        }
      }
    }
  } catch {
    // LinkedIn posts API may require additional permissions — continue with 0 posts
  }

  onProgress?.(`Syncing posts... ${posts.length}/${posts.length}`);

  const postRows = posts.map((p) => ({
    user_id: account.user_id,
    social_account_id: accountId,
    platform: "linkedin" as const,
    platform_post_id: p.id,
    content_type: "text" as const,
    caption: p.commentary ?? null,
    posted_at: p.created ? new Date(p.created).toISOString() : null,
    metrics: { likes: 0, comments: 0 },
  }));

  if (postRows.length > 0) {
    const { error: postsErr } = await supabase
      .from("social_posts")
      .upsert(postRows, { onConflict: "platform,platform_post_id" });
    if (postsErr) throw new Error(`Failed to save posts: ${postsErr.message}`);
  }

  onProgress?.("Pulling analytics...");

  const existingData = (account.account_data ?? {}) as Record<string, unknown>;

  await supabase
    .from("social_accounts")
    .update({
      account_data: {
        ...existingData,
        profile_picture_url: profile.picture ?? existingData.profile_picture_url ?? null,
      },
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);
}
