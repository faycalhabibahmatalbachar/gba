-- Ajouter la foreign key manquante entre cart_items et products
ALTER TABLE cart_items 
ADD CONSTRAINT cart_items_product_id_fkey 
FOREIGN KEY (product_id) 
REFERENCES products(id) 
ON DELETE CASCADE;

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);

-- Rafraîchir le cache du schéma (nécessaire pour Supabase)
NOTIFY pgrst, 'reload schema';
