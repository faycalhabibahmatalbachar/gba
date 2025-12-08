-- ========================================
-- SCRIPT COMPLET POUR TOUT RÉPARER
-- ========================================

-- PARTIE 1: SYSTÈME DE COMMANDES
-- ========================================

-- Supprimer les anciennes fonctions et tables
DROP FUNCTION IF EXISTS generate_order_number() CASCADE;
DROP FUNCTION IF EXISTS set_order_number() CASCADE;
DROP FUNCTION IF EXISTS update_order_updated_at() CASCADE;
DROP FUNCTION IF EXISTS record_order_status_change() CASCADE;
DROP FUNCTION IF EXISTS get_order_statistics(VARCHAR) CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS order_status_history CASCADE;
DROP TABLE IF EXISTS order_coupons CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- Ajouter is_admin si n'existe pas
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

UPDATE profiles 
SET is_admin = true 
WHERE email IN ('admin@example.com', 'faycalhabibahmat@gmail.com');

-- Créer la table orders
CREATE TABLE orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending',
    payment_status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50) DEFAULT 'cash_on_delivery',
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    shipping_cost DECIMAL(12,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
    billing_address JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    admin_notes TEXT,
    customer_phone VARCHAR(20),
    estimated_delivery DATE,
    actual_delivery TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100),
    product_image TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    options JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fonction generate_order_number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR AS $$
DECLARE
    new_number VARCHAR;
    year_month VARCHAR;
    sequence_number INTEGER;
BEGIN
    year_month := TO_CHAR(NOW(), 'YYYYMM');
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 'ORD-\d{6}-(\d{4})') AS INTEGER)), 0) + 1
    INTO sequence_number
    FROM orders
    WHERE order_number LIKE 'ORD-' || year_month || '-%';
    new_number := 'ORD-' || year_month || '-' || LPAD(sequence_number::TEXT, 4, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger order number
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := generate_order_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_order_number();

-- RLS pour orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own orders" ON orders
    FOR SELECT
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.is_admin = true
    ));

CREATE POLICY "Users can create their own orders" ON orders
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update orders" ON orders
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.is_admin = true
    ));

CREATE POLICY "Users can view their order items" ON order_items
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_items.order_id 
        AND (orders.user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.is_admin = true
        ))
    ));

CREATE POLICY "Users can create order items" ON order_items
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_items.order_id 
        AND orders.user_id = auth.uid()
    ));

