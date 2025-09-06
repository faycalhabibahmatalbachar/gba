-- Ajouter le champ is_blocked à la table profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_profiles_is_blocked ON profiles(is_blocked);

-- Ajouter un champ pour la raison du blocage
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS block_reason TEXT;

-- Ajouter un champ pour la date de blocage
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

-- Ajouter un champ pour l'admin qui a bloqué
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES profiles(id);

-- Activer RLS pour la table profiles si ce n'est pas déjà fait
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux utilisateurs de voir leur propre statut de blocage
CREATE POLICY "Users can view own block status" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Politique pour permettre aux admins de modifier le statut de blocage
CREATE POLICY "Admins can update block status" ON profiles
  FOR UPDATE
  USING (auth.uid() = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d')
  WITH CHECK (auth.uid() = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d');
