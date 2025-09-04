-- ========================================
-- CORRECTION DU FORMAT DES URLs D'IMAGES
-- ========================================

-- 1. Voir le format actuel des URLs
SELECT 
    id, 
    name, 
    main_image,
    CASE 
        WHEN main_image IS NULL OR main_image = '' THEN 'Vide'
        WHEN main_image LIKE 'http%' THEN 'URL complète'
        WHEN main_image LIKE 'products/%' THEN 'Chemin relatif avec products/'
        ELSE 'Autre format'
    END as format_url
FROM products
LIMIT 10;

-- 2. Corriger les URLs qui sont des chemins relatifs
UPDATE products 
SET main_image = 'https://uvlrgwdbjegoavjfdrzb.supabase.co/storage/v1/object/public/' || main_image
WHERE main_image IS NOT NULL 
  AND main_image != ''
  AND main_image NOT LIKE 'http%'
  AND main_image LIKE 'products/%';

-- 3. Corriger les URLs qui n'ont pas le préfixe 'products/'
UPDATE products 
SET main_image = 'https://uvlrgwdbjegoavjfdrzb.supabase.co/storage/v1/object/public/products/' || main_image
WHERE main_image IS NOT NULL 
  AND main_image != ''
  AND main_image NOT LIKE 'http%'
  AND main_image NOT LIKE 'products/%';

-- 4. Pour les images dans le tableau 'images' (si utilisé)
UPDATE products 
SET images = ARRAY(
    SELECT CASE 
        WHEN img LIKE 'http%' THEN img
        WHEN img LIKE 'products/%' THEN 'https://uvlrgwdbjegoavjfdrzb.supabase.co/storage/v1/object/public/' || img
        ELSE 'https://uvlrgwdbjegoavjfdrzb.supabase.co/storage/v1/object/public/products/' || img
    END
    FROM unnest(images) AS img
)
WHERE images IS NOT NULL AND array_length(images, 1) > 0;

-- 5. Vérifier le résultat
SELECT 
    id, 
    name, 
    main_image
FROM products
WHERE main_image IS NOT NULL AND main_image != ''
LIMIT 10;
