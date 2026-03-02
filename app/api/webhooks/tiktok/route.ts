import { NextRequest, NextResponse } from "next/server";

/**
 * TikTok webhook verification (GET).
 * TikTok sends a challenge parameter that must be echoed back to verify the endpoint.
 */
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get("challenge");
  if (!challenge) {
    return NextResponse.json({ error: "Missing challenge parameter" }, { status: 400 });
  }
  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

/**
 * TikTok webhook event handler (POST).
 * Receives events and logs them. Real event handling to be added later.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    console.info("[webhooks/tiktok] Event received:", JSON.stringify(body, null, 2));
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("[webhooks/tiktok] POST error:", err);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
