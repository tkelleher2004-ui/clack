import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decodeOAuthState } from "@/lib/auth/oauth-state";

function getAccountsUrl(origin: string) {
  return `${origin}/dashboard/accounts`;
}

const USER_INFO_FIELDS = [
  "open_id",
  "union_id",
  "avatar_url",
  "display_name",
  "username",
  "follower_count",
  "following_count",
  "likes_count",
  "video_count",
].join(",");

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

  const baseUrl = origin;
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
      console.error("[tiktok/callback] Token exchange failed:", tokenData.error);
      return NextResponse.redirect(`${accountsUrl}?error=token_exchange`);
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token ?? null;
    const openId = tokenData.open_id ?? "";
    const tokenExpiresAt =
      tokenData.expires_in != null
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null;

    // Fetch user info
    const userInfoRes = await fetch(
      `https://open.tiktokapis.com/v2/user/info/?fields=${encodeURIComponent(USER_INFO_FIELDS)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const userInfoData = (await userInfoRes.json()) as {
      data?: {
        user?: {
          open_id?: string;
          union_id?: string;
          avatar_url?: string;
          display_name?: string;
          username?: string;
          follower_count?: number;
          following_count?: number;
          likes_count?: number;
          video_count?: number;
        };
      };
      error?: { code?: string; message?: string };
    };

    if (userInfoData.error || !userInfoData.data?.user) {
      console.error("[tiktok/callback] User info failed:", userInfoData.error);
    }

    const user = userInfoData.data?.user ?? {};
    const platformAccountId = openId || user.open_id || "unknown";

    // Upsert into social_accounts
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
        platform_account_id: platformAccountId,
        username: user.username ?? null,
        display_name: user.display_name ?? null,
        profile_image_url: user.avatar_url ?? null,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt,
        account_data: {
          open_id: openId || user.open_id,
          union_id: user.union_id,
          avatar_url: user.avatar_url,
          display_name: user.display_name,
          username: user.username,
          followers_count: user.follower_count ?? 0,
          following_count: user.following_count ?? 0,
          likes_count: user.likes_count ?? 0,
          video_count: user.video_count ?? 0,
        },
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform,platform_account_id" }
    );

    if (upsertError) {
      console.error("[tiktok/callback] Supabase upsert failed:", upsertError);
      return NextResponse.redirect(`${accountsUrl}?error=save_failed`);
    }

    supabase
      .from("activity_log")
      .insert({
        user_id: userId,
        type: "account_connected",
        description: `Connected TikTok @${user.username ?? "unknown"}`,
        data: {
          platform: "tiktok",
          username: user.username ?? null,
          followers: user.follower_count ?? 0,
          video_count: user.video_count ?? 0,
        },
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
