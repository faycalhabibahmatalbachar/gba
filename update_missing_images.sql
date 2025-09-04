-- Mettre à jour les produits sans images avec des images placeholder
-- Utilisation d'images Unsplash pour les produits sans main_image

UPDATE products 
SET main_image = 'https://images.unsplash.com/photo-1629131726692-1accd0c53ce0?w=400'
WHERE name ILIKE '%Linux%' AND (main_image IS NULL OR main_image = '');

UPDATE products 
SET main_image = 'https://images.unsplash.com/photo-1696446702183-cbd13d78e1e0?w=400'
WHERE name ILIKE '%iPhone 15%' AND (main_image IS NULL OR main_image = '');

-- Mettre à jour tous les autres produits sans images avec une image par défaut
UPDATE products 
SET main_image = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'
WHERE main_image IS NULL OR main_image = '';

-- Vérifier les produits mis à jour
SELECT id, name, main_image 
FROM products 
WHERE name ILIKE '%Linux%' OR name ILIKE '%iPhone%';
