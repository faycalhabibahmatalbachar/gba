-- Solution complète pour le problème last_updated dans cart_items

-- 1. Vérifier et ajouter la colonne last_updated si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cart_items' 
        AND column_name = 'last_updated'
    ) THEN
        ALTER TABLE cart_items 
        ADD COLUMN last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 2. Supprimer le trigger existant s'il existe
DROP TRIGGER IF EXISTS update_cart_items_updated_at ON cart_items;
DROP TRIGGER IF EXISTS cart_items_last_updated_trigger ON cart_items;
DROP FUNCTION IF EXISTS update_cart_items_updated_at();
DROP FUNCTION IF EXISTS update_cart_items_last_updated();

-- 3. Créer une nouvelle fonction pour gérer last_updated
CREATE OR REPLACE FUNCTION handle_cart_items_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- Toujours mettre à jour last_updated lors d'un UPDATE
    NEW.last_updated = NOW();
    -- S'assurer que last_updated existe lors d'un INSERT
    IF TG_OP = 'INSERT' AND NEW.last_updated IS NULL THEN
        NEW.last_updated = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Créer le trigger BEFORE pour intercepter avant l'écriture
CREATE TRIGGER cart_items_timestamp_trigger
BEFORE INSERT OR UPDATE ON cart_items
FOR EACH ROW
EXECUTE FUNCTION handle_cart_items_timestamp();

-- 5. Mettre à jour les enregistrements existants sans last_updated
UPDATE cart_items 
SET last_updated = COALESCE(last_updated, NOW())
WHERE last_updated IS NULL;

-- 6. Vérifier que tout fonctionne
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'cart_items'
ORDER BY ordinal_position;
