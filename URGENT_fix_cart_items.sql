-- ========================================
-- SCRIPT URGENT DE CORRECTION CART_ITEMS
-- Exécuter IMMÉDIATEMENT dans Supabase SQL Editor
-- ========================================

-- 1. SUPPRIMER TOUS LES TRIGGERS PROBLÉMATIQUES
DROP TRIGGER IF EXISTS update_cart_items_updated_at ON cart_items CASCADE;
DROP TRIGGER IF EXISTS cart_items_last_updated_trigger ON cart_items CASCADE;
DROP TRIGGER IF EXISTS cart_items_timestamp_trigger ON cart_items CASCADE;
DROP FUNCTION IF EXISTS update_cart_items_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_cart_items_last_updated() CASCADE;
DROP FUNCTION IF EXISTS handle_cart_items_timestamp() CASCADE;

-- 2. SUPPRIMER LA COLONNE last_updated QUI CAUSE L'ERREUR
ALTER TABLE cart_items 
DROP COLUMN IF EXISTS last_updated CASCADE;

-- 3. VÉRIFICATION FINALE
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'cart_items'
ORDER BY ordinal_position;

-- Si tout est OK, vous verrez la liste des colonnes SANS last_updated
