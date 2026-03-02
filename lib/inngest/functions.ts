import { inngest } from "./client";
import { ingestYouTube } from "@/lib/social/ingest-youtube";
import { ingestInstagram } from "@/lib/social/ingest-instagram";
import { ingestTikTok } from "@/lib/social/ingest-tiktok";
import { ingestLinkedIn } from "@/lib/social/ingest-linkedin";
import { ingestTwitter } from "@/lib/social/ingest-twitter";
import { ingestFacebook } from "@/lib/social/ingest-facebook";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const syncSocialAccount = inngest.createFunction(
  {
    id: "sync-social-account",
    name: "Sync Social Account",
    retries: 2,
  },
  { event: "social/account.sync" },
  async ({ event, step }) => {
    const { social_account_id: accountId } = event.data as { social_account_id: string };
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    await supabase
      .from("social_accounts")
      .update({
        sync_status: "syncing",
        sync_progress: "Starting...",
        sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    const { data: account } = await supabase
      .from("social_accounts")
      .select("platform")
      .eq("id", accountId)
      .single();

    if (!account) {
      await supabase
        .from("social_accounts")
        .update({
          sync_status: "error",
          sync_error: "Account not found",
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId);
      throw new Error("Account not found");
    }

    const updateProgress = async (msg: string) => {
      await supabase
        .from("social_accounts")
        .update({
          sync_progress: msg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId);
    };

    try {
      if (account.platform === "youtube") {
        await ingestYouTube(accountId, updateProgress);
      } else if (account.platform === "instagram") {
        await ingestInstagram(accountId, updateProgress);
      } else if (account.platform === "tiktok") {
        await ingestTikTok(accountId, updateProgress);
      } else if (account.platform === "linkedin") {
        await ingestLinkedIn(accountId, updateProgress);
      } else if (account.platform === "twitter") {
        await ingestTwitter(accountId, updateProgress);
      } else if (account.platform === "facebook") {
        await ingestFacebook(accountId, updateProgress);
      } else {
        await supabase
          .from("social_accounts")
          .update({
            sync_status: "error",
            sync_error: `Platform ${account.platform} not yet supported`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", accountId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      await supabase
        .from("social_accounts")
        .update({
          sync_status: "error",
          sync_progress: null,
          sync_error: msg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId);
      throw err;
    }
  }
);
