-- Migration: Populate user_activity_metrics from user_activities
-- Created: 2026-02-27
-- Purpose: Sync user_activity_metrics table with real data from user_activities

-- ============================================================
-- 1. Function to update user_activity_metrics from user_activities
-- ============================================================
CREATE OR REPLACE FUNCTION update_user_activity_metrics(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_actions INTEGER := 0;
    v_orders_placed INTEGER := 0;
    v_products_viewed INTEGER := 0;
    v_messages_sent INTEGER := 0;
    v_favorites_added INTEGER := 0;
    v_total_sessions INTEGER := 0;
    v_total_time_spent INTEGER := 0;
    v_total_amount_spent NUMERIC := 0;
    v_last_activity TIMESTAMPTZ;
BEGIN
    -- Count actions from user_activities
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE action_type IN ('order_placed', 'order_create', 'checkout_complete')),
        COUNT(*) FILTER (WHERE action_type IN ('product_view', 'view_product')),
        COUNT(*) FILTER (WHERE action_type IN ('message_send', 'chat_send', 'send_message')),
        COUNT(*) FILTER (WHERE action_type IN ('favorite_add', 'add_favorite', 'add_to_favorites'))
    INTO 
        v_total_actions,
        v_orders_placed,
        v_products_viewed,
        v_messages_sent,
        v_favorites_added
    FROM user_activities
    WHERE user_id = p_user_id;
    
    -- Count sessions from user_sessions table if exists
    SELECT COUNT(*), COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))::INTEGER), 0)
    INTO v_total_sessions, v_total_time_spent
    FROM user_sessions
    WHERE user_id = p_user_id;
    
    -- Get total amount spent from orders
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total_amount_spent
    FROM orders
    WHERE user_id = p_user_id AND status NOT IN ('cancelled');
    
    -- Get last activity
    SELECT MAX(created_at) INTO v_last_activity
    FROM user_activities
    WHERE user_id = p_user_id;
    
    -- Upsert into user_activity_metrics
    INSERT INTO user_activity_metrics (
        user_id, 
        period_type, 
        total_actions, 
        orders_placed, 
        products_viewed, 
        messages_sent, 
        favorites_added, 
        total_sessions, 
        total_time_spent_seconds, 
        total_amount_spent,
        last_activity_at
    ) VALUES (
        p_user_id,
        'all_time',
        v_total_actions,
        v_orders_placed,
        v_products_viewed,
        v_messages_sent,
        v_favorites_added,
        v_total_sessions,
        v_total_time_spent,
        v_total_amount_spent,
        v_last_activity
    )
    ON CONFLICT (user_id, period_type) WHERE period_start IS NULL
    DO UPDATE SET
        total_actions = EXCLUDED.total_actions,
        orders_placed = EXCLUDED.orders_placed,
        products_viewed = EXCLUDED.products_viewed,
        messages_sent = EXCLUDED.messages_sent,
        favorites_added = EXCLUDED.favorites_added,
        total_sessions = EXCLUDED.total_sessions,
        total_time_spent_seconds = EXCLUDED.total_time_spent_seconds,
        total_amount_spent = EXCLUDED.total_amount_spent,
        last_activity_at = EXCLUDED.last_activity_at,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. Trigger to auto-update metrics on new activity
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_update_user_activity_metrics()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_user_activity_metrics(NEW.user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_metrics_on_activity ON user_activities;
CREATE TRIGGER trg_update_metrics_on_activity
    AFTER INSERT ON user_activities
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_user_activity_metrics();

-- ============================================================
-- 3. Populate existing data for all users
-- ============================================================
INSERT INTO user_activity_metrics (user_id, period_type)
SELECT id, 'all_time' FROM auth.users
ON CONFLICT (user_id, period_type) WHERE period_start IS NULL DO NOTHING;

-- Update metrics for all existing users
DO $$
DECLARE
    u RECORD;
BEGIN
    FOR u IN SELECT id FROM auth.users LOOP
        PERFORM update_user_activity_metrics(u.id);
    END LOOP;
END $$;

-- ============================================================
-- 4. Add admin RLS policy for user_activity_metrics
-- ============================================================
DROP POLICY IF EXISTS admin_view_all_user_metrics ON user_activity_metrics;
CREATE POLICY admin_view_all_user_metrics ON user_activity_metrics
    FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ============================================================
-- 5. Output confirmation
-- ============================================================
SELECT 'Migration completed: Populated user_activity_metrics' AS result;
