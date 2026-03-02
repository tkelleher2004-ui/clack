-- =============================================================
-- Clack — Supabase Schema
-- =============================================================

-- Phase 1: Brand Profiles
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS brand_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  industry TEXT,
  website_url TEXT,
  target_audience TEXT,
  audience_age_range TEXT,
  brand_voice TEXT,
  logo_url TEXT,
  accent_color TEXT,
  goals_raw TEXT,
  goals_timeframe TEXT CHECK (goals_timeframe IN ('1_month', '3_months', '6_months', '1_year', 'none')),
  goals_structured JSONB,
  goals_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON brand_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON brand_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON brand_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Phase 2: Videos
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  duration REAL,
  thumbnail_url TEXT,
  -- Full transcript with word/segment timestamps (Phase 3)
  transcript JSONB,
  status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (status IN (
      'uploading',
      'uploaded',
      'processing',
      'processing_transcript',
      'processing_analysis',
      'processing_clips',
      'clips_ready',
      'error'
    )),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own videos" ON videos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own videos" ON videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own videos" ON videos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own videos" ON videos FOR DELETE USING (auth.uid() = user_id);

-- Phase 3: Clips
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS clips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('hook', 'value_bomb', 'emotional_peak', 'cta', 'story')),
  score REAL,
  reasoning TEXT,
  suggested_caption TEXT,
  suggested_hashtags TEXT[],
  status TEXT NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated', 'ready_to_post', 'rejected')),
  file_path TEXT NOT NULL,
  srt_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clips" ON clips
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clips" ON clips
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clips" ON clips
  FOR UPDATE USING (auth.uid() = user_id);

-- =============================================================
-- Storage Buckets (create via Supabase Dashboard)
-- =============================================================
-- REQUIRED: Create these buckets in Dashboard → Storage → New bucket
-- or clip uploads will fail with "Bucket not found".
--
-- 1. "videos"      — user-uploaded source videos
-- 2. "clips"       — extracted clips (Phase 3)  ← required for Generate Clips
-- 3. "thumbnails"  — auto-generated thumbnails
--
-- For "clips": create as Private. RLS policies (Dashboard → Storage → clips → Policies):
--
-- SELECT (read own files):
--   (auth.uid()::text = (storage.foldername(name))[1])
--
-- INSERT (upload to own folder):
--   (auth.uid()::text = (storage.foldername(name))[1])
--
-- UPDATE (overwrite own files):
--   (auth.uid()::text = (storage.foldername(name))[1])
--
-- DELETE (remove own files):
--   (auth.uid()::text = (storage.foldername(name))[1])
