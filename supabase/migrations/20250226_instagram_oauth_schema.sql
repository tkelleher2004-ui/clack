-- =============================================================
-- Instagram OAuth End-to-End Schema (PROMPT 3)
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- NOTE: This migration replaces social_accounts and social_posts
-- with the new schema. Existing social data will be lost.
-- =============================================================

-- Drop dependent tables first (if they exist)
DROP TABLE IF EXISTS post_analytics CASCADE;
DROP TABLE IF EXISTS audience_data CASCADE;
DROP TABLE IF EXISTS channel_analytics CASCADE;
DROP TABLE IF EXISTS social_posts CASCADE;
DROP TABLE IF EXISTS social_accounts CASCADE;

-- Social accounts (Instagram, TikTok, etc.)
CREATE TABLE social_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'linkedin', 'twitter')),
  platform_account_id TEXT NOT NULL,
  username TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  account_data JSONB DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, platform_account_id)
);

-- Social posts
CREATE TABLE social_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL,
  platform_post_id TEXT NOT NULL,
  content_type TEXT CHECK (content_type IN ('image', 'video', 'reel', 'carousel', 'story', 'text')),
  caption TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  permalink TEXT,
  posted_at TIMESTAMPTZ,
  metrics JSONB DEFAULT '{}'::jsonb,
  ai_analysis JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, platform_post_id)
);

-- AI conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI artifacts (pinnable reports, plans, analyses)
CREATE TABLE IF NOT EXISTS ai_artifacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('deep_dive', 'weekly_plan', 'video_breakdown', 'content_gap_report', 'growth_roadmap', 'daily_briefing')),
  title TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  pinned BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI recommendations (for learning system)
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recommendation TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  followed BOOLEAN,
  outcome JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add goals columns to brand_profiles if they don't exist
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS goals_raw TEXT;
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS goals_timeframe TEXT;
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS goals_structured JSONB;

-- Enable RLS
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies (users can only access their own data)
CREATE POLICY "Users can manage own social_accounts" ON social_accounts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own social_posts" ON social_posts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own ai_conversations" ON ai_conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own ai_artifacts" ON ai_artifacts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own ai_recommendations" ON ai_recommendations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own activity_log" ON activity_log FOR ALL USING (auth.uid() = user_id);
