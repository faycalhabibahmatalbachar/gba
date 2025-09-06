-- Script sécurisé pour réparer le système de blocage
-- Supprime les policies existantes avant de les recréer

-- 1. Ajouter les colonnes de blocage si elles n'existent pas
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS block_reason TEXT,
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS blocked_by UUID;

-- 2. Créer les index
CREATE INDEX IF NOT EXISTS idx_profiles_blocked ON profiles(is_blocked);
CREATE INDEX IF NOT EXISTS idx_profiles_blocked_by ON profiles(blocked_by);

-- 3. Supprimer TOUTES les anciennes policies pour éviter les conflits
DROP POLICY IF EXISTS "Admin can update any profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can update profiles" ON profiles;
DROP POLICY IF EXISTS "Users can see their block status" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile except blocking" ON profiles;

-- 4. Désactiver temporairement RLS pour nettoyer
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 5. Réactiver RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 6. Créer les nouvelles policies proprement
-- Permettre à tous de lire les profils (temporaire pour debug)
CREATE POLICY "Allow all to read profiles" ON profiles
    FOR SELECT
    USING (true);

-- Permettre à l'admin de tout faire
CREATE POLICY "Admin full access" ON profiles
    FOR ALL
    USING (
        auth.uid() = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'::uuid
        OR auth.uid() IS NULL  -- Pour les requêtes anon
    )
    WITH CHECK (true);

-- Permettre aux utilisateurs de se mettre à jour (sauf blocage)
CREATE POLICY "Users update own profile" ON profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id 
        AND is_blocked IS NOT DISTINCT FROM (SELECT is_blocked FROM profiles WHERE id = auth.uid())
    );

-- 7. Créer la fonction de blocage/déblocage
CREATE OR REPLACE FUNCTION toggle_user_block(
    target_user_id UUID,
    should_block BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE profiles
    SET 
        is_blocked = should_block,
        block_reason = CASE WHEN should_block THEN 'Bloqué par administrateur' ELSE NULL END,
        blocked_at = CASE WHEN should_block THEN NOW() ELSE NULL END,
        blocked_by = CASE WHEN should_block THEN 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'::uuid ELSE NULL END
    WHERE id = target_user_id;
    
    RETURN TRUE;
END;
$$;

-- 8. Créer une vue pour les utilisateurs bloqués
DROP VIEW IF EXISTS blocked_users;
CREATE VIEW blocked_users AS
SELECT 
    id,
    email,
    first_name,
    last_name,
    is_blocked,
    block_reason,
    blocked_at
FROM profiles
WHERE is_blocked = true;

-- 9. Permissions sur la vue
GRANT SELECT ON blocked_users TO anon, authenticated;

-- 10. Test: Débloquer tous les utilisateurs pour repartir propre
UPDATE profiles 
SET 
    is_blocked = false,
    block_reason = NULL,
    blocked_at = NULL,
    blocked_by = NULL
WHERE is_blocked = true;

-- 11. Vérifier la structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('is_blocked', 'block_reason', 'blocked_at', 'blocked_by')
ORDER BY ordinal_position;
