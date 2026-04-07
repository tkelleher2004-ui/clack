import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// TikTok domain verification: serve any tiktok*.txt file dynamically (root or under /terms, /privacy, etc.)
const TIKTOK_VERIFY_REGEX = /^\/(?:terms\/|privacy\/)?tiktok([a-zA-Z0-9]+)\.txt\/?$/;
const TIKTOK_VERIFICATION_PREFIX = "tiktok-developers-site-verification=";

export async function middleware(request: NextRequest) {
  // Handle TikTok verification files (supports any tiktok*.txt TikTok provides)
  const match = request.nextUrl.pathname.match(TIKTOK_VERIFY_REGEX);
  if (match) {
    const code = match[1];
    return new NextResponse(`${TIKTOK_VERIFICATION_PREFIX}${code}`, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");
  const isOnboarding = request.nextUrl.pathname === "/onboarding";
  const isDashboard =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname === "/onboarding";
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth/");
  const isHome = request.nextUrl.pathname === "/";

  if (isAuthCallback) {
    return response;
  }

  if (!user) {
    // Homepage is public — allow unauthenticated access
    if (isHome) {
      return response;
    }
    if (isDashboard || isOnboarding) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  // Homepage is public — both logged-in and logged-out users can view it

  // User is signed in
  if (isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Check if user has completed onboarding (has brand_profile)
  if (!isOnboarding && isDashboard) {
    try {
      const { data: profile } = await supabase
        .from("brand_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }
    } catch {
      // Table may not exist yet; allow access
    }
  }

  return response;
}

export const config = {
  matcher: [
    // TikTok verification + app routes
    "/((?!_next/static|_next/image|favicon.ico|api/waitlist|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
