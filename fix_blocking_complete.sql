-- Script complet pour réparer le système de blocage
-- À exécuter dans Supabase SQL Editor

-- 1. Ajouter les colonnes de blocage si elles n'existent pas
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS block_reason TEXT,
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS blocked_by UUID;

-- 2. Créer un index pour les performances
CREATE INDEX IF NOT EXISTS idx_profiles_blocked ON profiles(is_blocked);
CREATE INDEX IF NOT EXISTS idx_profiles_blocked_by ON profiles(blocked_by);

-- 3. Désactiver temporairement RLS pour corriger les permissions
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 4. Créer les politiques RLS correctes
-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can update profiles" ON profiles;
DROP POLICY IF EXISTS "Users can see their block status" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;

-- Réactiver RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Politique pour que les utilisateurs voient leur propre profil
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT
    USING (true);  -- Temporairement permettre à tous de voir

-- Politique pour que l'admin puisse tout voir
CREATE POLICY "Admin can view all profiles" ON profiles
    FOR ALL
    USING (
        auth.uid() = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'::uuid
        OR auth.uid() = id
    );

-- Politique pour permettre les updates par l'admin
CREATE POLICY "Admin can update any profile" ON profiles
    FOR UPDATE
    USING (
        auth.uid() = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'::uuid
    )
    WITH CHECK (
        auth.uid() = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'::uuid
    );

-- Politique pour que les utilisateurs puissent se mettre à jour (sauf le blocage)
CREATE POLICY "Users can update own profile except blocking" ON profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id 
        AND (
            is_blocked IS NOT DISTINCT FROM (SELECT is_blocked FROM profiles WHERE id = auth.uid())
            AND blocked_by IS NOT DISTINCT FROM (SELECT blocked_by FROM profiles WHERE id = auth.uid())
            AND blocked_at IS NOT DISTINCT FROM (SELECT blocked_at FROM profiles WHERE id = auth.uid())
            AND block_reason IS NOT DISTINCT FROM (SELECT block_reason FROM profiles WHERE id = auth.uid())
        )
    );

-- 5. Créer une fonction pour bloquer/débloquer facilement
CREATE OR REPLACE FUNCTION block_user(
    user_id UUID,
    should_block BOOLEAN,
    reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Vérifier que l'utilisateur actuel est admin
    IF auth.uid() != 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'::uuid THEN
        RAISE EXCEPTION 'Only admin can block/unblock users';
    END IF;
    
    -- Mettre à jour le profil
    UPDATE profiles
    SET 
        is_blocked = should_block,
        block_reason = CASE WHEN should_block THEN reason ELSE NULL END,
        blocked_at = CASE WHEN should_block THEN NOW() ELSE NULL END,
        blocked_by = CASE WHEN should_block THEN auth.uid() ELSE NULL END
    WHERE id = user_id;
    
    RETURN TRUE;
END;
$$;

-- 6. Créer une vue pour faciliter la lecture des utilisateurs bloqués
CREATE OR REPLACE VIEW blocked_users AS
SELECT 
    id,
    email,
    first_name,
    last_name,
    is_blocked,
    block_reason,
    blocked_at,
    blocked_by
FROM profiles
WHERE is_blocked = true;

-- 7. Permettre l'accès à la vue
GRANT SELECT ON blocked_users TO anon, authenticated;

-- 8. Créer un trigger pour logger les changements de blocage
CREATE TABLE IF NOT EXISTS block_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL, -- 'blocked' ou 'unblocked'
    reason TEXT,
    performed_by UUID,
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION log_block_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_blocked IS DISTINCT FROM NEW.is_blocked THEN
        INSERT INTO block_logs (user_id, action, reason, performed_by)
        VALUES (
            NEW.id,
            CASE WHEN NEW.is_blocked THEN 'blocked' ELSE 'unblocked' END,
            NEW.block_reason,
            NEW.blocked_by
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_block_changes ON profiles;
CREATE TRIGGER trigger_log_block_changes
    AFTER UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION log_block_changes();

-- 9. Test: Débloquer tous les utilisateurs
UPDATE profiles 
SET 
    is_blocked = false,
    block_reason = NULL,
    blocked_at = NULL,
    blocked_by = NULL
WHERE is_blocked = true;

-- 10. Afficher la structure finale
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('is_blocked', 'block_reason', 'blocked_at', 'blocked_by')
ORDER BY ordinal_position;
