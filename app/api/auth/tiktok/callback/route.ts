import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decodeOAuthState } from "@/lib/auth/oauth-state";

function getAccountsUrl(origin: string) {
  return `${origin}/dashboard/accounts`;
}


export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const origin = request.nextUrl.origin;
  const accountsUrl = getAccountsUrl(origin);

  if (errorParam) {
    return NextResponse.redirect(`${accountsUrl}?error=auth_failed`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${accountsUrl}?error=auth_failed`);
  }

  const cookieState = request.cookies.get("tiktok_oauth_state")?.value;
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(`${accountsUrl}?error=invalid_state`);
  }

  const decoded = decodeOAuthState(state);
  if (!decoded || decoded.platform !== "tiktok") {
    return NextResponse.redirect(`${accountsUrl}?error=invalid_state`);
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    return NextResponse.redirect(`${accountsUrl}?error=config`);
  }

  // Use canonical base URL so redirect_uri matches exactly what's in TikTok app config.
  // Set NEXT_PUBLIC_APP_URL=https://www.useclack.com (with www) in Vercel to avoid www/non-www mismatch.
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    origin;
  const redirectUri = `${baseUrl}/api/auth/tiktok/callback`;

  try {
    // Exchange code for access_token
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      open_id?: string;
      error?: { code?: string; message?: string };
    };

    if (!tokenData.access_token || tokenData.error) {
      console.error("[tiktok/callback] Token exchange failed:", tokenData.error, {
        redirect_uri: redirectUri,
        has_code: !!code,
        http_status: tokenRes.status,
      });
      return NextResponse.redirect(`${accountsUrl}?error=token_exchange`);
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token ?? null;
    const openId = tokenData.open_id ?? "";
    const tokenExpiresAt =
      tokenData.expires_in != null
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null;

    // Try to fetch user info – may fail in Sandbox with scope_not_authorized
    // Fields: user.info.basic (open_id, union_id, avatar_url, display_name), user.info.profile (username, bio_description), user.info.stats (follower_count, following_count, likes_count, video_count)
    let username: string | null = null;
    let displayName: string | null = null;
    let profileImageUrl: string | null = null;
    let accountData: Record<string, unknown> = { open_id: openId };

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
        error?: { code?: string; message?: string };
      };
      if (!userInfoJson.error && userInfoJson.data?.user) {
        const u = userInfoJson.data.user;
        username = (u.username as string) ?? null;
        displayName = (u.display_name as string) ?? null;
        profileImageUrl =
          (u.avatar_large_url as string) ?? (u.avatar_url as string) ?? null;
        accountData = {
          open_id: openId,
          union_id: u.union_id ?? null,
          follower_count: u.follower_count ?? 0,
          following_count: u.following_count ?? 0,
          likes_count: u.likes_count ?? 0,
          video_count: u.video_count ?? 0,
          bio: (u.bio_description as string) ?? null,
          followers_count: u.follower_count ?? 0,
          follows_count: u.following_count ?? 0,
          biography: (u.bio_description as string) ?? null,
        };
      }
    } catch {
      // Ignore – we continue with open_id only
    }

    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    const userId = authUser?.id ?? decoded.userId;

    if (!userId) {
      return NextResponse.redirect(`${origin}/login?error=session_expired`);
    }

    const { error: upsertError } = await supabase.from("social_accounts").upsert(
      {
        user_id: userId,
        platform: "tiktok",
        platform_account_id: openId || "unknown",
        username,
        display_name: displayName,
        profile_image_url: profileImageUrl,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt,
        account_data: accountData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform,platform_account_id" }
    );

    if (upsertError) {
      console.error(
        "[tiktok/callback] Supabase upsert failed:",
        upsertError.code,
        upsertError.message,
        upsertError.details
      );
      return NextResponse.redirect(`${accountsUrl}?error=save_failed`);
    }

    supabase
      .from("activity_log")
      .insert({
        user_id: userId,
        type: "account_connected",
        description: "Connected TikTok",
        data: { platform: "tiktok", open_id: openId },
      })
      .then(
        () => {},
        (err: unknown) =>
          console.error("[tiktok/callback] activity_log insert failed:", err)
      );

    const redirectResponse = NextResponse.redirect(
      `${accountsUrl}?success=tiktok`
    );
    redirectResponse.cookies.set("tiktok_oauth_state", "", {
      maxAge: 0,
      path: "/",
    });
    return redirectResponse;
  } catch (err) {
    console.error("[tiktok/callback] Unhandled error:", err);
    const origin = request.nextUrl.origin;
    return NextResponse.redirect(`${getAccountsUrl(origin)}?error=unknown`);
  }
}
