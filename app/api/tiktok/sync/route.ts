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

  if (!tokenData.access_token || tokenData.error) {
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

      const listRes = await fetch(
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

      if (!listRes.ok) {
        const errText = await listRes.text();
        console.error("[tiktok/sync] Video list error:", errText);
        return NextResponse.json(
          { error: "Failed to fetch videos from TikTok" },
          { status: 500 }
        );
      }

      const listData = (await listRes.json()) as {
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
        error?: { code?: string; message?: string };
      };

      if (listData.error) {
        console.error("[tiktok/sync] API error:", listData.error);
        return NextResponse.json(
          { error: listData.error.message ?? "TikTok API error" },
          { status: 500 }
        );
      }

      const videos = listData.data?.videos ?? [];
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
      const { error: postsError } = await supabase
        .from("social_posts")
        .upsert(postsToInsert, {
          onConflict: "platform,platform_post_id",
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
