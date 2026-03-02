import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decodeOAuthState } from "@/lib/auth/oauth-state";
import { encryptTokens } from "@/lib/crypto/tokens";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const accountsUrl = `${baseUrl}/dashboard/accounts`;

async function handleYouTubeCallback(code: string, state: string) {
  const decoded = decodeOAuthState(state);
  if (!decoded || decoded.platform !== "youtube") {
    return NextResponse.redirect(`${accountsUrl}?error=invalid_state`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${accountsUrl}?error=config`);
  }

  const redirectUri = `${baseUrl}/api/auth/youtube/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("YouTube token exchange failed:", err);
    return NextResponse.redirect(`${accountsUrl}?error=token_exchange`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const expiresAt = tokens.expires_in
    ? Date.now() + tokens.expires_in * 1000
    : undefined;

  const channelRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }
  );

  if (!channelRes.ok) {
    return NextResponse.redirect(`${accountsUrl}?error=channel_fetch`);
  }

  const channelData = (await channelRes.json()) as {
    items?: Array<{
      id: string;
      snippet?: { title?: string; thumbnails?: { default?: { url?: string } } };
      statistics?: { subscriberCount?: string };
    }>;
  };

  const channel = channelData.items?.[0];
  if (!channel) {
    return NextResponse.redirect(`${accountsUrl}?error=no_channel`);
  }

  const encrypted = encryptTokens({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: expiresAt,
  });

  const supabase = await createClient();
  const { error } = await supabase.from("social_accounts").upsert(
    {
      user_id: decoded.userId,
      platform: "youtube",
      external_account_id: channel.id,
      account_name: channel.snippet?.title ?? "YouTube Channel",
      account_avatar_url: channel.snippet?.thumbnails?.default?.url ?? null,
      follower_count: parseInt(channel.statistics?.subscriberCount ?? "0", 10),
      encrypted_tokens: encrypted,
      sync_status: "idle",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (error) {
    console.error("YouTube account save failed:", error);
    return NextResponse.redirect(`${accountsUrl}?error=save`);
  }

  const { data: saved } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("user_id", decoded.userId)
    .eq("platform", "youtube")
    .single();

  if (saved?.id) {
    const { inngest } = await import("@/lib/inngest/client");
    inngest.send({ name: "social/account.sync", data: { social_account_id: saved.id } });
  }

  return NextResponse.redirect(`${accountsUrl}?connected=youtube`);
}

async function handleInstagramCallback(code: string, state: string) {
  const decoded = decodeOAuthState(state);
  if (!decoded || decoded.platform !== "instagram") {
    return NextResponse.redirect(`${accountsUrl}?error=invalid_state`);
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(`${accountsUrl}?error=config`);
  }

  const redirectUri = `${baseUrl}/api/auth/instagram/callback`;

  try {
    // Step 1: Exchange code for short-lived token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
        `client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    );
    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      error?: { message?: string };
      expires_in?: number;
    };

    if (tokenData.error) {
      console.error("Token exchange error:", tokenData.error);
      return NextResponse.redirect(`${accountsUrl}?error=token_exchange`);
    }

    const shortLivedToken = tokenData.access_token;
    if (!shortLivedToken) {
      return NextResponse.redirect(`${accountsUrl}?error=token_exchange`);
    }

    // Step 2: Exchange for long-lived token (60 days)
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`
    );
    const longLivedData = (await longLivedResponse.json()) as {
      access_token?: string;
      error?: { message?: string };
      expires_in?: number;
    };

    if (longLivedData.error) {
      console.error("Long-lived token error:", longLivedData.error);
      return NextResponse.redirect(`${accountsUrl}?error=long_lived_token`);
    }

    const accessToken = longLivedData.access_token;
    const expiresIn = longLivedData.expires_in ?? 0;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Step 3: Get user's Facebook Pages
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`
    );
    const pagesData = (await pagesResponse.json()) as {
      data?: Array<{
        id: string;
        name: string;
        access_token: string;
        instagram_business_account?: { id: string };
      }>;
    };

    if (!pagesData.data || pagesData.data.length === 0) {
      console.error("No Facebook Pages found. User needs a Facebook Page linked to Instagram Business account.");
      return NextResponse.redirect(`${accountsUrl}?error=no_pages`);
    }

    // Step 4: Find the page with an Instagram Business Account
    let igAccountId: string | null = null;
    let pageAccessToken: string | null = null;
    let pageName: string | null = null;

    for (const page of pagesData.data) {
      if (page.instagram_business_account) {
        igAccountId = page.instagram_business_account.id;
        pageAccessToken = page.access_token;
        pageName = page.name;
        break;
      }
    }

    if (!igAccountId || !pageAccessToken) {
      console.error("No Instagram Business Account found on any page.");
      return NextResponse.redirect(`${accountsUrl}?error=no_ig_business`);
    }

    // Step 5: Get Instagram account details
    const igDetailsResponse = await fetch(
      `https://graph.facebook.com/v21.0/${igAccountId}?fields=id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url&access_token=${pageAccessToken}`
    );
    const igDetails = (await igDetailsResponse.json()) as {
      id?: string;
      username?: string;
      name?: string;
      biography?: string;
      followers_count?: number;
      follows_count?: number;
      media_count?: number;
      profile_picture_url?: string;
    };

    // Step 6: Save to Supabase (new schema)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? decoded.userId;

    if (!userId) {
      return NextResponse.redirect(`${baseUrl}/login`);
    }

    const { error: upsertError } = await supabase.from("social_accounts").upsert(
      {
        user_id: userId,
        platform: "instagram",
        platform_account_id: igAccountId,
        username: igDetails.username ?? null,
        access_token: pageAccessToken,
        token_expires_at: tokenExpiresAt,
        account_data: {
          name: igDetails.name,
          biography: igDetails.biography,
          followers_count: igDetails.followers_count,
          follows_count: igDetails.follows_count,
          media_count: igDetails.media_count,
          profile_picture_url: igDetails.profile_picture_url,
          page_name: pageName,
        },
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform,platform_account_id" }
    );

    if (upsertError) {
      console.error("Supabase upsert error:", upsertError);
      return NextResponse.redirect(`${accountsUrl}?error=save_failed`);
    }

    // Step 7: Trigger initial data sync (async — don't block redirect)
    fetch(`${baseUrl}/api/instagram/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    }).catch((err) => console.error("Sync trigger failed:", err));

    // Step 8: Log activity
    await supabase.from("activity_log").insert({
      user_id: userId,
      type: "account_connected",
      description: `Connected Instagram account @${igDetails.username ?? "unknown"}`,
      data: {
        platform: "instagram",
        username: igDetails.username,
        followers: igDetails.followers_count,
      },
    });

    return NextResponse.redirect(`${accountsUrl}?success=instagram`);
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(`${accountsUrl}?error=unknown`);
  }
}

async function handleTikTokCallback(code: string, state: string) {
  const decoded = decodeOAuthState(state);
  if (!decoded || decoded.platform !== "tiktok") {
    return NextResponse.redirect(`${accountsUrl}?error=invalid_state`);
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    return NextResponse.redirect(`${accountsUrl}?error=config`);
  }

  const redirectUri = `${baseUrl}/api/auth/tiktok/callback`;
  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("TikTok token exchange failed:", err);
    return NextResponse.redirect(`${accountsUrl}?error=token_exchange`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    open_id?: string;
  };

  const expiresAt = tokens.expires_in
    ? Date.now() + tokens.expires_in * 1000
    : undefined;

  const userRes = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name,username,follower_count,following_count,likes_count,video_count",
    {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!userRes.ok) {
    return NextResponse.redirect(`${accountsUrl}?error=user_fetch`);
  }

  const userData = (await userRes.json()) as {
    data?: {
      user?: {
        open_id?: string;
        avatar_url?: string;
        display_name?: string;
        username?: string;
        follower_count?: number;
        following_count?: number;
        likes_count?: number;
        video_count?: number;
      };
    };
  };

  const user = userData.data?.user;
  const openId = user?.open_id ?? tokens.open_id ?? "unknown";
  if (!user) {
    return NextResponse.redirect(`${accountsUrl}?error=no_user`);
  }

  const encrypted = encryptTokens({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: expiresAt,
  });

  const supabase = await createClient();
  const { error } = await supabase.from("social_accounts").upsert(
    {
      user_id: decoded.userId,
      platform: "tiktok",
      external_account_id: openId,
      account_name: user.display_name ?? user.username ?? "TikTok User",
      account_avatar_url: user.avatar_url ?? null,
      follower_count: user.follower_count ?? 0,
      following_count: user.following_count ?? 0,
      encrypted_tokens: encrypted,
      sync_status: "idle",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (error) {
    console.error("TikTok account save failed:", error);
    return NextResponse.redirect(`${accountsUrl}?error=save`);
  }

  const { data: saved } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("user_id", decoded.userId)
    .eq("platform", "tiktok")
    .single();

  if (saved?.id) {
    const { inngest } = await import("@/lib/inngest/client");
    inngest.send({ name: "social/account.sync", data: { social_account_id: saved.id } });
  }

  return NextResponse.redirect(`${accountsUrl}?connected=tiktok`);
}

async function handleLinkedInCallback(code: string, state: string) {
  const decoded = decodeOAuthState(state);
  if (!decoded || decoded.platform !== "linkedin") {
    return NextResponse.redirect(`${accountsUrl}?error=invalid_state`);
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${accountsUrl}?error=config`);
  }

  const redirectUri = `${baseUrl}/api/auth/linkedin/callback`;
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("LinkedIn token exchange failed:", err);
    return NextResponse.redirect(`${accountsUrl}?error=token_exchange`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    expires_in?: number;
  };

  const expiresAt = tokens.expires_in
    ? Date.now() + tokens.expires_in * 1000
    : undefined;

  const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!profileRes.ok) {
    return NextResponse.redirect(`${accountsUrl}?error=profile_fetch`);
  }

  const profile = (await profileRes.json()) as {
    sub?: string;
    name?: string;
    picture?: string;
  };

  const encrypted = encryptTokens({
    access_token: tokens.access_token,
    token_expires_at: expiresAt,
  });

  const supabase = await createClient();
  const { error } = await supabase.from("social_accounts").upsert(
    {
      user_id: decoded.userId,
      platform: "linkedin",
      external_account_id: profile.sub ?? "unknown",
      account_name: profile.name ?? "LinkedIn User",
      account_avatar_url: profile.picture ?? null,
      encrypted_tokens: encrypted,
      sync_status: "idle",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (error) {
    console.error("LinkedIn account save failed:", error);
    return NextResponse.redirect(`${accountsUrl}?error=save`);
  }

  const { data: saved } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("user_id", decoded.userId)
    .eq("platform", "linkedin")
    .single();

  if (saved?.id) {
    const { inngest } = await import("@/lib/inngest/client");
    inngest.send({ name: "social/account.sync", data: { social_account_id: saved.id } });
  }

  return NextResponse.redirect(`${accountsUrl}?connected=linkedin`);
}

async function handleTwitterCallback(code: string, state: string) {
  const decoded = decodeOAuthState(state);
  if (!decoded || decoded.platform !== "twitter") {
    return NextResponse.redirect(`${accountsUrl}?error=invalid_state`);
  }

  const codeVerifier = decoded.code_verifier;
  if (!codeVerifier) {
    return NextResponse.redirect(`${accountsUrl}?error=invalid_state`);
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${accountsUrl}?error=config`);
  }

  const redirectUri = `${baseUrl}/api/auth/twitter/callback`;
  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("Twitter token exchange failed:", err);
    return NextResponse.redirect(`${accountsUrl}?error=token_exchange`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const expiresAt = tokens.expires_in
    ? Date.now() + tokens.expires_in * 1000
    : undefined;

  const userRes = await fetch("https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userRes.ok) {
    return NextResponse.redirect(`${accountsUrl}?error=user_fetch`);
  }

  const userData = (await userRes.json()) as {
    data?: {
      id: string;
      username?: string;
      name?: string;
      profile_image_url?: string;
      public_metrics?: { followers_count?: number; following_count?: number };
    };
  };

  const user = userData.data;
  if (!user) {
    return NextResponse.redirect(`${accountsUrl}?error=no_user`);
  }

  const encrypted = encryptTokens({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: expiresAt,
  });

  const supabase = await createClient();
  const { error } = await supabase.from("social_accounts").upsert(
    {
      user_id: decoded.userId,
      platform: "twitter",
      external_account_id: user.id,
      account_name: user.name ?? user.username ?? "X User",
      account_avatar_url: user.profile_image_url ?? null,
      follower_count: user.public_metrics?.followers_count ?? 0,
      following_count: user.public_metrics?.following_count ?? 0,
      encrypted_tokens: encrypted,
      sync_status: "idle",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (error) {
    console.error("Twitter account save failed:", error);
    return NextResponse.redirect(`${accountsUrl}?error=save`);
  }

  const { data: saved } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("user_id", decoded.userId)
    .eq("platform", "twitter")
    .single();

  if (saved?.id) {
    const { inngest } = await import("@/lib/inngest/client");
    inngest.send({ name: "social/account.sync", data: { social_account_id: saved.id } });
  }

  return NextResponse.redirect(`${accountsUrl}?connected=twitter`);
}

async function handleFacebookCallback(code: string, state: string) {
  const decoded = decodeOAuthState(state);
  if (!decoded || decoded.platform !== "facebook") {
    return NextResponse.redirect(`${accountsUrl}?error=invalid_state`);
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(`${accountsUrl}?error=config`);
  }

  const redirectUri = `${baseUrl}/api/auth/facebook/callback`;
  const tokenUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const metaTokenRes = await fetch(tokenUrl.toString());
  if (!metaTokenRes.ok) {
    const err = await metaTokenRes.text();
    console.error("Facebook token exchange failed:", err);
    return NextResponse.redirect(`${accountsUrl}?error=token_exchange`);
  }

  const tokenData = (await metaTokenRes.json()) as {
    access_token: string;
    expires_in?: number;
  };

  const expiresAt = tokenData.expires_in
    ? Date.now() + tokenData.expires_in * 1000
    : undefined;

  const pagesRes = await fetch(
    "https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,picture",
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    }
  );

  if (!pagesRes.ok) {
    return NextResponse.redirect(`${accountsUrl}?error=pages_fetch`);
  }

  const pagesData = (await pagesRes.json()) as {
    data?: Array<{
      id: string;
      name: string;
      access_token: string;
      picture?: { data?: { url?: string } };
    }>;
  };

  const page = pagesData.data?.[0];
  if (!page) {
    return NextResponse.redirect(
      `${accountsUrl}?error=no_page&message=Create a Facebook Page first to connect`
    );
  }

  const longLivedRes = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${page.access_token}`,
    { method: "GET" }
  );

  let pageAccessToken = page.access_token;
  if (longLivedRes.ok) {
    const ll = (await longLivedRes.json()) as { access_token?: string };
    if (ll.access_token) pageAccessToken = ll.access_token;
  }

  const pageInfoRes = await fetch(
    `https://graph.facebook.com/v18.0/${page.id}?fields=fan_count`,
    { headers: { Authorization: `Bearer ${pageAccessToken}` } }
  );

  let followerCount = 0;
  if (pageInfoRes.ok) {
    const info = (await pageInfoRes.json()) as { fan_count?: number };
    followerCount = info.fan_count ?? 0;
  }

  const encrypted = encryptTokens({
    access_token: pageAccessToken,
    token_expires_at: expiresAt,
  });

  const supabase = await createClient();
  const { error } = await supabase.from("social_accounts").upsert(
    {
      user_id: decoded.userId,
      platform: "facebook",
      external_account_id: page.id,
      account_name: page.name,
      account_avatar_url: page.picture?.data?.url ?? null,
      follower_count: followerCount,
      encrypted_tokens: encrypted,
      sync_status: "idle",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (error) {
    console.error("Facebook account save failed:", error);
    return NextResponse.redirect(`${accountsUrl}?error=save`);
  }

  const { data: saved } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("user_id", decoded.userId)
    .eq("platform", "facebook")
    .single();

  if (saved?.id) {
    const { inngest } = await import("@/lib/inngest/client");
    inngest.send({ name: "social/account.sync", data: { social_account_id: saved.id } });
  }

  return NextResponse.redirect(`${accountsUrl}?connected=facebook`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    const msg = searchParams.get("error_description") ?? searchParams.get("error_reason") ?? errorParam;
    return NextResponse.redirect(`${accountsUrl}?error=${encodeURIComponent(msg)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${accountsUrl}?error=missing_params`);
  }

  if (platform === "youtube") {
    return handleYouTubeCallback(code, state);
  }

  if (platform === "instagram") {
    return handleInstagramCallback(code, state);
  }

  if (platform === "tiktok") {
    return handleTikTokCallback(code, state);
  }

  if (platform === "linkedin") {
    return handleLinkedInCallback(code, state);
  }

  if (platform === "twitter") {
    return handleTwitterCallback(code, state);
  }

  if (platform === "facebook") {
    return handleFacebookCallback(code, state);
  }

  return NextResponse.redirect(`${accountsUrl}?error=unsupported`);
}
