-- ========================================
-- SCRIPT COMPLET POUR FIXER LE SYSTÈME DE COMMANDES
-- ========================================

-- 1. Supprimer les fonctions existantes
DROP FUNCTION IF EXISTS generate_order_number() CASCADE;
DROP FUNCTION IF EXISTS set_order_number() CASCADE;
DROP FUNCTION IF EXISTS update_order_updated_at() CASCADE;
DROP FUNCTION IF EXISTS record_order_status_change() CASCADE;
DROP FUNCTION IF EXISTS get_order_statistics(VARCHAR) CASCADE;

-- 2. Ajouter la colonne is_admin si elle n'existe pas
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 3. Mettre à jour les admins
UPDATE profiles 
SET is_admin = true 
WHERE email IN ('admin@example.com', 'faycalhabibahmat@gmail.com');

-- 4. Supprimer et recréer la table orders pour être sûr
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS order_status_history CASCADE;
DROP TABLE IF EXISTS order_coupons CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- 5. Créer la table orders avec TOUTES les colonnes nécessaires
CREATE TABLE orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- Statuts
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'confirmed', 'processing', 'shipped', 
        'delivered', 'cancelled', 'refunded'
    )),
    
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN (
        'pending', 'paid', 'failed', 'refunded'
    )),
    payment_method VARCHAR(50) DEFAULT 'cash_on_delivery',
    
    -- IMPORTANT: Tous les montants doivent être présents
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    shipping_cost DECIMAL(12,2) DEFAULT 0,  -- COLONNE CRUCIALE
    discount_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    -- Adresses
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

-- 6. Table order_items
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

-- 7. Table order_status_history
CREATE TABLE order_status_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by UUID REFERENCES profiles(id),
    
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Fonction pour générer le numéro de commande
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR AS $$
DECLARE
    new_number VARCHAR;
    year_month VARCHAR;
    sequence_number INTEGER;
BEGIN
    year_month := TO_CHAR(NOW(), 'YYYYMM');
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(order_number FROM 'ORD-\d{6}-(\d{4})') AS INTEGER)
    ), 0) + 1
    INTO sequence_number
    FROM orders
    WHERE order_number LIKE 'ORD-' || year_month || '-%';
    
    new_number := 'ORD-' || year_month || '-' || LPAD(sequence_number::TEXT, 4, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger pour le numéro de commande
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

-- 10. Trigger pour updated_at
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

-- 11. Activer RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- 12. Politiques RLS pour orders
CREATE POLICY "Users can view their own orders" ON orders
    FOR SELECT
    USING (
        auth.uid() = user_id 
        OR 
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.is_admin = true
        )
    );

CREATE POLICY "Users can create their own orders" ON orders
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update orders" ON orders
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.is_admin = true
        )
    );

CREATE POLICY "Admins can delete orders" ON orders
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.is_admin = true
        )
    );

-- 13. Politiques RLS pour order_items
CREATE POLICY "Users can view their order items" ON order_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_items.order_id 
            AND (
                orders.user_id = auth.uid() 
                OR EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.is_admin = true
                )
            )
        )
    );

CREATE POLICY "Users can create order items" ON order_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_items.order_id 
            AND orders.user_id = auth.uid()
        )
    );

-- 14. Politiques RLS pour order_status_history
CREATE POLICY "View status history" ON order_status_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_status_history.order_id 
            AND (
                orders.user_id = auth.uid() 
                OR EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.is_admin = true
                )
            )
        )
    );

CREATE POLICY "Admins can insert status history" ON order_status_history
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.is_admin = true
        )
    );

-- 15. Vue pour les détails de commande
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

-- 16. Permissions sur la vue
GRANT SELECT ON order_details_view TO authenticated;

-- 17. Fonction pour les statistiques
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

-- 18. Rafraîchir le cache du schéma Postgrest
NOTIFY pgrst, 'reload schema';

-- 19. Vérification finale
SELECT 
    'orders table columns:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;

-- 20. Test: Vérifier que shipping_cost existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'orders' 
            AND column_name = 'shipping_cost'
        ) 
        THEN '✅ shipping_cost column exists'
        ELSE '❌ shipping_cost column MISSING'
    END as status;
