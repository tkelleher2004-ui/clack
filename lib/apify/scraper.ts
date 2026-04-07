import { ApifyClient } from "apify-client";
import type { SupabaseClient } from "@supabase/supabase-js";

const TIKTOK_ACTOR = "clockworks/tiktok-scraper";
const IG_ACTOR = "apify/instagram-scraper";
const IG_PROFILE_ACTOR = "apify/instagram-profile-scraper";

function apify() {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set in environment");
  return new ApifyClient({ token });
}

// ── Raw scrapers ───────────────────────────────────────────────────────────────
// clockworks/tiktok-scraper: returns one item PER VIDEO, each with authorMeta embedded
// apify/instagram-scraper:   returns one item PER PROFILE with latestPosts array

export async function scrapeTikTok(username: string): Promise<Record<string, unknown>[]> {
  const handle = username.startsWith("@") ? username : `@${username}`;
  const run = await apify().actor(TIKTOK_ACTOR).call(
    { profiles: [`https://www.tiktok.com/${handle}`], resultsPerPage: 50 },
    { waitSecs: 240, memory: 512 }
  );
  const { items } = await apify().dataset(run.defaultDatasetId).listItems();
  return items as Record<string, unknown>[];
}

export async function scrapeInstagram(username: string): Promise<Record<string, unknown> | null> {
  const handle = username.startsWith("@") ? username.slice(1) : username;

  // Try the profile scraper first (returns 1 item per profile with posts embedded)
  try {
    const run = await apify().actor(IG_PROFILE_ACTOR).call(
      { usernames: [handle] },
      { waitSecs: 180, memory: 512 }
    );
    const { items } = await apify().dataset(run.defaultDatasetId).listItems();
    const profile = items[0] as Record<string, unknown> | undefined;
    // Only accept if we got a real profile object with a username field
    if (profile && profile.username) {
      console.log("[scrapeInstagram] profile-scraper keys:", Object.keys(profile));
      return profile;
    }
  } catch (e) {
    console.warn("[scrapeInstagram] profile-scraper failed, falling back:", e);
  }

  // Fallback: instagram-scraper (returns posts with ownerFullName/ownerUsername embedded)
  const run = await apify().actor(IG_ACTOR).call(
    { usernames: [handle], resultsLimit: 30 },
    { waitSecs: 180, memory: 512 }
  );
  const { items } = await apify().dataset(run.defaultDatasetId).listItems();

  // instagram-scraper may return posts (each item is a post with ownerUsername)
  // Check if first item looks like a profile or a post
  const first = items[0] as Record<string, unknown> | undefined;
  if (!first) return null;

  console.log("[scrapeInstagram] fallback actor keys:", Object.keys(first));

  // If it looks like a post (has shortCode / ownerUsername), synthesize a profile from posts
  if (first.shortCode || first.ownerUsername) {
    const posts = items as Record<string, unknown>[];
    return {
      username: first.ownerUsername ?? handle,
      fullName: first.ownerFullName ?? first.ownerUsername ?? handle,
      userId: first.ownerId ?? first.ownerUsername ?? handle,
      followersCount: first.ownerFollowersCount ?? 0,
      followsCount: 0,
      postsCount: posts.length,
      profilePicUrl: null,
      biography: null,
      latestPosts: posts,
    };
  }

  return first;
}

// ── Field extraction helpers ───────────────────────────────────────────────────

/**
 * Extract a follower/following count that may be a plain number or a GraphQL
 * edge object like { count: N }.
 */
function extractCount(
  value: unknown,
  fieldName: string,
  context: string
): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  if (typeof value === "object" && value !== null && "count" in value) {
    const n = Number((value as Record<string, unknown>).count);
    if (!Number.isNaN(n)) return n;
  }
  console.warn(`[scraper] ${context}: unexpected shape for "${fieldName}":`, value);
  return 0;
}

/**
 * Parse a TikTok createTime which may be Unix seconds (10 digits) or
 * milliseconds (13 digits).
 */
