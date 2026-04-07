import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

const VIDEO_FIELDS = [
  "id",
  "title",
  "video_description",
  "create_time",
  "cover_image_url",
  "share_url",
  "duration",
  "like_count",
  "comment_count",
  "share_count",
  "view_count",
].join(",");

async function getValidAccessToken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  account: {
    id: string;
    access_token: string;
    refresh_token: string | null;
    token_expires_at: string | null;
  }
): Promise<string> {
  const expiresAt = account.token_expires_at
    ? new Date(account.token_expires_at).getTime()
    : 0;

  if (expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new Error("Token expired and no refresh token");
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new Error("TikTok OAuth not configured");
  }

  const tokenRes = await fetch(
    "https://open.tiktokapis.com/v2/oauth/token/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
      }),
    }
  );

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: { code?: string; message?: string };
  };

  const tokenErrCode = tokenData.error?.code?.toString().toLowerCase();
  if (!tokenData.access_token || (tokenData.error && tokenErrCode !== "ok")) {
    throw new Error("Token refresh failed");
  }

  const tokenExpiresAt =
    tokenData.expires_in != null
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

  await supabase
    .from("social_accounts")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? account.refresh_token,
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  return tokenData.access_token;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[tiktok/sync] Starting sync for user:", user.id, user.email);

  const body = await request.json().catch(() => ({}));
  const { social_account_id: accountId } = body as { social_account_id?: string };

  let query = supabase
    .from("social_accounts")
    .select("id, user_id, access_token, refresh_token, token_expires_at")
    .eq("user_id", user.id)
    .eq("platform", "tiktok");

  if (accountId) {
    query = query.eq("id", accountId);
  }

  const { data: account, error: accountError } = await query.maybeSingle();

  if (accountError || !account) {
    return NextResponse.json(
      { error: "No TikTok account found" },
      { status: 404 }
    );
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(supabase, {
      id: account.id,
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      token_expires_at: account.token_expires_at,
    });
  } catch (err) {
    console.error("[tiktok/sync] Token refresh failed:", err);
    return NextResponse.json(
      { error: "Session expired. Please reconnect your TikTok account." },
      { status: 401 }
    );
  }

  // Fetch and update profile — refreshes on every sync
  const userInfoFields = [
    "open_id",
    "union_id",
    "avatar_url",
    "avatar_large_url",
    "display_name",
    "username",
    "bio_description",
    "follower_count",
    "following_count",
    "likes_count",
    "video_count",
  ].join(",");

  try {
    const userInfoRes = await fetch(
      `https://open.tiktokapis.com/v2/user/info/?fields=${userInfoFields}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    const userInfoJson = (await userInfoRes.json()) as {
      data?: { user?: Record<string, unknown> };
      error?: { code?: string };
    };
    if (!userInfoJson.error && userInfoJson.data?.user) {
      const u = userInfoJson.data.user;
      const followerCount = (u.follower_count as number) ?? 0;
      const followingCount = (u.following_count as number) ?? 0;
      const likesCount = (u.likes_count as number) ?? 0;
      const videoCount = (u.video_count as number) ?? 0;
      const bio = (u.bio_description as string) ?? null;
      console.log("[tiktok/sync] Updating account profile:", {
        accountId: account.id,
        username: u.username,
        display_name: u.display_name,
        follower_count: followerCount,
      });
      const { error: profileUpdateErr } = await supabase
        .from("social_accounts")
        .update({
          username: (u.username as string) ?? null,
          display_name: (u.display_name as string) ?? null,
          profile_image_url: (u.avatar_large_url as string) ?? (u.avatar_url as string) ?? null,
          account_data: {
            open_id: u.open_id ?? null,
            union_id: u.union_id ?? null,
            follower_count: followerCount,
            following_count: followingCount,
            likes_count: likesCount,
            video_count: videoCount,
            bio,
            followers_count: followerCount,
            follows_count: followingCount,
            biography: bio,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);
      if (profileUpdateErr) {
        console.error("[tiktok/sync] Profile update error:", profileUpdateErr);
      } else {
        console.log("[tiktok/sync] Profile updated successfully");
      }
    }
  } catch (err) {
    console.warn("[tiktok/sync] User info fetch/update failed (non-fatal):", err);
    // Ignore — profile update is best-effort
  }

  const VIDEO_LIST_MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;

  try {
    const postsToInsert: Array<{
      user_id: string;
      social_account_id: string;
      platform: string;
      platform_post_id: string;
      content_type: string;
      caption: string | null;
      media_url: string | null;
      thumbnail_url: string | null;
      permalink: string | null;
      posted_at: string | null;
      metrics: Record<string, number>;
    }> = [];
    let cursor: number | undefined;

    do {
      const listBody: { max_count: number; cursor?: number } = { max_count: 20 };
      if (cursor != null) listBody.cursor = cursor;

      let listRes!: Response;
      let responseText = "";
      let lastError: string | null = null;

      for (let attempt = 0; attempt < VIDEO_LIST_MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
        listRes = await fetch(
        `https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(VIDEO_FIELDS)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(listBody),
        }
        );
        responseText = await listRes.text();
        const parsed = (() => {
          try {
            return JSON.parse(responseText) as { data?: { videos?: unknown[] }; error?: { code?: string } };
          } catch {
            return {};
          }
        })();
        const isInternalError =
          !listRes.ok || parsed.error?.code?.toString().toLowerCase() === "internal_error";
        const hasVideos = Array.isArray(parsed.data?.videos) && parsed.data.videos.length > 0;
        if (hasVideos || !isInternalError || attempt === VIDEO_LIST_MAX_RETRIES - 1) {
          break;
        }
        lastError = responseText;
        console.warn(`[tiktok/sync] internal_error on attempt ${attempt + 1}/${VIDEO_LIST_MAX_RETRIES}, retrying...`);
      }
      let listData: {
        data?: {
          videos?: Array<{
            id: string;
            title?: string;
            video_description?: string;
            create_time?: number;
            cover_image_url?: string;
            share_url?: string;
            duration?: number;
            like_count?: number;
            comment_count?: number;
            share_count?: number;
            view_count?: number;
          }>;
          cursor?: number;
          has_more?: boolean;
        };
        error?: { code?: string; message?: string; log_id?: string };
      };
      try {
        listData = JSON.parse(responseText) as typeof listData;
      } catch {
        listData = {};
      }

      // TikTok returns 5xx + internal_error but includes data: { cursor, has_more, videos }
      // Any response with a data object is usable — treat as success, even with empty videos
      const hasData = listData?.data && typeof listData.data === "object";
      const videos = Array.isArray(listData?.data?.videos) ? listData.data.videos : [];

      if (!hasData) {
        console.error("[tiktok/sync] Video list error (no data):", responseText.slice(0, 200));
        const errorMsg =
          listData?.error?.code === "internal_error"
            ? "TikTok's API returned an error. This often happens in Sandbox mode. Try again in a few minutes, or wait until your app is in Production."
            : "Failed to fetch videos from TikTok";
        return NextResponse.json({ error: errorMsg }, { status: 502 });
      }

      if (!listRes.ok) {
        console.warn("[tiktok/sync] HTTP", listRes.status, "with internal_error — treating as success (0 videos)");
      }

      for (const v of videos) {
        const metrics: Record<string, number> = {
          likes: v.like_count ?? 0,
          comments: v.comment_count ?? 0,
          shares: v.share_count ?? 0,
          views: v.view_count ?? 0,
        };

        postsToInsert.push({
          user_id: user.id,
          social_account_id: account.id,
          platform: "tiktok",
          platform_post_id: v.id,
          content_type: "video",
          caption: v.video_description ?? v.title ?? null,
          media_url: v.share_url ?? null,
          thumbnail_url: v.cover_image_url ?? null,
          permalink: v.share_url ?? null,
          posted_at:
            v.create_time != null
              ? new Date(v.create_time * 1000).toISOString()
              : null,
          metrics,
        });
      }

      cursor = listData.data?.has_more ? listData.data.cursor : undefined;
    } while (cursor != null);

    if (postsToInsert.length > 0) {
      console.log("[tiktok/sync] Upserting", postsToInsert.length, "posts for user_id:", user.id, "social_account_id:", account.id);
      console.log("[tiktok/sync] Sample post (first):", JSON.stringify(postsToInsert[0], null, 2));

      const { data: upsertData, error: postsError } = await supabase
        .from("social_posts")
        .upsert(postsToInsert, {
          onConflict: "platform,platform_post_id",
        })
        .select("id, user_id, platform_post_id");

      console.log("[tiktok/sync] Upsert response:", {
        error: postsError ? { code: postsError.code, message: postsError.message, details: postsError.details } : null,
        rowsReturned: upsertData?.length ?? 0,
        sampleIds: upsertData?.slice(0, 3).map((r) => r.id) ?? [],
      });

      if (postsError) {
        console.error("[tiktok/sync] Posts upsert error:", postsError);
        return NextResponse.json(
          { error: "Failed to save videos" },
          { status: 500 }
        );
      }
    }

    await supabase
      .from("social_accounts")
      .update({
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    await supabase.from("activity_log").insert({
      user_id: user.id,
      type: "posts_synced",
      description: `Synced ${postsToInsert.length} TikTok videos`,
      data: { platform: "tiktok", count: postsToInsert.length },
    });

    return NextResponse.json({
      success: true,
      posts_synced: postsToInsert.length,
    });
  } catch (err) {
    console.error("[tiktok/sync] Sync error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
