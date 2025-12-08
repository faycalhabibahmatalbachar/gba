-- ========================================
-- SYSTÈME COMPLET DE TRACKING DES ACTIVITÉS UTILISATEURS
-- ========================================

-- 1. Table principale des activités
CREATE TABLE IF NOT EXISTS user_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Type d'action avec emojis
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
        'cart_add',           -- 🛒 Ajout panier
        'cart_remove',        -- 🛒 Suppression panier
        'favorite_add',       -- ❤️ Ajout favoris  
        'favorite_remove',    -- ❤️ Suppression favoris
        'product_view',       -- 👁️ Produit consulté
        'profile_update',     -- 👤 Mise à jour profil
        'login',              -- 🔐 Connexion
        'logout',             -- 🔐 Déconnexion
        'order_placed',       -- 📦 Commande passée
        'message_sent',       -- 💬 Message envoyé
        'search',             -- 🔍 Recherche
        'category_view',      -- 📂 Catégorie consultée
        'checkout_started',   -- 💳 Checkout commencé
        'checkout_abandoned', -- ❌ Checkout abandonné
        'payment_completed',  -- ✅ Paiement effectué
        'review_posted',      -- ⭐ Avis posté
        'share_product',      -- 🔗 Produit partagé
        'app_opened',         -- 📱 App ouverte
        'app_closed'          -- 📱 App fermée
    )),
    
    -- Détails de l'action
    action_details JSONB DEFAULT '{}'::jsonb,
    
    -- Entité concernée
    entity_type VARCHAR(50), -- 'product', 'order', 'category', 'message', etc.
    entity_id UUID,
    entity_name VARCHAR(255),
    
    -- Contexte
    page_name VARCHAR(100),
    page_url TEXT,
    session_id UUID,
    
    -- Device info
    device_type VARCHAR(50),
    device_info JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    
    -- Métadonnées
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table des sessions utilisateur
CREATE TABLE IF NOT EXISTS user_sessions (
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

-- 3. Table des métriques agrégées (pour performance)
CREATE TABLE IF NOT EXISTS user_activity_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Compteurs
    total_sessions INTEGER DEFAULT 0,
    total_time_spent_seconds INTEGER DEFAULT 0,
    total_page_views INTEGER DEFAULT 0,
    total_actions INTEGER DEFAULT 0,
    
    -- Activités spécifiques
    cart_additions INTEGER DEFAULT 0,
    cart_removals INTEGER DEFAULT 0,
    favorites_added INTEGER DEFAULT 0,
    favorites_removed INTEGER DEFAULT 0,
    products_viewed INTEGER DEFAULT 0,
    orders_placed INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    searches_made INTEGER DEFAULT 0,
    
    -- Dernière activité
    last_activity_at TIMESTAMP WITH TIME ZONE,
    last_activity_type VARCHAR(50),
    
    -- Période
    period_type VARCHAR(20) DEFAULT 'all_time', -- 'daily', 'weekly', 'monthly', 'all_time'
    period_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_action_type ON user_activities(action_type);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_entity ON user_activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_metrics_user_id ON user_activity_metrics(user_id, period_type);

-- 5. Fonction pour enregistrer une activité
CREATE OR REPLACE FUNCTION track_user_activity(
    p_user_id UUID,
    p_action_type VARCHAR,
    p_action_details JSONB DEFAULT '{}'::jsonb,
    p_entity_type VARCHAR DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_entity_name VARCHAR DEFAULT NULL,
    p_page_name VARCHAR DEFAULT NULL,
    p_session_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_activity_id UUID;
BEGIN
    -- Insérer l'activité
    INSERT INTO user_activities (
        user_id,
        action_type,
        action_details,
        entity_type,
        entity_id,
        entity_name,
        page_name,
        session_id
    ) VALUES (
        p_user_id,
        p_action_type,
        p_action_details,
        p_entity_type,
        p_entity_id,
        p_entity_name,
        p_page_name,
        p_session_id
    ) RETURNING id INTO v_activity_id;
    
    -- Mettre à jour les métriques
    INSERT INTO user_activity_metrics (
        user_id,
        total_actions,
        last_activity_at,
        last_activity_type
    ) VALUES (
        p_user_id,
        1,
        NOW(),
        p_action_type
    )
    ON CONFLICT (user_id) WHERE period_type = 'all_time'
    DO UPDATE SET
        total_actions = user_activity_metrics.total_actions + 1,
        last_activity_at = NOW(),
        last_activity_type = p_action_type;
    
    RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Fonction pour obtenir les statistiques en temps réel
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
        COUNT(DISTINCT user_id)::INTEGER as active_users_now,
        COUNT(DISTINCT session_id)::INTEGER as active_sessions,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour')::INTEGER as actions_last_hour,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::INTEGER as actions_today,
        MODE() WITHIN GROUP (ORDER BY action_type) as top_action_type,
        MODE() WITHIN GROUP (ORDER BY page_name) as top_page
    FROM user_activities
    WHERE created_at >= NOW() - INTERVAL '15 minutes';
END;
$$ LANGUAGE plpgsql;

-- 7. Fonction pour obtenir les métriques d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_activity_summary(p_user_id UUID)
RETURNS TABLE (
    total_sessions BIGINT,
    total_time_spent_minutes INTEGER,
    total_actions BIGINT,
    favorite_products_count BIGINT,
    cart_items_added BIGINT,
    orders_count BIGINT,
    last_activity TIMESTAMP WITH TIME ZONE,
    most_viewed_product VARCHAR,
    activity_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT s.session_id)::BIGINT as total_sessions,
        COALESCE(SUM(s.duration_seconds) / 60, 0)::INTEGER as total_time_spent_minutes,
        COUNT(a.id)::BIGINT as total_actions,
        COUNT(*) FILTER (WHERE a.action_type = 'favorite_add')::BIGINT as favorite_products_count,
        COUNT(*) FILTER (WHERE a.action_type = 'cart_add')::BIGINT as cart_items_added,
        COUNT(*) FILTER (WHERE a.action_type = 'order_placed')::BIGINT as orders_count,
        MAX(a.created_at) as last_activity,
        MODE() WITHIN GROUP (ORDER BY a.entity_name) FILTER (WHERE a.entity_type = 'product') as most_viewed_product,
        LEAST(100, (
            COUNT(DISTINCT DATE(a.created_at)) * 10 + -- Jours actifs
            COUNT(a.id) + -- Total actions
            COUNT(*) FILTER (WHERE a.action_type = 'order_placed') * 20 -- Commandes bonus
        ))::INTEGER as activity_score
    FROM user_activities a
    LEFT JOIN user_sessions s ON s.user_id = a.user_id
    WHERE a.user_id = p_user_id
    GROUP BY a.user_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Vue pour le top des produits consultés
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

-- 9. Vue pour les métriques de conversion
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

-- 10. RLS Policies
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_metrics ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leurs propres activités
CREATE POLICY "Users can view own activities" ON user_activities
    FOR SELECT
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND is_admin = true
    ));

-- Les utilisateurs peuvent créer leurs propres activités
CREATE POLICY "Users can create own activities" ON user_activities
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins peuvent tout voir
CREATE POLICY "Admins can view all activities" ON user_activities
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND is_admin = true
    ));

-- Permissions pour les vues
GRANT SELECT ON top_viewed_products TO authenticated;
GRANT SELECT ON conversion_metrics TO authenticated;

-- Notification pour rafraîchir le cache
NOTIFY pgrst, 'reload schema';
