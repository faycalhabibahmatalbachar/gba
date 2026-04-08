-- Suspension applicative : l'utilisateur doit pouvoir lire son profil (is_suspended) pour l'app mobile.
-- Ne pas bloquer SELECT sur profiles pour le propriétaire.

DROP POLICY IF EXISTS "profiles_no_suspended" ON public.profiles;
DROP POLICY IF EXISTS "block_suspended_users" ON public.profiles;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_own_read'
  ) THEN
    CREATE POLICY "profiles_own_read" ON public.profiles
      FOR SELECT TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;
