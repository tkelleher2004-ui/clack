import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encodeOAuthState } from "@/lib/auth/oauth-state";

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.analytics.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

// CRITICAL: Use these exact scopes. NOT instagram_business_* scopes.
const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
  "pages_read_engagement",
  "pages_show_list",
  "business_management",
  "email",
  "public_profile",
].join(",");

const TIKTOK_SCOPES = ["user.info.basic", "user.info.profile", "user.info.stats", "video.list"].join(",");

const LINKEDIN_SCOPES = ["openid", "profile", "email", "w_member_social"].join(" ");

const TWITTER_SCOPES = ["tweet.read", "users.read", "offline.access"].join(" ");

const FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_read_user_content",
  "pages_manage_metadata",
].join(",");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login?error=session_expired&next=/dashboard/accounts", request.url)
    );
  }

  const baseUrl = request.nextUrl.origin;

  if (platform === "twitter") {
    const { randomBytes, createHash } = await import("crypto");
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const state = encodeOAuthState(user.id, platform, { code_verifier: codeVerifier });

    const clientId = process.env.TWITTER_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "Twitter OAuth not configured (TWITTER_CLIENT_ID)" },
        { status: 500 }
      );
    }
    const redirectUri = `${baseUrl}/api/auth/twitter/callback`;
    const url = new URL("https://twitter.com/i/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", TWITTER_SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return NextResponse.redirect(url.toString());
  }

  const state = encodeOAuthState(user.id, platform);

  if (platform === "youtube") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "YouTube OAuth not configured (GOOGLE_CLIENT_ID)" },
        { status: 500 }
      );
    }
    const redirectUri = `${baseUrl}/api/auth/youtube/callback`;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", YOUTUBE_SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    return NextResponse.redirect(url.toString());
  }

  if (platform === "tiktok") {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    if (!clientKey) {
      return NextResponse.json(
        { error: "TikTok OAuth not configured (TIKTOK_CLIENT_KEY)" },
        { status: 500 }
      );
    }
    const redirectUri = `${baseUrl}/api/auth/tiktok/callback`;
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", clientKey);
    url.searchParams.set("scope", TIKTOK_SCOPES);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return NextResponse.redirect(url.toString());
  }

  if (platform === "linkedin") {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "LinkedIn OAuth not configured (LINKEDIN_CLIENT_ID)" },
        { status: 500 }
      );
    }
    const redirectUri = `${baseUrl}/api/auth/linkedin/callback`;
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", LINKEDIN_SCOPES);
    url.searchParams.set("state", state);
    return NextResponse.redirect(url.toString());
  }

  if (platform === "facebook") {
    const appId = process.env.META_APP_ID;
    if (!appId) {
      return NextResponse.json(
        { error: "Facebook OAuth not configured (META_APP_ID)" },
        { status: 500 }
      );
    }
    const redirectUri = `${baseUrl}/api/auth/facebook/callback`;
    const url = new URL("https://www.facebook.com/v18.0/dialog/oauth");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", FACEBOOK_SCOPES);
    url.searchParams.set("state", state);
    return NextResponse.redirect(url.toString());
  }

  if (platform === "instagram") {
    const appId = process.env.META_APP_ID;
    if (!appId) {
      return NextResponse.json(
        { error: "Instagram OAuth not configured (META_APP_ID)" },
        { status: 500 }
      );
    }
    const redirectUri = `${baseUrl}/api/auth/instagram/callback`;
    const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", INSTAGRAM_SCOPES);
    url.searchParams.set("state", state);
    return NextResponse.redirect(url.toString());
  }

  return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
}
