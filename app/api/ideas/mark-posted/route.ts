import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { title: string; format?: string; hook?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // Store as a posted_idea artifact
  const { error } = await supabase.from("ai_artifacts").insert({
    user_id: user.id,
    type: "posted_idea",
    title: body.title,
    data: {
      title: body.title,
      format: body.format ?? null,
      hook: body.hook ?? null,
      posted_at: new Date().toISOString(),
      matched_post_id: null, // will be filled by auto-match on sync
    },
    pinned: false,
  });

  if (error) {
    console.error("[ideas/mark-posted] insert error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
