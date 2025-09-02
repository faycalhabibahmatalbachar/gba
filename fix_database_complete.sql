-- 1. Corriger la relation cart_items -> products
ALTER TABLE cart_items 
DROP CONSTRAINT IF EXISTS cart_items_product_id_fkey;

ALTER TABLE cart_items 
ADD CONSTRAINT cart_items_product_id_fkey 
FOREIGN KEY (product_id) 
REFERENCES products(id) 
ON DELETE CASCADE;

-- 2. Créer les index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- 3. Vérifier et afficher les produits existants
SELECT id, name, price, main_image, is_active, created_at 
FROM products 
WHERE is_active = true
ORDER BY created_at DESC;

-- 4. Si aucun produit, en ajouter quelques-uns pour tester
INSERT INTO products (
  name, slug, description, price, sku, quantity, 
  category_id, brand, main_image, is_active, is_featured
) VALUES 
(
  'iPhone 15 Pro Max',
  'iphone-15-pro-max',
  'Le dernier smartphone Apple avec puce A17 Pro',
  899000,
  'IPHONE15PM',
  10,
  (SELECT id FROM categories WHERE name = 'Électronique' LIMIT 1),
  'Apple',
  'https://uvlrgwdbjegoavjfdrzb.supabase.co/storage/v1/object/public/products/iphone15.jpg',
  true,
  true
),
(
  'Samsung Galaxy S24 Ultra',
  'samsung-galaxy-s24-ultra',
  'Smartphone Android premium avec S Pen',
  750000,
  'SAMS24U',
  15,
  (SELECT id FROM categories WHERE name = 'Électronique' LIMIT 1),
  'Samsung',
  'https://uvlrgwdbjegoavjfdrzb.supabase.co/storage/v1/object/public/products/samsung-s24.jpg',
  true,
  true
),
(
  'MacBook Pro 14"',
  'macbook-pro-14',
  'Ordinateur portable professionnel avec puce M3',
  1200000,
  'MBP14M3',
  5,
  (SELECT id FROM categories WHERE name = 'Électronique' LIMIT 1),
  'Apple',
  'https://uvlrgwdbjegoavjfdrzb.supabase.co/storage/v1/object/public/products/macbook.jpg',
  true,
  false
)
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  is_active = true;

-- 5. Rafraîchir le cache Supabase
NOTIFY pgrst, 'reload schema';

-- 6. Vérifier le résultat
SELECT COUNT(*) as total_products FROM products WHERE is_active = true;
