import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decodeOAuthState } from "@/lib/auth/oauth-state";

function getAccountsUrl(origin: string) {
  return `${origin}/dashboard/accounts`;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const accountsUrl = getAccountsUrl(origin);
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // User denied the OAuth dialog
  if (errorParam) {
    return NextResponse.redirect(`${accountsUrl}?error=auth_failed`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${accountsUrl}?error=auth_failed`);
  }

  // CSRF check: compare URL state param against the httpOnly cookie we set
  const cookieState = request.cookies.get("ig_oauth_state")?.value;
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(`${accountsUrl}?error=invalid_state`);
  }

  // Verify the HMAC signature and TTL inside the state
  const decoded = decodeOAuthState(state);
  if (!decoded || decoded.platform !== "instagram") {
    return NextResponse.redirect(`${accountsUrl}?error=invalid_state`);
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(`${accountsUrl}?error=config`);
  }

  const baseUrl = origin;
  const redirectUri = `${baseUrl}/api/auth/instagram/callback`;

  try {
    // ── Step 1: Exchange auth code for a short-lived user access token ────────
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: { message?: string; type?: string };
    };

    if (!tokenData.access_token || tokenData.error) {
      console.error("[instagram/callback] Token exchange failed:", tokenData.error);
      return NextResponse.redirect(`${accountsUrl}?error=token_exchange`);
    }

    // ── Step 2: Exchange for a long-lived token (~60 days) ────────────────────
    const longLivedUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", appId);
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", tokenData.access_token);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = (await longLivedRes.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message?: string };
    };

    if (!longLivedData.access_token || longLivedData.error) {
      console.error("[instagram/callback] Long-lived token failed:", longLivedData.error);
      return NextResponse.redirect(`${accountsUrl}?error=long_lived_token`);
    }

    const userAccessToken = longLivedData.access_token;
    const tokenExpiresAt = longLivedData.expires_in
      ? new Date(Date.now() + longLivedData.expires_in * 1000).toISOString()
      : null;

    // ── Step 3: Get the user's Facebook Pages ─────────────────────────────────
    const pagesUrl = new URL("https://graph.facebook.com/v21.0/me/accounts");
    pagesUrl.searchParams.set("fields", "id,name,access_token,instagram_business_account");
    pagesUrl.searchParams.set("access_token", userAccessToken);

    const pagesRes = await fetch(pagesUrl.toString());
    const pagesData = (await pagesRes.json()) as {
      data?: Array<{
        id: string;
        name: string;
        access_token: string;
        instagram_business_account?: { id: string };
      }>;
      error?: { message?: string };
    };

    if (pagesData.error || !pagesData.data?.length) {
      console.error("[instagram/callback] Pages fetch failed:", pagesData.error);
      return NextResponse.redirect(`${accountsUrl}?error=no_pages`);
    }

    // ── Step 4: Find the page connected to an Instagram Business Account ──────
    let igAccountId: string | null = null;
    let pageAccessToken: string | null = null;
    let pageName: string | null = null;

    for (const page of pagesData.data) {
      if (page.instagram_business_account?.id) {
        igAccountId = page.instagram_business_account.id;
        pageAccessToken = page.access_token;
        pageName = page.name;
        break;
      }
    }

    if (!igAccountId || !pageAccessToken) {
      console.error("[instagram/callback] No Instagram Business Account found on any page.");
      return NextResponse.redirect(`${accountsUrl}?error=no_ig_business`);
    }

    // ── Step 5: Fetch Instagram account details ───────────────────────────────
    const igUrl = new URL(`https://graph.facebook.com/v21.0/${igAccountId}`);
    igUrl.searchParams.set(
      "fields",
      "id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url"
    );
    igUrl.searchParams.set("access_token", pageAccessToken);

    const igRes = await fetch(igUrl.toString());
    const igData = (await igRes.json()) as {
      id?: string;
      username?: string;
      name?: string;
      biography?: string;
      followers_count?: number;
      follows_count?: number;
      media_count?: number;
      profile_picture_url?: string;
      error?: { message?: string };
    };

    if (igData.error) {
      console.error("[instagram/callback] IG account fetch failed:", igData.error);
      return NextResponse.redirect(`${accountsUrl}?error=token_exchange`);
    }

    // ── Step 6: Upsert into social_accounts ───────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Fall back to the userId embedded in the signed state if session cookie
    // isn't available (edge case: session expired mid-OAuth flow)
    const userId = user?.id ?? decoded.userId;

    if (!userId) {
      return NextResponse.redirect(`${origin}/login?error=session_expired`);
    }

    const { error: upsertError } = await supabase.from("social_accounts").upsert(
      {
        user_id: userId,
        platform: "instagram",
        platform_account_id: igAccountId,
        username: igData.username ?? null,
        display_name: igData.name ?? null,
        profile_image_url: igData.profile_picture_url ?? null,
        // Stored as plaintext; RLS + TLS protect it at rest
        access_token: pageAccessToken,
        token_expires_at: tokenExpiresAt,
        account_data: {
          name: igData.name ?? null,
          biography: igData.biography ?? null,
          followers_count: igData.followers_count ?? 0,
          follows_count: igData.follows_count ?? 0,
          media_count: igData.media_count ?? 0,
          profile_picture_url: igData.profile_picture_url ?? null,
          page_name: pageName,
        },
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform,platform_account_id" }
    );

    if (upsertError) {
      console.error("[instagram/callback] Supabase upsert failed:", upsertError);
      return NextResponse.redirect(`${accountsUrl}?error=save_failed`);
    }

    // Log the connection (best-effort, non-blocking)
    supabase
      .from("activity_log")
      .insert({
        user_id: userId,
        type: "account_connected",
        description: `Connected Instagram @${igData.username ?? "unknown"}`,
        data: {
          platform: "instagram",
          username: igData.username ?? null,
          followers: igData.followers_count ?? 0,
        },
      })
      .then(() => {}, (err: unknown) =>
        console.error("[instagram/callback] activity_log insert failed:", err)
      );

    // Clear the CSRF cookie and redirect to success
    const redirectResponse = NextResponse.redirect(`${accountsUrl}?success=instagram`);
    redirectResponse.cookies.set("ig_oauth_state", "", {
      maxAge: 0,
      path: "/",
    });
    return redirectResponse;
  } catch (err) {
    console.error("[instagram/callback] Unhandled error:", err);
    return NextResponse.redirect(`${accountsUrl}?error=unknown`);
  }
}
