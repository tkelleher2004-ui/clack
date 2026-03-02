import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = (body as { email?: string }).email?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[waitlist] Missing env: NEXT_PUBLIC_SUPABASE_URL=" + !!url + " SUPABASE_SERVICE_ROLE_KEY=" + !!key);
    return NextResponse.json(
      { error: "Server misconfigured. Contact support." },
      { status: 500 }
    );
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key);
  const { error } = await supabase
    .from("waitlist")
    .insert({ email, source: (body as { source?: string }).source ?? "homepage" });

  if (error) {
    // Unique constraint — already on the list
    if (error.code === "23505") {
      return NextResponse.json({ message: "already_on_list" });
    }
    console.error("[waitlist] insert error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }

  return NextResponse.json({ message: "success" });
}