-- Vue order_details_view
CREATE OR REPLACE VIEW order_details_view AS
SELECT 
    o.*,
    p.email as customer_email,
    COALESCE(p.first_name || ' ' || p.last_name, p.email) as customer_name,
    p.phone as customer_phone_profile,
    COUNT(oi.id) as total_items,
    COALESCE(
        json_agg(
            json_build_object(
                'id', oi.id,
                'product_name', oi.product_name,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'total_price', oi.total_price,
                'product_image', oi.product_image
            ) ORDER BY oi.created_at
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::json
    ) as items
FROM orders o
LEFT JOIN profiles p ON o.user_id = p.id
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, p.email, p.first_name, p.last_name, p.phone;

GRANT SELECT ON order_details_view TO authenticated;

-- Fonction get_order_statistics
CREATE OR REPLACE FUNCTION get_order_statistics(p_period VARCHAR DEFAULT 'month')
RETURNS TABLE (
    total_orders BIGINT,
    total_revenue DECIMAL,
    average_order_value DECIMAL,
    pending_orders BIGINT,
    completed_orders BIGINT,
    cancelled_orders BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT,
        COALESCE(SUM(total_amount), 0)::DECIMAL,
        COALESCE(AVG(total_amount), 0)::DECIMAL,
        COUNT(*) FILTER (WHERE status = 'pending')::BIGINT,
        COUNT(*) FILTER (WHERE status = 'delivered')::BIGINT,
        COUNT(*) FILTER (WHERE status = 'cancelled')::BIGINT
    FROM orders
    WHERE 
        CASE p_period
            WHEN 'day' THEN created_at >= CURRENT_DATE
            WHEN 'week' THEN created_at >= CURRENT_DATE - INTERVAL '7 days'
            WHEN 'month' THEN created_at >= CURRENT_DATE - INTERVAL '30 days'
            WHEN 'year' THEN created_at >= CURRENT_DATE - INTERVAL '365 days'
            ELSE true
        END;
END;
$$ LANGUAGE plpgsql;

-- PARTIE 2: SYSTÈME DE TRACKING DES ACTIVITÉS
-- ========================================

-- Supprimer les anciennes tables et fonctions
DROP TABLE IF EXISTS user_activity_metrics CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS user_activities CASCADE;
DROP VIEW IF EXISTS top_viewed_products CASCADE;
DROP VIEW IF EXISTS conversion_metrics CASCADE;
DROP FUNCTION IF EXISTS track_user_activity CASCADE;
DROP FUNCTION IF EXISTS get_realtime_analytics CASCADE;
DROP FUNCTION IF EXISTS get_user_activity_summary CASCADE;

-- Table user_activities
CREATE TABLE user_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    action_details JSONB DEFAULT '{}'::jsonb,
    entity_type VARCHAR(50),
    entity_id UUID,
    entity_name VARCHAR(255),
    page_name VARCHAR(100),
    page_url TEXT,
    session_id UUID,
    device_type VARCHAR(50),
    device_info JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table user_sessions
CREATE TABLE user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    pages_visited INTEGER DEFAULT 0,
    actions_count INTEGER DEFAULT 0,
    device_info JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table user_activity_metrics
CREATE TABLE user_activity_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    total_sessions INTEGER DEFAULT 0,
    total_time_spent_seconds INTEGER DEFAULT 0,
    total_page_views INTEGER DEFAULT 0,
    total_actions INTEGER DEFAULT 0,
    cart_additions INTEGER DEFAULT 0,
    cart_removals INTEGER DEFAULT 0,
    favorites_added INTEGER DEFAULT 0,
    favorites_removed INTEGER DEFAULT 0,
    products_viewed INTEGER DEFAULT 0,
    orders_placed INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    searches_made INTEGER DEFAULT 0,
    last_activity_at TIMESTAMP WITH TIME ZONE,
    last_activity_type VARCHAR(50),
    period_type VARCHAR(20) DEFAULT 'all_time',
    period_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_action_type ON user_activities(action_type);
CREATE INDEX idx_user_activities_created_at ON user_activities(created_at DESC);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_activity_metrics_user_id ON user_activity_metrics(user_id, period_type);

-- Fonction get_realtime_analytics
CREATE OR REPLACE FUNCTION get_realtime_analytics()
RETURNS TABLE (
    active_users_now INTEGER,
    active_sessions INTEGER,
    actions_last_hour INTEGER,
    actions_today INTEGER,
    top_action_type VARCHAR,
    top_page VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT user_id)::INTEGER,
        COUNT(DISTINCT session_id)::INTEGER,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour')::INTEGER,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::INTEGER,
        MODE() WITHIN GROUP (ORDER BY action_type),
        MODE() WITHIN GROUP (ORDER BY page_name)
    FROM user_activities
    WHERE created_at >= NOW() - INTERVAL '15 minutes';
END;
$$ LANGUAGE plpgsql;

-- Vue top_viewed_products
CREATE OR REPLACE VIEW top_viewed_products AS
SELECT 
    entity_id as product_id,
    entity_name as product_name,
    COUNT(*) as view_count,
    COUNT(DISTINCT user_id) as unique_viewers,
    MAX(created_at) as last_viewed
FROM user_activities
WHERE action_type = 'product_view'
AND entity_type = 'product'
AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY entity_id, entity_name
ORDER BY view_count DESC
LIMIT 50;

-- Vue conversion_metrics
CREATE OR REPLACE VIEW conversion_metrics AS
WITH funnel AS (
    SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT user_id) FILTER (WHERE action_type = 'product_view') as viewers,
        COUNT(DISTINCT user_id) FILTER (WHERE action_type = 'cart_add') as cart_users,
        COUNT(DISTINCT user_id) FILTER (WHERE action_type = 'checkout_started') as checkout_users,
        COUNT(DISTINCT user_id) FILTER (WHERE action_type = 'order_placed') as buyers
    FROM user_activities
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE(created_at)
)
SELECT 
    date,
    viewers,
    cart_users,
    checkout_users,
    buyers,
    CASE WHEN viewers > 0 THEN ROUND(100.0 * cart_users / viewers, 2) ELSE 0 END as view_to_cart_rate,
    CASE WHEN cart_users > 0 THEN ROUND(100.0 * checkout_users / cart_users, 2) ELSE 0 END as cart_to_checkout_rate,
    CASE WHEN checkout_users > 0 THEN ROUND(100.0 * buyers / checkout_users, 2) ELSE 0 END as checkout_to_purchase_rate,
    CASE WHEN viewers > 0 THEN ROUND(100.0 * buyers / viewers, 2) ELSE 0 END as overall_conversion_rate
FROM funnel
ORDER BY date DESC;

-- RLS pour user_activities
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activities" ON user_activities
    FOR SELECT
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND is_admin = true
    ));

CREATE POLICY "Users can create own activities" ON user_activities
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all activities" ON user_activities
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND is_admin = true
    ));

GRANT SELECT ON top_viewed_products TO authenticated;
GRANT SELECT ON conversion_metrics TO authenticated;

-- Rafraîchir le cache
NOTIFY pgrst, 'reload schema';

-- Vérification finale
SELECT 'Tables créées avec succès!' as message;
