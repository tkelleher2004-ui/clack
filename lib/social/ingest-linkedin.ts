import { createClient } from "@supabase/supabase-js";
import { decryptTokens } from "@/lib/crypto/tokens";

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

  let tokens: { access_token: string; refresh_token?: string; token_expires_at?: number };
  try {
    tokens = decryptTokens(account.encrypted_tokens);
  } catch {
    throw new Error("Failed to decrypt tokens");
  }

  const accessToken = tokens.access_token;

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
    visibility?: string;
  }> = [];

  try {
    const personId = (profile.sub ?? account.external_account_id).replace(/-/g, "");
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
          visibility?: { comLinkedinUgcDistributionType?: string };
        }>;
      };
      if (sharesData.elements) {
        for (const el of sharesData.elements) {
          if (el.id) {
            posts.push({
              id: el.id,
              created: el.createdAt,
              commentary: el.commentary,
              visibility: el.visibility?.comLinkedinUgcDistributionType,
            });
          }
        }
      }
    }
  } catch {
    // LinkedIn posts API may require additional permissions (r_organization_social, etc.)
  }

  onProgress?.(`Syncing posts... ${posts.length}/${posts.length}`);

  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const hashtags = extractHashtags(p.commentary ?? "");

    await supabase.from("social_posts").upsert(
      {
        user_id: account.user_id,
        social_account_id: accountId,
        platform: "linkedin",
        post_type: "text",
        title: null,
        caption: p.commentary ?? null,
        hashtags: hashtags.length ? hashtags : null,
        thumbnail_url: null,
        media_url: null,
        published_at: p.created ? new Date(p.created).toISOString() : null,
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
      await supabase.from("post_analytics").upsert(
        {
          social_post_id: postRow.id,
          views: 0,
          likes: 0,
          comments: 0,
          engagement_rate: 0,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "social_post_id" }
      );
    }

    onProgress?.(`Syncing posts... ${i + 1}/${posts.length}`);
  }

  onProgress?.("Pulling analytics...");

  await supabase.from("audience_data").insert({
    social_account_id: accountId,
    follower_count: account.follower_count ?? 0,
    following_count: 0,
    fetched_at: new Date().toISOString(),
  });

  await supabase.from("channel_analytics").insert({
    social_account_id: accountId,
    total_views: 0,
    avg_engagement_rate: 0,
    posting_frequency: posts.length,
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w]+/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}
