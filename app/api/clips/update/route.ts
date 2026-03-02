import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clipId, status, suggested_caption, suggested_hashtags } = body as {
      clipId?: string;
      status?: "ready_to_post" | "rejected" | "generated";
      suggested_caption?: string;
      suggested_hashtags?: string[];
    };

    if (!clipId) {
      return NextResponse.json({ error: "clipId is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) update.status = status;
    if (suggested_caption !== undefined) update.suggested_caption = suggested_caption;
    if (suggested_hashtags !== undefined) update.suggested_hashtags = suggested_hashtags;

    const { error } = await supabase
      .from("clips")
      .update(update)
      .eq("id", clipId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to update clip", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

