-- Vérifier les données actuelles dans la table profiles
SELECT * FROM profiles WHERE id IN (SELECT id FROM auth.users);

-- Vérifier s'il y a des colonnes avec des valeurs incorrectes
SELECT 
    id,
    email,
    first_name,
    last_name,
    pg_typeof(id) as id_type,
    pg_typeof(email) as email_type,
    pg_typeof(first_name) as first_name_type
FROM profiles 
LIMIT 5;

-- Corriger les profils qui pourraient avoir des données incorrectes
-- D'abord, sauvegarder les données existantes
CREATE TABLE IF NOT EXISTS profiles_backup AS 
SELECT * FROM profiles;

-- Vérifier le profil de l'utilisateur spécifique (habibahmat@gmail.com)
SELECT * FROM profiles WHERE email = 'habibahmat@gmail.com';

-- Si le profil a des données incorrectes, le mettre à jour
UPDATE profiles 
SET 
    first_name = CASE 
        WHEN first_name IS NULL OR first_name = '' THEN 'Ndjam'
        ELSE first_name 
    END,
    last_name = CASE 
        WHEN last_name IS NULL OR last_name = '' THEN 'User'
        ELSE last_name 
    END,
    updated_at = NOW()
WHERE email = 'habibahmat@gmail.com';

-- Vérifier que tous les profils ont les colonnes requises avec les bons types
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

-- S'assurer que tous les utilisateurs ont un profil
INSERT INTO profiles (id, email, created_at, updated_at)
SELECT 
    u.id,
    u.email,
    NOW(),
    NOW()
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO UPDATE
SET 
    email = EXCLUDED.email,
    updated_at = NOW();

-- Vérifier le résultat final
SELECT 
    id,
    email,
    first_name,
    last_name,
    phone,
    created_at,
    updated_at
FROM profiles
ORDER BY updated_at DESC;
