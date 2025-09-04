-- ========================================
-- TABLES POUR FAVORIS ET PANIER
-- ========================================

-- Table des favoris
CREATE TABLE IF NOT EXISTS favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- Table du panier (si elle n'existe pas déjà)
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product_id ON favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

-- ========================================
-- POLITIQUES RLS (Row Level Security)
-- ========================================

-- Activer RLS
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Politiques pour favorites
DROP POLICY IF EXISTS "Users can view own favorites" ON favorites;
CREATE POLICY "Users can view own favorites" ON favorites
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add own favorites" ON favorites;
CREATE POLICY "Users can add own favorites" ON favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own favorites" ON favorites;
CREATE POLICY "Users can delete own favorites" ON favorites
    FOR DELETE USING (auth.uid() = user_id);

-- Politiques pour cart_items
DROP POLICY IF EXISTS "Users can view own cart" ON cart_items;
CREATE POLICY "Users can view own cart" ON cart_items
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add to own cart" ON cart_items;
CREATE POLICY "Users can add to own cart" ON cart_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own cart" ON cart_items;
CREATE POLICY "Users can update own cart" ON cart_items
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete from own cart" ON cart_items;
CREATE POLICY "Users can delete from own cart" ON cart_items
    FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- TRIGGERS POUR UPDATED_AT
-- ========================================

-- Trigger pour favorites
CREATE OR REPLACE FUNCTION update_favorites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS favorites_updated_at_trigger ON favorites;
CREATE TRIGGER favorites_updated_at_trigger
    BEFORE UPDATE ON favorites
    FOR EACH ROW
    EXECUTE FUNCTION update_favorites_updated_at();

-- Trigger pour cart_items
CREATE OR REPLACE FUNCTION update_cart_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cart_items_updated_at_trigger ON cart_items;
CREATE TRIGGER cart_items_updated_at_trigger
    BEFORE UPDATE ON cart_items
    FOR EACH ROW
    EXECUTE FUNCTION update_cart_items_updated_at();

-- ========================================
-- REALTIME SUBSCRIPTIONS
-- ========================================

-- Activer Realtime pour les changements (avec gestion des tables déjà existantes)
DO $$
BEGIN
    -- Ajouter favorites à la publication si pas déjà présent
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'favorites'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE favorites;
        RAISE NOTICE '✅ Table favorites ajoutée à supabase_realtime';
    ELSE
        RAISE NOTICE 'ℹ️ Table favorites déjà dans supabase_realtime';
    END IF;
    
    -- Ajouter cart_items à la publication si pas déjà présent
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'cart_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE cart_items;
        RAISE NOTICE '✅ Table cart_items ajoutée à supabase_realtime';
    ELSE
        RAISE NOTICE 'ℹ️ Table cart_items déjà dans supabase_realtime';
    END IF;
END $$;

-- ========================================
-- FONCTIONS UTILES
-- ========================================

-- Fonction pour obtenir le nombre de favoris d'un utilisateur
CREATE OR REPLACE FUNCTION get_favorites_count(p_user_id UUID)
RETURNS INT AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM favorites WHERE user_id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir le nombre d'articles dans le panier
CREATE OR REPLACE FUNCTION get_cart_items_count(p_user_id UUID)
RETURNS INT AS $$
BEGIN
    RETURN (SELECT COALESCE(SUM(quantity), 0) FROM cart_items WHERE user_id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir le total du panier
CREATE OR REPLACE FUNCTION get_cart_total(p_user_id UUID)
RETURNS DECIMAL AS $$
BEGIN
    RETURN (
        SELECT COALESCE(SUM(ci.quantity * p.price), 0)
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- PERMISSIONS
-- ========================================

GRANT ALL ON favorites TO authenticated;
GRANT ALL ON cart_items TO authenticated;
GRANT EXECUTE ON FUNCTION get_favorites_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_cart_items_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_cart_total TO authenticated;

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Tables favorites et cart_items créées avec succès!';
    RAISE NOTICE '✅ Politiques RLS configurées';
    RAISE NOTICE '✅ Triggers updated_at ajoutés';
    RAISE NOTICE '✅ Realtime activé pour synchronisation temps réel';
    RAISE NOTICE '✅ Fonctions utilitaires créées';
END $$;
