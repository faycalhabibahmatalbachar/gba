-- Ajout de la colonne last_updated à la table cart_items
ALTER TABLE cart_items 
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Créer un trigger pour mettre à jour automatiquement last_updated
CREATE OR REPLACE FUNCTION update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS update_cart_items_last_updated ON cart_items;

-- Créer le nouveau trigger
CREATE TRIGGER update_cart_items_last_updated
    BEFORE UPDATE ON cart_items
    FOR EACH ROW
    EXECUTE FUNCTION update_last_updated_column();

-- Mettre à jour les enregistrements existants
UPDATE cart_items 
SET last_updated = created_at 
WHERE last_updated IS NULL;

-- Vérifier la structure de la table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'cart_items'
ORDER BY ordinal_position;