function parseTikTokTimestamp(createTime: unknown): string | null {
  if (createTime == null) return null;
  const n = Number(createTime);
  if (Number.isNaN(n) || n === 0) return null;
  // Unix seconds are <= ~2e10 through year 2286; ms timestamps are >1e12
  const ms = n > 1e11 ? n : n * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Parse an Instagram post timestamp which may be:
 *   - an ISO 8601 string  ("2024-03-01T12:00:00.000Z")
 *   - a Unix seconds number (1709294400)
 *   - a Unix milliseconds number
 */
function parseIgTimestamp(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    // ISO 8601 string — pass directly to Date
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    // Might still be a numeric string
    const n = Number(value);
    if (!Number.isNaN(n) && n > 0) {
      const ms = n > 1e11 ? n : n * 1000;
      const d2 = new Date(ms);
      if (!Number.isNaN(d2.getTime())) return d2.toISOString();
    }
    return null;
  }
  if (typeof value === "number") {
    const ms = value > 1e11 ? value : value * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function upsertAccount(
  supabase: SupabaseClient,
  accountRow: Record<string, unknown>,
  userId: string,
  platform: string
): Promise<string | null> {
  // Get the first matching account for this user+platform (handles multiple rows safely)
  const { data: rows } = await supabase
    .from("social_accounts")
    .select("id, access_token")
    .eq("user_id", userId)
    .eq("platform", platform)
    .limit(1);

  const existing = rows?.[0];

  if (existing?.id) {
    // Don't overwrite a real OAuth token with the placeholder
    const updateRow = { ...accountRow };
    if (existing.access_token && existing.access_token !== "apify_scraped") {
      delete updateRow.access_token;
    }
    // Don't update user_id or platform (immutable keys)
    delete updateRow.user_id;
    delete updateRow.platform;

    const { error } = await supabase
      .from("social_accounts")
      .update(updateRow)
      .eq("id", existing.id);
    if (error) console.error("[scraper] account update error:", error.message);
    return existing.id;
  }

  // No existing account — insert new one
  const { data, error } = await supabase
    .from("social_accounts")
    .insert(accountRow)
    .select("id")
    .single();

  if (error) {
    console.error("[scraper] account insert error:", error.message);
    return null;
  }
  return data?.id ?? null;
}

// ── Full sync ──────────────────────────────────────────────────────────────────

export interface SyncResult {
  success: boolean;
  accountId?: string;
  username?: string;
  followers?: number;
  posts?: number;
  error?: string;
}

export async function syncProfile(
  supabase: SupabaseClient,
  platform: "tiktok" | "instagram",
  username: string,
  userId: string,
  isCompetitor = false
): Promise<SyncResult> {
  try {
    if (platform === "tiktok") {
      const items = await scrapeTikTok(username);
      if (!items.length) return { success: false, error: "No data returned — check the username" };

      // Profile from first item's authorMeta
      const author = (items[0].authorMeta ?? {}) as Record<string, unknown>;

      // author.name is the @handle; nickName is the display name
      // Some actor versions omit name — fall back to the input username
      const rawName = String(author.name ?? author.uniqueId ?? "").replace(/^@/, "");
      const uname = rawName || username.replace(/^@/, "");

      if (!rawName) {
        console.warn(`[scraper] TikTok authorMeta missing name/uniqueId for username "${username}"; using input`);
      }

      // followers_count: actor uses "fans" but some versions emit "followerCount"
      const followersCount = extractCount(
        author.fans ?? author.followerCount,
        "fans/followerCount",
        `TikTok @${uname}`
      );
      if (author.fans == null && author.followerCount == null) {
        console.warn(`[scraper] TikTok @${uname}: no fans/followerCount in authorMeta`, author);
      }

      const accountRow = {
        user_id: userId,
        platform: "tiktok",
        platform_account_id: String(author.id ?? uname),
        username: uname,
        display_name: String(author.nickName ?? uname),
        access_token: "apify_scraped",
        account_data: {
          followers_count: followersCount,
          following_count: extractCount(author.following, "following", `TikTok @${uname}`),
          video_count: extractCount(author.video, "video", `TikTok @${uname}`),
          likes_count: extractCount(author.heart ?? author.heartCount, "heart/heartCount", `TikTok @${uname}`),
          avatar_url: author.avatar ?? null,
          biography: author.signature ?? null,
          is_competitor: isCompetitor,
        },
        last_synced_at: new Date().toISOString(),
      };

      const accountId = await upsertAccount(supabase, accountRow, userId, "tiktok");
      if (!accountId) return { success: false, error: "Failed to save account" };

      // Map each item as a video post
      const posts = items.flatMap((v) => {
        // Require a stable, deterministic post ID — skip if missing
        const postId = String(v.id ?? "").trim();
        if (!postId) {
          console.warn(`[scraper] TikTok @${uname}: skipping video with no id`, v);
          return [];
        }
        return [{
          user_id: userId,
          social_account_id: accountId,
          platform: "tiktok",
          platform_post_id: postId,
          content_type: "video",
          caption: String(v.text ?? ""),
          posted_at: parseTikTokTimestamp(v.createTime),
          permalink: String(v.webVideoUrl ?? ""),
          metrics: {
            views: extractCount(v.playCount, "playCount", `TikTok post ${postId}`),
            play_count: extractCount(v.playCount, "playCount", `TikTok post ${postId}`),
            likes: extractCount(v.diggCount, "diggCount", `TikTok post ${postId}`),
            like_count: extractCount(v.diggCount, "diggCount", `TikTok post ${postId}`),
            comments: extractCount(v.commentCount, "commentCount", `TikTok post ${postId}`),
            comment_count: extractCount(v.commentCount, "commentCount", `TikTok post ${postId}`),
            shares: extractCount(v.shareCount, "shareCount", `TikTok post ${postId}`),
            share_count: extractCount(v.shareCount, "shareCount", `TikTok post ${postId}`),
          },
        }];
      });

      let savedCount = 0;
      if (posts.length > 0) {
        const { error: postsErr } = await supabase
          .from("social_posts")
          .upsert(posts, { onConflict: "platform,platform_post_id", ignoreDuplicates: false });
        if (postsErr) console.error("[scraper] TT posts upsert error:", postsErr.message);
        else savedCount = posts.length;
      }

      return {
        success: true,
        accountId,
        username: uname,
        followers: followersCount,
        posts: savedCount,
      };
    }

    // ── Instagram ──
    const raw = await scrapeInstagram(username);
    if (!raw) return { success: false, error: "No data returned — check the username" };

    // Strip leading @ if present (some actors return "@username")
    const rawUsername = String(raw.username ?? username).replace(/^@/, "");
    const uname = rawUsername || username;

    const followersCount = extractCount(
      raw.followersCount ?? raw.followerCount ?? raw.edge_followed_by,
      "followersCount/edge_followed_by",
      `Instagram @${uname}`
    );
    if (raw.followersCount == null && raw.followerCount == null && raw.edge_followed_by == null) {
      console.warn(`[scraper] Instagram @${uname}: no followers field in raw profile`, Object.keys(raw));
    }

    const followingCount = extractCount(
      raw.followsCount ?? raw.followingCount ?? raw.edge_follow,
      "followsCount/edge_follow",
      `Instagram @${uname}`
    );

    const accountRow = {
      user_id: userId,
      platform: "instagram",
      platform_account_id: String(raw.userId ?? raw.id ?? raw.pk ?? uname),
      username: uname,
      display_name: String(raw.fullName ?? raw.full_name ?? uname),
      access_token: "apify_scraped",
      account_data: {
        followers_count: followersCount,
        following_count: followingCount,
        media_count: extractCount(raw.postsCount ?? raw.mediaCount, "postsCount/mediaCount", `Instagram @${uname}`),
        biography: raw.biography ?? raw.bio ?? null,
        profile_picture_url: raw.profilePicUrl ?? raw.profilePicUrlHD ?? raw.profile_pic_url ?? null,
        is_competitor: isCompetitor,
      },
      last_synced_at: new Date().toISOString(),
    };

    console.log("[syncProfile] IG account_data:", accountRow.account_data);

    const accountId = await upsertAccount(supabase, accountRow, userId, "instagram");
    if (!accountId) return { success: false, error: "Failed to save account" };

    // latestPosts, posts, or topPosts depending on actor
    const rawPosts = (raw.latestPosts ?? raw.posts ?? raw.topPosts ?? []) as Record<string, unknown>[];
    const igPosts = rawPosts.flatMap((p) => {
      // Prefer shortCode as the stable ID — it appears in the public URL and is
      // consistent across both actors. Fall back to code, then numeric id.
      // Never use Math.random() — a missing ID means we skip the post.
      const postId = String(p.shortCode ?? p.code ?? p.id ?? "").trim();
      if (!postId) {
        console.warn(`[scraper] Instagram @${uname}: skipping post with no id/shortCode`, p);
        return [];
      }

      const postedAt = parseIgTimestamp(p.timestamp ?? p.taken_at_timestamp);

      return [{
        user_id: userId,
        social_account_id: accountId,
        platform: "instagram",
        platform_post_id: postId,
        content_type: String(p.type ?? p.mediaType ?? "image").toLowerCase(),
        caption: String(p.caption ?? p.alt ?? ""),
        posted_at: postedAt,
        permalink: String(p.url ?? p.displayUrl ?? `https://instagram.com/p/${p.shortCode ?? p.code ?? postId}`),
        metrics: {
          views: extractCount(p.videoViewCount ?? p.video_view_count ?? p.videoPlayCount, "videoViewCount", `IG post ${postId}`),
          likes: extractCount(p.likesCount ?? p.likes ?? p.edge_liked_by, "likesCount/edge_liked_by", `IG post ${postId}`),
          comments: extractCount(p.commentsCount ?? p.comments ?? p.edge_media_to_comment, "commentsCount/edge_media_to_comment", `IG post ${postId}`),
        },
      }];
    });

    let savedCount = 0;
    if (igPosts.length > 0) {
      const { error: postsErr } = await supabase
        .from("social_posts")
        .upsert(igPosts, { onConflict: "platform,platform_post_id", ignoreDuplicates: false });
      if (postsErr) console.error("[scraper] IG posts upsert error:", postsErr.message);
      else savedCount = igPosts.length;
    }

    return {
      success: true,
      accountId,
      username: uname,
      followers: followersCount,
      posts: savedCount,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}
