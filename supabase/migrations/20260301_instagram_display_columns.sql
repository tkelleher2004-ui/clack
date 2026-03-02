-- Add display_name and profile_image_url as top-level columns on social_accounts.
-- Previously these were only stored inside account_data JSONB.
-- Run with: npx supabase db push

ALTER TABLE social_accounts
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
