-- =============================================
-- CONFIGURATION STORAGE SUPABASE POUR GBA STORE
-- =============================================

-- Créer les buckets storage (à faire manuellement dans le dashboard Supabase)
-- 1. Bucket 'products' pour les images de produits
-- 2. Bucket 'categories' pour les images de catégories  
-- 3. Bucket 'profiles' pour les avatars utilisateurs
-- 4. Bucket 'assets' pour les ressources générales

-- =============================================
-- POLICIES POUR LE BUCKET 'products'
-- =============================================

-- Politique de lecture publique pour les images de produits
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'products');

-- Politique d'upload pour les utilisateurs authentifiés (admin)
CREATE POLICY "Admin Upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'products' AND
  auth.role() = 'authenticated'
);

-- Politique de mise à jour pour les admins
CREATE POLICY "Admin Update" ON storage.objects
FOR UPDATE WITH CHECK (
  bucket_id = 'products' AND
  auth.role() = 'authenticated'
);

-- Politique de suppression pour les admins
CREATE POLICY "Admin Delete" ON storage.objects
FOR DELETE USING (
  bucket_id = 'products' AND
  auth.role() = 'authenticated'
);

-- =============================================
-- POLICIES POUR LE BUCKET 'categories'
-- =============================================

CREATE POLICY "Public Access Categories" ON storage.objects
FOR SELECT USING (bucket_id = 'categories');

CREATE POLICY "Admin Upload Categories" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'categories' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Admin Update Categories" ON storage.objects
FOR UPDATE WITH CHECK (
  bucket_id = 'categories' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Admin Delete Categories" ON storage.objects
FOR DELETE USING (
  bucket_id = 'categories' AND
  auth.role() = 'authenticated'
);

-- =============================================
-- POLICIES POUR LE BUCKET 'profiles'
-- =============================================

CREATE POLICY "Public Access Profiles" ON storage.objects
FOR SELECT USING (bucket_id = 'profiles');

-- Les utilisateurs peuvent uploader leur propre avatar
CREATE POLICY "User Upload Own Avatar" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profiles' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "User Update Own Avatar" ON storage.objects
FOR UPDATE WITH CHECK (
  bucket_id = 'profiles' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "User Delete Own Avatar" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profiles' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- =============================================
-- FONCTION POUR OBTENIR L'URL PUBLIQUE D'UNE IMAGE
-- =============================================

CREATE OR REPLACE FUNCTION get_storage_url(bucket_name text, file_path text)
RETURNS text AS $$
BEGIN
  RETURN 'https://' || current_setting('app.settings.supabase_project_id') || '.supabase.co/storage/v1/object/public/' || bucket_name || '/' || file_path;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGER POUR NETTOYER LES ANCIENNES IMAGES
-- =============================================

CREATE OR REPLACE FUNCTION cleanup_old_product_images()
RETURNS TRIGGER AS $$
BEGIN
  -- Si l'image principale a changé, supprimer l'ancienne
  IF OLD.main_image IS DISTINCT FROM NEW.main_image AND OLD.main_image IS NOT NULL THEN
    -- Extraire le chemin du fichier de l'URL
    PERFORM storage.delete_object('products', regexp_replace(OLD.main_image, '^.*/products/', ''));
  END IF;
  
  -- Faire de même pour le tableau d'images
  IF OLD.images IS DISTINCT FROM NEW.images THEN
    -- Logique pour supprimer les images qui ne sont plus dans le tableau
    -- (implementation détaillée selon vos besoins)
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_product_images_trigger
AFTER UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION cleanup_old_product_images();

-- =============================================
-- NOTES D'IMPLEMENTATION
-- =============================================

-- 1. Créer manuellement les buckets dans le dashboard Supabase
-- 2. Configurer chaque bucket comme PUBLIC
-- 3. Définir la taille max à 5MB par fichier
-- 4. Formats acceptés: jpg, jpeg, png, webp, gif
-- 5. Structure des dossiers recommandée:
--    products/
--      ├── {product_id}/
--      │   ├── main.jpg
--      │   ├── gallery-1.jpg
--      │   ├── gallery-2.jpg
--      │   └── ...
--    categories/
--      └── {category_id}.jpg
--    profiles/
--      └── {user_id}/
--          └── avatar.jpg
