import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { social_account_id: accountId } = body as { social_account_id?: string };

    if (!accountId) {
      return NextResponse.json(
        { error: "social_account_id is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: account, error: fetchError } = await supabase
      .from("social_accounts")
      .select("id, platform")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    await inngest.send({
      name: "social/account.sync",
      data: { social_account_id: accountId },
    });

    return NextResponse.json({ success: true, message: "Sync started" });
  } catch (err) {
    console.error("Sync trigger failed", err);
    return NextResponse.json(
      { error: "Failed to start sync" },
      { status: 500 }
    );
  }
}
