-- Tables de traçabilité et monitoring avancé

-- Table des connexions utilisateurs
CREATE TABLE IF NOT EXISTS user_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    logout_time TIMESTAMPTZ,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_type VARCHAR(50),
    browser VARCHAR(100),
    os VARCHAR(100),
    location JSONB,
    session_duration INTEGER, -- en secondes
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des activités utilisateurs
CREATE TABLE IF NOT EXISTS user_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL, -- 'login', 'logout', 'view_product', 'add_cart', 'purchase', 'add_favorite', 'remove_favorite', etc.
    activity_details JSONB,
    entity_id UUID, -- ID du produit, commande, etc.
    entity_type VARCHAR(50), -- 'product', 'order', 'cart', 'favorite'
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des statistiques utilisateurs agrégées
CREATE TABLE IF NOT EXISTS user_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    total_connections INTEGER DEFAULT 0,
    connections_today INTEGER DEFAULT 0,
    connections_this_week INTEGER DEFAULT 0,
    connections_this_month INTEGER DEFAULT 0,
    last_login_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    total_time_spent INTEGER DEFAULT 0, -- en secondes
    average_session_duration INTEGER DEFAULT 0, -- en secondes
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    total_favorites INTEGER DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    loyalty_points INTEGER DEFAULT 0,
    account_created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des statistiques horaires
CREATE TABLE IF NOT EXISTS hourly_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    hour_timestamp TIMESTAMPTZ NOT NULL,
    connections_count INTEGER DEFAULT 0,
    activities_count INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0, -- en secondes
    UNIQUE(user_id, hour_timestamp)
);

-- Table des statistiques journalières
CREATE TABLE IF NOT EXISTS daily_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    connections_count INTEGER DEFAULT 0,
    activities_count INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0, -- en secondes
    orders_count INTEGER DEFAULT 0,
    amount_spent DECIMAL(10,2) DEFAULT 0,
    favorites_added INTEGER DEFAULT 0,
    favorites_removed INTEGER DEFAULT 0,
    products_viewed INTEGER DEFAULT 0,
    UNIQUE(user_id, date)
);

-- Table des statistiques mensuelles
CREATE TABLE IF NOT EXISTS monthly_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    month DATE NOT NULL,
    connections_count INTEGER DEFAULT 0,
    activities_count INTEGER DEFAULT 0,
    total_time_spent INTEGER DEFAULT 0, -- en secondes
    orders_count INTEGER DEFAULT 0,
    amount_spent DECIMAL(10,2) DEFAULT 0,
    new_favorites INTEGER DEFAULT 0,
    products_viewed INTEGER DEFAULT 0,
    average_session_duration INTEGER DEFAULT 0,
    UNIQUE(user_id, month)
);

