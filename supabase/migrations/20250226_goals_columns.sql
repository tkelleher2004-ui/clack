-- Add goals columns to brand_profiles
ALTER TABLE brand_profiles
  ADD COLUMN IF NOT EXISTS goals_raw TEXT,
  ADD COLUMN IF NOT EXISTS goals_timeframe TEXT CHECK (goals_timeframe IN ('1_month', '3_months', '6_months', '1_year', 'none')),
  ADD COLUMN IF NOT EXISTS goals_structured JSONB,
  ADD COLUMN IF NOT EXISTS goals_updated_at TIMESTAMPTZ;
