-- ========================================
-- SYSTÈME DE GESTION DES COMMANDES (VERSION SAFE)
-- ========================================

-- 1. Table des commandes principales
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- Statuts
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending',      -- En attente de confirmation
        'confirmed',    -- Confirmée par l'admin
        'processing',   -- En préparation
        'shipped',      -- Expédiée
        'delivered',    -- Livrée
        'cancelled',    -- Annulée
        'refunded'      -- Remboursée
    )),
    
    -- Paiement (simplifié pour l'instant)
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN (
        'pending',
        'paid', 
        'failed',
        'refunded'
    )),
    payment_method VARCHAR(50) DEFAULT 'cash_on_delivery',
    
    -- Montants
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    shipping_cost DECIMAL(12,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    -- Adresses (JSONB pour flexibilité)
    shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
    billing_address JSONB DEFAULT '{}'::jsonb,
    
    -- Métadonnées
    notes TEXT,
    admin_notes TEXT,
    customer_phone VARCHAR(20),
    estimated_delivery DATE,
    actual_delivery TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE
);

-- 2. Table des articles de commande
CREATE TABLE IF NOT EXISTS order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    
    -- Détails produit au moment de la commande (snapshot)
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100),
    product_image TEXT,
    
    -- Quantité et prix
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    
    -- Options/Variantes
    options JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Table historique des statuts
CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by UUID REFERENCES profiles(id),
    
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Table pour les coupons appliqués
CREATE TABLE IF NOT EXISTS order_coupons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    coupon_code VARCHAR(50) NOT NULL,
    discount_amount DECIMAL(12,2) NOT NULL,
    discount_type VARCHAR(20) CHECK (discount_type IN ('fixed', 'percentage')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Index pour optimiser les performances (avec vérification d'existence)
DO $$ 
BEGIN
    -- Index sur orders
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_user_id') THEN
        CREATE INDEX idx_orders_user_id ON orders(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_status') THEN
        CREATE INDEX idx_orders_status ON orders(status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_created_at') THEN
        CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_order_number') THEN
        CREATE INDEX idx_orders_order_number ON orders(order_number);
    END IF;
    
    -- Index sur order_items
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_order_items_order_id') THEN
        CREATE INDEX idx_order_items_order_id ON order_items(order_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_order_items_product_id') THEN
        CREATE INDEX idx_order_items_product_id ON order_items(product_id);
    END IF;
    
    -- Index sur order_status_history
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_order_status_history_order_id') THEN
        CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
    END IF;
END $$;

-- 6. Fonction pour générer un numéro de commande unique
DROP FUNCTION IF EXISTS generate_order_number();
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR AS $$
DECLARE
    new_number VARCHAR;
    year_month VARCHAR;
    sequence_number INTEGER;
BEGIN
    -- Format: ORD-YYYYMM-XXXX (ex: ORD-202409-0001)
    year_month := TO_CHAR(NOW(), 'YYYYMM');
    
    -- Obtenir le prochain numéro de séquence pour ce mois
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 12 FOR 4) AS INTEGER)), 0) + 1
    INTO sequence_number
    FROM orders
    WHERE order_number LIKE 'ORD-' || year_month || '-%';
    
    new_number := 'ORD-' || year_month || '-' || LPAD(sequence_number::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger pour générer automatiquement le numéro de commande
DROP TRIGGER IF EXISTS trigger_set_order_number ON orders;
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := generate_order_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_order_number();

-- 8. Trigger pour mettre à jour updated_at
DROP TRIGGER IF EXISTS trigger_update_order_updated_at ON orders;
CREATE OR REPLACE FUNCTION update_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_order_updated_at();

-- 9. Fonction pour enregistrer l'historique des changements de statut
DROP TRIGGER IF EXISTS trigger_record_order_status_change ON orders;
CREATE OR REPLACE FUNCTION record_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO order_status_history (
            order_id,
            previous_status,
            new_status,
            changed_by
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            auth.uid()
        );
        
        -- Mettre à jour les timestamps spécifiques
        CASE NEW.status
            WHEN 'confirmed' THEN NEW.confirmed_at := NOW();
            WHEN 'shipped' THEN NEW.shipped_at := NOW();
            WHEN 'delivered' THEN NEW.delivered_at := NOW();
            ELSE NULL;
        END CASE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_record_order_status_change
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    EXECUTE FUNCTION record_order_status_change();

-- 10. RLS (Row Level Security)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_coupons ENABLE ROW LEVEL SECURITY;

-- Supprimer les politiques existantes avant de les recréer
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
DROP POLICY IF EXISTS "Only admins can update orders" ON orders;
DROP POLICY IF EXISTS "Users can view their own order items" ON order_items;
DROP POLICY IF EXISTS "Users can create order items for their orders" ON order_items;
DROP POLICY IF EXISTS "Users can view status history of their orders" ON order_status_history;
DROP POLICY IF EXISTS "Only admins can insert status history" ON order_status_history;

-- Politiques pour orders
CREATE POLICY "Users can view their own orders" ON orders
    FOR SELECT
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (is_admin = true OR email IN ('admin@example.com', 'faycalhabibahmat@gmail.com'))
    ));

CREATE POLICY "Users can create their own orders" ON orders
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Only admins can update orders" ON orders
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (is_admin = true OR email IN ('admin@example.com', 'faycalhabibahmat@gmail.com'))
    ));

-- Politiques pour order_items
CREATE POLICY "Users can view their own order items" ON order_items
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_items.order_id 
        AND (orders.user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND (is_admin = true OR email IN ('admin@example.com', 'faycalhabibahmat@gmail.com'))
        ))
    ));

CREATE POLICY "Users can create order items for their orders" ON order_items
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_items.order_id 
        AND orders.user_id = auth.uid()
    ));

-- Politiques pour order_status_history
CREATE POLICY "Users can view status history of their orders" ON order_status_history
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_status_history.order_id 
        AND (orders.user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND (is_admin = true OR email IN ('admin@example.com', 'faycalhabibahmat@gmail.com'))
        ))
    ));

CREATE POLICY "Only admins can insert status history" ON order_status_history
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (is_admin = true OR email IN ('admin@example.com', 'faycalhabibahmat@gmail.com'))
    ));

-- 11. Fonction pour calculer les statistiques des commandes
DROP FUNCTION IF EXISTS get_order_statistics(VARCHAR);
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
        COUNT(*)::BIGINT as total_orders,
        COALESCE(SUM(total_amount), 0)::DECIMAL as total_revenue,
        COALESCE(AVG(total_amount), 0)::DECIMAL as average_order_value,
        COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_orders,
        COUNT(*) FILTER (WHERE status = 'delivered')::BIGINT as completed_orders,
        COUNT(*) FILTER (WHERE status = 'cancelled')::BIGINT as cancelled_orders
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

-- 12. Vue pour les commandes avec détails
DROP VIEW IF EXISTS order_details_view;
CREATE OR REPLACE VIEW order_details_view AS
SELECT 
    o.*,
    p.email as customer_email,
    p.first_name || ' ' || p.last_name as customer_name,
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

-- Permissions pour la vue
GRANT SELECT ON order_details_view TO authenticated;

COMMENT ON TABLE orders IS 'Table principale des commandes';
COMMENT ON TABLE order_items IS 'Articles de chaque commande';
COMMENT ON TABLE order_status_history IS 'Historique des changements de statut';
COMMENT ON COLUMN orders.order_number IS 'Numéro unique de commande au format ORD-YYYYMM-XXXX';
