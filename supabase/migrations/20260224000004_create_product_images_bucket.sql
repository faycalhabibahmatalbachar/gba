-- ============================================================
-- GBA — Bucket Supabase Storage : product-images
-- ============================================================

-- Créer le bucket public si inexistant
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,   -- 5 MB max par fichier
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 5242880;

-- Lecture publique (anon peut lire les images produits)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'product-images public read'
  ) THEN
    CREATE POLICY "product-images public read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'product-images');
  END IF;
END $$;

-- Upload/update autorisé uniquement pour le service_role (script d'admin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'product-images service write'
  ) THEN
    CREATE POLICY "product-images service write"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'product-images'
        AND auth.role() = 'service_role'
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'product-images service update'
  ) THEN
    CREATE POLICY "product-images service update"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'product-images'
        AND auth.role() = 'service_role'
      );
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE '[product-images] Bucket et policies configurés.'; END $$;
