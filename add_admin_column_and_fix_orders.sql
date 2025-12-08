-- ========================================
-- AJOUT COLONNE is_admin ET CRÉATION TABLES ORDERS
-- ========================================

-- 1. Ajouter la colonne is_admin à profiles si elle n'existe pas
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 2. Mettre à jour l'utilisateur admin
UPDATE profiles 
SET is_admin = true 
WHERE email IN ('admin@example.com', 'faycalhabibahmat@gmail.com');

-- 3. Créer la table orders si elle n'existe pas
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL DEFAULT '',
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- Statuts
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'refunded'
    )),
    
    -- Paiement
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN (
        'pending',
        'paid', 
        'failed',
        'refunded'
    )),
    payment_method VARCHAR(50) DEFAULT 'cash_on_delivery',
    
    -- Montants (IMPORTANT: inclure shipping_cost)
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    shipping_cost DECIMAL(12,2) DEFAULT 0,  -- COLONNE IMPORTANTE
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

-- 4. Créer la table order_items si elle n'existe pas
CREATE TABLE IF NOT EXISTS order_items (
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

-- 5. Fonction pour générer le numéro de commande
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR AS $$
DECLARE
    new_number VARCHAR;
    year_month VARCHAR;
    sequence_number INTEGER;
BEGIN
    year_month := TO_CHAR(NOW(), 'YYYYMM');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 12 FOR 4) AS INTEGER)), 0) + 1
    INTO sequence_number
    FROM orders
    WHERE order_number LIKE 'ORD-' || year_month || '-%';
    
    new_number := 'ORD-' || year_month || '-' || LPAD(sequence_number::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger pour le numéro de commande
DROP TRIGGER IF EXISTS trigger_set_order_number ON orders;
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

-- 7. Activer RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 8. Politiques simplifiées pour orders
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
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

DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
CREATE POLICY "Users can create their own orders" ON orders
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update orders" ON orders;
CREATE POLICY "Admins can update orders" ON orders
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.is_admin = true
        )
    );

-- 9. Politiques pour order_items
DROP POLICY IF EXISTS "Users can view their order items" ON order_items;
CREATE POLICY "Users can view their order items" ON order_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_items.order_id 
            AND (
                orders.user_id = auth.uid() 
                OR 
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.is_admin = true
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can create order items" ON order_items;
CREATE POLICY "Users can create order items" ON order_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_items.order_id 
            AND orders.user_id = auth.uid()
        )
    );

-- 10. Vue pour les détails de commande
DROP VIEW IF EXISTS order_details_view;
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

-- 11. Permissions sur la vue
GRANT SELECT ON order_details_view TO authenticated;

-- 12. Fonction pour les statistiques
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

-- Vérifier que tout est OK
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name IN ('shipping_cost', 'subtotal', 'total_amount');

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name = 'is_admin';
