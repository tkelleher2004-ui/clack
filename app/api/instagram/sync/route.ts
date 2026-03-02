import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  // Get the user's Instagram account
  let query = supabase
    .from("social_accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("platform", "instagram");

  if (accountId) {
    query = query.eq("id", accountId);
  }

  const { data: account, error: accountError } = await query.maybeSingle();

  if (accountError || !account) {
    return NextResponse.json({ error: "No Instagram account found" }, { status: 404 });
  }

  const accessToken = account.access_token;
  const igAccountId = account.platform_account_id;

  try {
    // Fetch recent media (up to 50 posts)
    const mediaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${igAccountId}/media?` +
        `fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink` +
        `&limit=50&access_token=${accessToken}`
    );
    const mediaData = (await mediaResponse.json()) as {
      data?: Array<{
        id: string;
        caption?: string;
        media_type: string;
        media_url?: string;
        thumbnail_url?: string;
        timestamp?: string;
        like_count?: number;
        comments_count?: number;
        permalink?: string;
      }>;
      error?: { message?: string };
    };

    if (mediaData.error) {
      console.error("Media fetch error:", mediaData.error);
      return NextResponse.json(
        { error: "Failed to fetch media", details: mediaData.error },
        { status: 500 }
      );
    }

    const mapContentType = (mediaType: string): string => {
      switch (mediaType) {
        case "IMAGE":
          return "image";
        case "VIDEO":
          return "video";
        case "CAROUSEL_ALBUM":
          return "carousel";
        default:
          return "image";
      }
    };

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

    for (const post of mediaData.data ?? []) {
      const metrics: Record<string, number> = {
        likes: post.like_count ?? 0,
        comments: post.comments_count ?? 0,
      };

      // Try to get post insights (may fail for some post types)
      try {
        const insightsResponse = await fetch(
          `https://graph.facebook.com/v21.0/${post.id}/insights?` +
            `metric=impressions,reach,saved` +
            `&access_token=${accessToken}`
        );
        const insightsData = (await insightsResponse.json()) as {
          data?: Array<{ name: string; values?: Array<{ value?: number }> }>;
        };

        if (insightsData.data) {
          for (const insight of insightsData.data) {
            if (insight.name === "impressions")
              metrics.impressions = insight.values?.[0]?.value ?? 0;
            if (insight.name === "reach") metrics.reach = insight.values?.[0]?.value ?? 0;
            if (insight.name === "saved") metrics.saves = insight.values?.[0]?.value ?? 0;
          }
        }
      } catch {
        // Insights not available for this post type
      }

      // For videos/reels, try to get video views
      if (post.media_type === "VIDEO") {
        try {
          const videoInsights = await fetch(
            `https://graph.facebook.com/v21.0/${post.id}/insights?` +
              `metric=plays,video_views` +
              `&access_token=${accessToken}`
          );
          const videoData = (await videoInsights.json()) as {
            data?: Array<{ name: string; values?: Array<{ value?: number }> }>;
          };
          if (videoData.data) {
            for (const insight of videoData.data) {
              if (insight.name === "plays") metrics.views = insight.values?.[0]?.value ?? 0;
              if (insight.name === "video_views")
                metrics.video_views = insight.values?.[0]?.value ?? 0;
            }
          }
        } catch {
          // Ignore
        }
      }

      postsToInsert.push({
        user_id: user.id,
        social_account_id: account.id,
        platform: "instagram",
        platform_post_id: post.id,
        content_type: mapContentType(post.media_type),
        caption: post.caption ?? null,
        media_url: post.media_url ?? null,
        thumbnail_url: post.thumbnail_url ?? null,
        permalink: post.permalink ?? null,
        posted_at: post.timestamp ?? null,
        metrics,
      });
    }

    // Upsert posts (update if they already exist)
    if (postsToInsert.length > 0) {
      const { error: postsError } = await supabase.from("social_posts").upsert(postsToInsert, {
        onConflict: "platform,platform_post_id",
      });

      if (postsError) {
        console.error("Posts upsert error:", postsError);
      }
    }

    // Update last_synced_at on the account
    await supabase
      .from("social_accounts")
      .update({
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    // Log activity
    await supabase.from("activity_log").insert({
      user_id: user.id,
      type: "posts_synced",
      description: `Synced ${postsToInsert.length} Instagram posts`,
      data: { platform: "instagram", count: postsToInsert.length },
    });

    return NextResponse.json({
      success: true,
      posts_synced: postsToInsert.length,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
