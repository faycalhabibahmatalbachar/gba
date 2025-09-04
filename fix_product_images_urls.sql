-- Correction des URLs d'images produits qui retournent 400
-- Utilisation d'URLs d'images publiques comme placeholders

UPDATE products 
SET main_image = CASE 
  -- iPhone 15 Pro Max
  WHEN LOWER(name) LIKE '%iphone 15%' THEN 'https://atlas-content-cdn.pixelsquid.com/assets_v2/285/2854635923226760503/jpeg-600/G03.jpg?modifiedAt=1'
  
  -- Samsung Galaxy S24
  WHEN LOWER(name) LIKE '%samsung%s24%' THEN 'https://images.samsung.com/is/image/samsung/p6pim/fr/2401/gallery/fr-galaxy-s24-s928-sm-s928bzaheub-539305778'
  
  -- MacBook Pro
  WHEN LOWER(name) LIKE '%macbook pro%' THEN 'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/mbp14-spacegray-select-202310'
  
  ELSE main_image
END
WHERE main_image IN (
  'https://uvlrgwdbjegoavjfdrzb.supabase.co/storage/v1/object/public/products/iphone15.jpg',
  'https://uvlrgwdbjegoavjfdrzb.supabase.co/storage/v1/object/public/products/samsung-s24.jpg',
  'https://uvlrgwdbjegoavjfdrzb.supabase.co/storage/v1/object/public/products/macbook.jpg'
)
OR main_image IS NULL;

-- Vérification des mises à jour
SELECT name, main_image 
FROM products 
WHERE LOWER(name) LIKE '%iphone 15%' 
   OR LOWER(name) LIKE '%samsung%s24%' 
   OR LOWER(name) LIKE '%macbook pro%';
