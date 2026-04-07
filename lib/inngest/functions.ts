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
  async ({ event }) => {
    const { social_account_id: accountId } = event.data as { social_account_id: string };
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: account } = await supabase
      .from("social_accounts")
      .select("platform")
      .eq("id", accountId)
      .single();

    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    if (account.platform === "youtube") {
      await ingestYouTube(accountId);
    } else if (account.platform === "instagram") {
      await ingestInstagram(accountId);
    } else if (account.platform === "tiktok") {
      await ingestTikTok(accountId);
    } else if (account.platform === "linkedin") {
      await ingestLinkedIn(accountId);
    } else if (account.platform === "twitter") {
      await ingestTwitter(accountId);
    } else if (account.platform === "facebook") {
      await ingestFacebook(accountId);
    } else {
      throw new Error(`Platform ${account.platform} not yet supported`);
    }
  }
);