-- Table de monitoring en temps réel
CREATE TABLE IF NOT EXISTS real_time_monitoring (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_type VARCHAR(50) NOT NULL, -- 'active_users', 'orders', 'revenue', 'favorites', 'cart_items'
    metric_value JSONB NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Table des alertes et notifications
CREATE TABLE IF NOT EXISTS monitoring_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL, -- 'high_traffic', 'low_stock', 'unusual_activity', 'system_error'
    severity VARCHAR(20) NOT NULL, -- 'info', 'warning', 'error', 'critical'
    message TEXT NOT NULL,
    details JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_user_connections_user_id ON user_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_login_time ON user_connections(login_time);
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_user_activities_type ON user_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_hourly_stats_user_hour ON hourly_stats(user_id, hour_timestamp);
CREATE INDEX IF NOT EXISTS idx_daily_stats_user_date ON daily_stats(user_id, date);
CREATE INDEX IF NOT EXISTS idx_monthly_stats_user_month ON monthly_stats(user_id, month);
CREATE INDEX IF NOT EXISTS idx_real_time_monitoring_type ON real_time_monitoring(metric_type);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_type ON monitoring_alerts(alert_type);

-- Fonction pour enregistrer une connexion
CREATE OR REPLACE FUNCTION log_user_connection(
    p_user_id UUID,
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_device_type VARCHAR(50) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_connection_id UUID;
BEGIN
    INSERT INTO user_connections (user_id, ip_address, user_agent, device_type)
    VALUES (p_user_id, p_ip_address, p_user_agent, p_device_type)
    RETURNING id INTO v_connection_id;
    
    -- Mettre à jour les statistiques
    INSERT INTO user_stats (user_id, total_connections, connections_today, last_login_at)
    VALUES (p_user_id, 1, 1, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        total_connections = user_stats.total_connections + 1,
        connections_today = user_stats.connections_today + 1,
        last_login_at = NOW(),
        updated_at = NOW();
    
    RETURN v_connection_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour enregistrer une activité
CREATE OR REPLACE FUNCTION log_user_activity(
    p_user_id UUID,
    p_activity_type VARCHAR(100),
    p_activity_details JSONB DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_entity_type VARCHAR(50) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_activity_id UUID;
BEGIN
    INSERT INTO user_activities (user_id, activity_type, activity_details, entity_id, entity_type)
    VALUES (p_user_id, p_activity_type, p_activity_details, p_entity_id, p_entity_type)
    RETURNING id INTO v_activity_id;
    
    -- Mettre à jour last_activity_at dans user_stats
    UPDATE user_stats 
    SET last_activity_at = NOW(), updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Mettre à jour les compteurs selon le type d'activité
    IF p_activity_type = 'add_favorite' THEN
        UPDATE user_stats 
        SET total_favorites = total_favorites + 1, updated_at = NOW()
        WHERE user_id = p_user_id;
    ELSIF p_activity_type = 'remove_favorite' THEN
        UPDATE user_stats 
        SET total_favorites = GREATEST(total_favorites - 1, 0), updated_at = NOW()
        WHERE user_id = p_user_id;
    END IF;
    
    RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour les statistiques horaires
CREATE OR REPLACE FUNCTION update_hourly_stats()
RETURNS void AS $$
BEGIN
    INSERT INTO hourly_stats (user_id, hour_timestamp, connections_count, activities_count)
    SELECT 
        user_id,
        date_trunc('hour', NOW()) as hour_timestamp,
        COUNT(DISTINCT uc.id) as connections_count,
        COUNT(DISTINCT ua.id) as activities_count
    FROM auth.users u
    LEFT JOIN user_connections uc ON u.id = uc.user_id 
        AND uc.login_time >= date_trunc('hour', NOW())
        AND uc.login_time < date_trunc('hour', NOW()) + interval '1 hour'
    LEFT JOIN user_activities ua ON u.id = ua.user_id
        AND ua.created_at >= date_trunc('hour', NOW())
        AND ua.created_at < date_trunc('hour', NOW()) + interval '1 hour'
    GROUP BY user_id
    ON CONFLICT (user_id, hour_timestamp) DO UPDATE SET
        connections_count = EXCLUDED.connections_count,
        activities_count = EXCLUDED.activities_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les métriques en temps réel
CREATE OR REPLACE FUNCTION get_real_time_metrics()
RETURNS TABLE (
    active_users_count INTEGER,
    orders_today INTEGER,
    revenue_today DECIMAL,
    favorites_today INTEGER,
    cart_items_count INTEGER,
    new_users_today INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(DISTINCT user_id) FROM user_connections 
         WHERE login_time >= NOW() - interval '30 minutes'
         AND (logout_time IS NULL OR logout_time > NOW() - interval '30 minutes'))::INTEGER as active_users_count,
        (SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE)::INTEGER as orders_today,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE created_at >= CURRENT_DATE) as revenue_today,
        (SELECT COUNT(*) FROM user_activities 
         WHERE activity_type = 'add_favorite' AND created_at >= CURRENT_DATE)::INTEGER as favorites_today,
        (SELECT COUNT(*) FROM cart_items)::INTEGER as cart_items_count,
        (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE)::INTEGER as new_users_today;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour nettoyer les anciennes données de monitoring (garder 30 jours)
CREATE OR REPLACE FUNCTION cleanup_old_monitoring_data()
RETURNS void AS $$
BEGIN
    DELETE FROM real_time_monitoring WHERE timestamp < NOW() - interval '30 days';
    DELETE FROM user_activities WHERE created_at < NOW() - interval '90 days';
    DELETE FROM hourly_stats WHERE hour_timestamp < NOW() - interval '30 days';
END;
$$ LANGUAGE plpgsql;

-- Vue pour les statistiques utilisateurs détaillées
CREATE OR REPLACE VIEW user_detailed_stats AS
SELECT 
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.avatar_url,
    us.total_connections,
    us.connections_today,
    us.connections_this_month,
    us.last_login_at,
    us.last_activity_at,
    us.total_time_spent,
    us.average_session_duration,
    us.total_orders,
    us.total_spent,
    us.total_favorites,
    us.loyalty_points,
    p.created_at as member_since,
    CASE 
        WHEN us.last_login_at > NOW() - interval '30 minutes' THEN 'online'
        WHEN us.last_login_at > NOW() - interval '24 hours' THEN 'recently_active'
        ELSE 'inactive'
    END as status
FROM profiles p
LEFT JOIN user_stats us ON p.id = us.user_id;

-- Permissions pour l'application
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
