-- Add all clips columns that the app expects (table may have been created from an older schema).
-- Run in Supabase Dashboard → SQL Editor. Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE clips ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS start_time REAL;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS end_time REAL;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS score REAL;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS reasoning TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS suggested_caption TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS suggested_hashtags TEXT[];
ALTER TABLE clips ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS srt_path TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE clips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
