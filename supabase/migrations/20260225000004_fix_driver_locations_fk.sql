-- ═══════════════════════════════════════════════════════════════
-- Fix driver_locations FK : driver_id doit référencer auth.users(id)
-- et non public.drivers(id) — le mobile envoie auth.uid()
-- ═══════════════════════════════════════════════════════════════

-- 1. Supprimer l'ancienne contrainte FK (si elle existe)
ALTER TABLE public.driver_locations
  DROP CONSTRAINT IF EXISTS driver_locations_driver_id_fkey;

-- 2. Ajouter la bonne contrainte FK vers auth.users
ALTER TABLE public.driver_locations
  ADD CONSTRAINT driver_locations_driver_id_fkey
  FOREIGN KEY (driver_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- 3. S'assurer qu'il y a un UNIQUE sur driver_id pour le upsert mobile
--    (onConflict: 'driver_id' dans DriverLocationService.dart)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'driver_locations'
      AND indexname = 'driver_locations_driver_id_key'
  ) THEN
    ALTER TABLE public.driver_locations
      ADD CONSTRAINT driver_locations_driver_id_key UNIQUE (driver_id);
  END IF;
END $$;

-- 4. Index pour les requêtes temps réel (déjà présent mais idempotent)
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id_captured
  ON public.driver_locations(driver_id, captured_at DESC);

-- 5. RLS : admin peut lire toutes les positions livreurs
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver_locations_admin_all"     ON public.driver_locations;
DROP POLICY IF EXISTS "driver_locations_driver_insert" ON public.driver_locations;
DROP POLICY IF EXISTS "driver_locations_driver_select" ON public.driver_locations;
DROP POLICY IF EXISTS "driver_locations_admin_read"    ON public.driver_locations;

CREATE POLICY "driver_locations_admin_all"
  ON public.driver_locations FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Livreur : peut insérer/mettre à jour sa propre position
DROP POLICY IF EXISTS "driver_locations_driver_write" ON public.driver_locations;
CREATE POLICY "driver_locations_driver_write"
  ON public.driver_locations FOR INSERT
  TO authenticated
  WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS "driver_locations_driver_upsert" ON public.driver_locations;
CREATE POLICY "driver_locations_driver_upsert"
  ON public.driver_locations FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

-- Livreur : peut lire sa propre position
DROP POLICY IF EXISTS "driver_locations_driver_read" ON public.driver_locations;
CREATE POLICY "driver_locations_driver_read"
  ON public.driver_locations FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid() OR public.is_admin());

-- 6. Admin peut aussi lire user_locations (positions clients en transit)
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_user_locations" ON public.user_locations;
CREATE POLICY "admin_read_user_locations"
  ON public.user_locations FOR SELECT
  TO authenticated
  USING (public.is_admin() OR auth.uid() = user_id);

-- 7. Realtime sur driver_locations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'driver_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations;
  END IF;
END $$;
