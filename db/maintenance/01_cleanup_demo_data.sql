-- Script de nettoyage des données de démonstration (produits + catégories de test)
-- À utiliser pour réinitialiser la base avant une nouvelle démo

-- Supprimer les produits de démo créés par 01_demo_products.sql
DELETE FROM products
WHERE sku IN (
  'SKU-IPH-15PM',
  'SKU-MBA-M2',
  'SKU-NIKE-AM270',
  'SKU-SAM-S24U',
  'SKU-ADI-UB22',
  'SKU-PS5',
  'SKU-APP-2',
  'SKU-TSH-PREM'
);

-- Supprimer les catégories de test ou de démo
DELETE FROM categories 
WHERE LOWER(name) IN ('sports', 'sport', 'maison', 'livres', 'test', 'demo', 'category')
   OR LOWER(name) LIKE '%test%'
   OR LOWER(name) LIKE '%demo%';
