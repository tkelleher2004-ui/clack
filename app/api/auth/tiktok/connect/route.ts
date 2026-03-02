import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encodeOAuthState } from "@/lib/auth/oauth-state";

// Scope separator is comma, NOT space (per TikTok API)
const TIKTOK_SCOPES = [
  "user.info.basic",
  "user.info.stats",
  "video.list",
].join(",");

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "session_expired");
    loginUrl.searchParams.set("next", "/dashboard/accounts");
    return NextResponse.redirect(loginUrl);
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    return NextResponse.redirect(
      new URL("/dashboard/accounts?error=config", request.url)
    );
  }

  const baseUrl = request.nextUrl.origin;
  const state = encodeOAuthState(user.id, "tiktok");
  const redirectUri = `${baseUrl}/api/auth/tiktok/callback`;

  const oauthUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
  oauthUrl.searchParams.set("client_key", clientKey);
  oauthUrl.searchParams.set("scope", TIKTOK_SCOPES);
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(oauthUrl.toString());

  // Store state in httpOnly cookie for CSRF validation in the callback
  response.cookies.set("tiktok_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
