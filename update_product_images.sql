-- ========================================
-- MISE À JOUR DES IMAGES DES PRODUITS
-- ========================================

-- Mettre à jour les URLs des images pour les produits existants
-- Remplacez YOUR_PROJECT_ID par votre ID de projet Supabase

UPDATE products 
SET main_image = CASE 
  WHEN LOWER(name) LIKE '%iphone 15%' THEN 'https://YOUR_PROJECT_ID.supabase.co/storage/v1/object/public/products/iphone15.jpg'
  WHEN LOWER(name) LIKE '%samsung%s24%' THEN 'https://YOUR_PROJECT_ID.supabase.co/storage/v1/object/public/products/samsung-s24.jpg'
  WHEN LOWER(name) LIKE '%macbook pro%' THEN 'https://YOUR_PROJECT_ID.supabase.co/storage/v1/object/public/products/macbook-pro.jpg'
  WHEN LOWER(name) LIKE '%macbook air%' THEN 'https://YOUR_PROJECT_ID.supabase.co/storage/v1/object/public/products/macbook-air.jpg'
  WHEN LOWER(name) LIKE '%iphone 900%' THEN 'https://YOUR_PROJECT_ID.supabase.co/storage/v1/object/public/products/iphone.jpg'
  WHEN LOWER(name) LIKE '%playstation%' THEN 'https://YOUR_PROJECT_ID.supabase.co/storage/v1/object/public/products/ps5.jpg'
  WHEN LOWER(name) LIKE '%airpods%' THEN 'https://YOUR_PROJECT_ID.supabase.co/storage/v1/object/public/products/airpods.jpg'
  ELSE main_image
END
WHERE main_image IS NULL OR main_image = '';

-- Alternative: Utiliser des images de placeholder gratuites
UPDATE products 
SET main_image = CASE 
  WHEN LOWER(name) LIKE '%iphone%' THEN 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=500'
  WHEN LOWER(name) LIKE '%samsung%' THEN 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=500'
  WHEN LOWER(name) LIKE '%macbook%' THEN 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500'
  WHEN LOWER(name) LIKE '%playstation%' THEN 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=500'
  WHEN LOWER(name) LIKE '%airpods%' THEN 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=500'
  ELSE 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500' -- Image générique de produit
END
WHERE main_image IS NULL OR main_image = '';

-- Vérifier les produits mis à jour
SELECT id, name, main_image FROM products ORDER BY created_at DESC;
