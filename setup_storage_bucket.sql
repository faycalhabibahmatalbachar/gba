-- ========================================
-- CONFIGURATION DU BUCKET STORAGE POUR IMAGES
-- ========================================

-- Créer le bucket 'products' s'il n'existe pas
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'products',
  'products', 
  true,  -- Public pour permettre l'accès aux images
  false,
  5242880,  -- 5MB max par fichier
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']::text[];

-- ========================================
-- POLICIES POUR LE BUCKET PRODUCTS
-- ========================================

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Enable read access for all users" ON storage.objects;
DROP POLICY IF EXISTS "Enable upload for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON storage.objects;

-- Permettre la lecture publique des images
CREATE POLICY "Public read access for product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'products');

-- Permettre l'upload pour tous (temporaire pour dev)
CREATE POLICY "Public upload for product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'products');

-- Permettre la mise à jour pour tous (temporaire pour dev)
CREATE POLICY "Public update for product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'products');

-- Permettre la suppression pour tous (temporaire pour dev)
CREATE POLICY "Public delete for product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'products');

-- Note: En production, remplacez les policies publiques par des policies authentifiées
