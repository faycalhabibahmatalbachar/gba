-- Supprimer la table existante si elle existe pour la recréer proprement
DROP TABLE IF EXISTS profiles CASCADE;

-- Créer la table profiles avec toutes les colonnes nécessaires
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    bio TEXT,
    address TEXT,
    city TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'France',
    avatar_url TEXT, -- URL de la photo de profil
    loyalty_points INTEGER DEFAULT 0,
    is_premium BOOLEAN DEFAULT false,
    notification_preferences JSONB DEFAULT '{"email": true, "push": false, "sms": false}'::jsonb,
    member_since TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Créer les index pour améliorer les performances
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_updated_at ON profiles(updated_at);

-- Activer RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Créer les politiques de sécurité
-- Les utilisateurs peuvent voir tous les profils (pour les fonctionnalités sociales futures)
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT 
USING (true);

-- Les utilisateurs peuvent modifier uniquement leur propre profil
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Les utilisateurs peuvent insérer leur propre profil
CREATE POLICY "Users can insert own profile" 
ON profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Créer une fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour mettre à jour automatiquement updated_at
CREATE TRIGGER update_profiles_updated_at 
BEFORE UPDATE ON profiles 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Créer une fonction pour créer automatiquement un profil lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, member_since, created_at)
  VALUES (new.id, new.email, NOW(), NOW());
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer un trigger pour créer automatiquement un profil quand un nouvel utilisateur s'inscrit
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insérer des profils pour les utilisateurs existants s'ils n'en ont pas
INSERT INTO profiles (id, email, member_since, created_at)
SELECT 
    id, 
    email,
    COALESCE(created_at, NOW()),
    NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- Note: La vue profile_stats est commentée car les tables orders, cart_items et favorites
-- doivent être créées d'abord. Vous pouvez la créer plus tard si nécessaire.
-- CREATE OR REPLACE VIEW profile_stats AS
-- SELECT 
--     p.id,
--     p.email,
--     p.loyalty_points,
--     p.is_premium,
--     p.member_since,
--     p.last_updated
-- FROM profiles p;

-- Accorder les permissions nécessaires
GRANT ALL ON profiles TO authenticated;
GRANT SELECT ON profiles TO anon;

-- Message de confirmation
SELECT 'Table profiles créée avec succès avec toutes les colonnes nécessaires' AS message;
