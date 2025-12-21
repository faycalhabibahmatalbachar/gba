-- Seed de produits/catégories de démonstration pour GBA Store
-- Copié à partir de cleanup_and_seed_data.sql pour centraliser les données de test

-- Supprimer les catégories de test
DELETE FROM categories 
WHERE LOWER(name) IN ('sports', 'sport', 'maison', 'livres', 'test', 'demo', 'category')
   OR LOWER(name) LIKE '%test%'
   OR LOWER(name) LIKE '%demo%';

-- Insérer quelques produits d'exemple si aucun n'existe
INSERT INTO products (name, sku, description, price, category_id, main_image, is_active, quantity, brand)
SELECT 
    'iPhone 15 Pro Max',
    'SKU-IPH-15PM',
    'Le dernier smartphone Apple avec puce A17 Pro',
    899000,
    c.id,
    'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500',
    true,
    50,
    'Apple'
FROM categories c 
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'SKU-IPH-15PM')
AND c.slug = 'electronique'
LIMIT 1;

INSERT INTO products (name, sku, description, price, category_id, main_image, is_active, quantity, brand)
SELECT 
    'MacBook Air M2',
    'SKU-MBA-M2',
    'Ordinateur portable ultra-léger avec puce M2',
    1299000,
    c.id,
    'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=500',
    true,
    30,
    'Apple'
FROM categories c 
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'SKU-MBA-M2')
AND c.slug = 'electronique'
LIMIT 1;

INSERT INTO products (name, sku, description, price, category_id, main_image, is_active, quantity, brand)
SELECT 
    'Nike Air Max 270',
    'SKU-NIKE-AM270',
    'Chaussures de sport confortables',
    75000,
    c.id,
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
    true,
    100,
    'Nike'
FROM categories c 
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'SKU-NIKE-AM270')
AND c.slug = 'mode'
LIMIT 1;

INSERT INTO products (name, sku, description, price, category_id, main_image, is_active, quantity, brand)
SELECT 
    'Samsung Galaxy S24 Ultra',
    'SKU-SAM-S24U',
    'Smartphone haut de gamme avec S Pen',
    999000,
    c.id,
    'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500',
    true,
    45,
    'Samsung'
FROM categories c 
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'SKU-SAM-S24U')
AND c.slug = 'electronique'
LIMIT 1;

INSERT INTO products (name, sku, description, price, category_id, main_image, is_active, quantity, brand)
SELECT 
    'Adidas Ultraboost 22',
    'SKU-ADI-UB22',
    'Chaussures de running haute performance',
    85000,
    c.id,
    'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=500',
    true,
    75,
    'Adidas'
FROM categories c 
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'SKU-ADI-UB22')
AND c.slug = 'mode'
LIMIT 1;

INSERT INTO products (name, sku, description, price, category_id, main_image, is_active, quantity, brand)
SELECT 
    'PlayStation 5',
    'SKU-PS5',
    'Console de jeu nouvelle génération',
    499000,
    c.id,
    'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=500',
    true,
    20,
    'Sony'
FROM categories c 
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'SKU-PS5')
AND c.slug = 'electronique'
LIMIT 1;

INSERT INTO products (name, sku, description, price, category_id, main_image, is_active, quantity, brand)
SELECT 
    'AirPods Pro 2',
    'SKU-APP-2',
    'Écouteurs sans fil avec réduction de bruit',
    249000,
    c.id,
    'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=500',
    true,
    150,
    'Apple'
FROM categories c 
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'SKU-APP-2')
AND c.slug = 'electronique'
LIMIT 1;

INSERT INTO products (name, sku, description, price, category_id, main_image, is_active, quantity, brand)
SELECT 
    'T-shirt Premium',
    'SKU-TSH-PREM',
    'T-shirt en coton biologique',
    15000,
    c.id,
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500',
    true,
    200,
    'Zara'
FROM categories c 
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'SKU-TSH-PREM')
AND c.slug = 'mode'
LIMIT 1;
