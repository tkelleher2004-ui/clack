import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encodeOAuthState } from "@/lib/auth/oauth-state";

const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
  "pages_read_engagement",
  "pages_show_list",
  "business_management",
  "email",
  "public_profile",
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

  const appId = process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.redirect(
      new URL("/dashboard/accounts?error=config", request.url)
    );
  }

  const baseUrl = request.nextUrl.origin;
  const state = encodeOAuthState(user.id, "instagram");
  const redirectUri = `${baseUrl}/api/auth/instagram/callback`;

  const oauthUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  oauthUrl.searchParams.set("client_id", appId);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("scope", INSTAGRAM_SCOPES);
  oauthUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(oauthUrl.toString());

  // Store state in httpOnly cookie for CSRF validation in the callback
  response.cookies.set("ig_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes — matches the state TTL in oauth-state.ts
    path: "/",
  });

  return response;
}
