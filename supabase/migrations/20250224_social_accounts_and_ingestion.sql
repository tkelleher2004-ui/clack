-- =============================================================
-- Phase 2: Social Media Connections & Data Ingestion
-- =============================================================

-- social_accounts: OAuth connections per user/platform
-- Tokens stored encrypted (application-level encryption before insert)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'tiktok', 'linkedin', 'twitter', 'facebook')),
  external_account_id TEXT NOT NULL,
  account_name TEXT,
  account_avatar_url TEXT,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  -- Encrypted JSON: { access_token, refresh_token, token_expires_at }
  encrypted_tokens TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'synced', 'error')),
  sync_progress TEXT,
  sync_error TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own social accounts" ON social_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own social accounts" ON social_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own social accounts" ON social_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own social accounts" ON social_accounts FOR DELETE USING (auth.uid() = user_id);

-- social_posts: All published content from connected accounts
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL,
  post_type TEXT NOT NULL,
  title TEXT,
  caption TEXT,
  hashtags TEXT[],
  media_url TEXT,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ,
  external_post_id TEXT NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(social_account_id, external_post_id)
);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own social posts" ON social_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own social posts" ON social_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own social posts" ON social_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own social posts" ON social_posts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_social_posts_user_platform ON social_posts(user_id, platform);
CREATE INDEX idx_social_posts_published ON social_posts(published_at DESC);

-- post_analytics: Per-post engagement metrics
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  social_post_id UUID REFERENCES social_posts(id) ON DELETE CASCADE NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  watch_time_avg REAL,
  engagement_rate REAL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(social_post_id)
);

ALTER TABLE post_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own post analytics" ON post_analytics FOR SELECT
  USING (EXISTS (SELECT 1 FROM social_posts sp WHERE sp.id = social_post_id AND sp.user_id = auth.uid()));
CREATE POLICY "Users can insert own post analytics" ON post_analytics FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM social_posts sp WHERE sp.id = social_post_id AND sp.user_id = auth.uid()));
CREATE POLICY "Users can update own post analytics" ON post_analytics FOR UPDATE
  USING (EXISTS (SELECT 1 FROM social_posts sp WHERE sp.id = social_post_id AND sp.user_id = auth.uid()));

-- audience_data: Follower demographics and growth
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS audience_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE CASCADE NOT NULL,
  follower_count INTEGER NOT NULL,
  following_count INTEGER DEFAULT 0,
  demographics JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audience_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own audience data" ON audience_data FOR SELECT
  USING (EXISTS (SELECT 1 FROM social_accounts sa WHERE sa.id = social_account_id AND sa.user_id = auth.uid()));
CREATE POLICY "Users can insert own audience data" ON audience_data FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM social_accounts sa WHERE sa.id = social_account_id AND sa.user_id = auth.uid()));

-- channel_analytics: Overall channel/profile metrics
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS channel_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE CASCADE NOT NULL,
  total_views BIGINT DEFAULT 0,
  avg_engagement_rate REAL DEFAULT 0,
  posting_frequency REAL DEFAULT 0,
  top_content_types JSONB,
  growth_rate REAL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE channel_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own channel analytics" ON channel_analytics FOR SELECT
  USING (EXISTS (SELECT 1 FROM social_accounts sa WHERE sa.id = social_account_id AND sa.user_id = auth.uid()));
CREATE POLICY "Users can insert own channel analytics" ON channel_analytics FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM social_accounts sa WHERE sa.id = social_account_id AND sa.user_id = auth.uid()));
