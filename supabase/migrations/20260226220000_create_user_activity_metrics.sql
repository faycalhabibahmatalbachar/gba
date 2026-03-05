-- Migration: Create user_activity_metrics table for user analytics
-- Created: 2026-02-26
-- Purpose: Track user activity metrics for admin dashboard

-- Create user_activity_metrics table
CREATE TABLE IF NOT EXISTS user_activity_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL DEFAULT 'all_time', -- 'all_time', 'daily', 'weekly', 'monthly'
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    
    -- Activity counts
    total_actions INTEGER DEFAULT 0,
    orders_placed INTEGER DEFAULT 0,
    products_viewed INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    favorites_added INTEGER DEFAULT 0,
    
    -- Session metrics
    total_sessions INTEGER DEFAULT 0,
    total_time_spent_seconds INTEGER DEFAULT 0,
    
    -- Financial metrics
    total_amount_spent NUMERIC(12,2) DEFAULT 0,
    
    -- Timestamps
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE user_activity_metrics IS 'Aggregated user activity metrics for analytics';

-- Create unique partial index for all_time (where period_start IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_metrics_all_time 
ON user_activity_metrics (user_id, period_type) 
WHERE period_start IS NULL;

-- Create unique index for periods with dates (period_start IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_metrics_period 
ON user_activity_metrics (user_id, period_type, period_start) 
WHERE period_start IS NOT NULL;

-- Create other indexes
CREATE INDEX IF NOT EXISTS idx_user_activity_metrics_user_id ON user_activity_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_metrics_period_type ON user_activity_metrics(period_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_metrics_period_dates ON user_activity_metrics(period_start, period_end);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_user_activity_metrics ON user_activity_metrics;
CREATE TRIGGER trg_update_user_activity_metrics
    BEFORE UPDATE ON user_activity_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to auto-create all_time metrics for new users
CREATE OR REPLACE FUNCTION create_user_activity_metrics_on_signup()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_activity_metrics (user_id, period_type)
    VALUES (NEW.id, 'all_time')
    ON CONFLICT (user_id, period_type) WHERE period_start IS NULL DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS trg_create_user_metrics_on_signup ON auth.users;
CREATE TRIGGER trg_create_user_metrics_on_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_activity_metrics_on_signup();

-- Grant permissions
GRANT SELECT ON user_activity_metrics TO authenticated;
GRANT SELECT ON user_activity_metrics TO anon;

-- Create RLS policy for authenticated users to view their own metrics
ALTER TABLE user_activity_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_activity_metrics_view_own ON user_activity_metrics;
CREATE POLICY user_activity_metrics_view_own ON user_activity_metrics
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Output confirmation
SELECT 'Migration completed: Created user_activity_metrics table' AS result;
