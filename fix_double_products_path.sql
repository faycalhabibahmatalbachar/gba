-- =============================================
-- CORRECTION DU DOUBLE CHEMIN "products/products"
-- =============================================

-- 1. Voir les URLs avec double "products"
SELECT 
    id, 
    name, 
    main_image,
    CASE 
        WHEN main_image LIKE '%/products/products/%' THEN '⚠️ Double products'
        WHEN main_image LIKE '%/storage/v1/object/public/products/%' THEN '✅ Format correct'
        ELSE '❓ Autre format'
    END as status
FROM products
WHERE main_image IS NOT NULL AND main_image != '';

-- 2. Corriger les URLs qui ont "products/products"
UPDATE products 
SET main_image = REPLACE(main_image, '/products/products/', '/products/')
WHERE main_image LIKE '%/products/products/%';

-- 3. Corriger aussi le tableau images si nécessaire
UPDATE products 
SET images = ARRAY(
    SELECT REPLACE(img, '/products/products/', '/products/')
    FROM unnest(images) AS img
)
WHERE images IS NOT NULL 
  AND array_length(images, 1) > 0
  AND EXISTS (
    SELECT 1 FROM unnest(images) AS img 
    WHERE img LIKE '%/products/products/%'
  );

-- 4. Vérifier après correction
SELECT 
    id, 
    name, 
    main_image
FROM products
WHERE main_image IS NOT NULL AND main_image != ''
LIMIT 10;
