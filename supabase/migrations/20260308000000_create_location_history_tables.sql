-- Migration: Create location history tables for long-term GPS tracking
-- Created: 2026-03-08
-- Description: Add history tables to store all GPS positions (90 days retention)

-- ═══════════════════════════════════════════════════════════════
-- 1. CREATE driver_location_history (archive complète positions livreurs)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.driver_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  battery_level INTEGER,
  is_moving BOOLEAN DEFAULT false,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_driver_history_driver_time 
  ON public.driver_location_history(driver_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_history_captured 
  ON public.driver_location_history(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_history_order 
  ON public.driver_location_history(order_id) WHERE order_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 2. CREATE user_location_history (archive positions clients)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_user_history_user_time 
  ON public.user_location_history(user_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_history_captured 
  ON public.user_location_history(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_history_order 
  ON public.user_location_history(order_id) WHERE order_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 3. RLS Policies
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.driver_location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_location_history ENABLE ROW LEVEL SECURITY;

-- Admin: accès complet historique
CREATE POLICY "Admin can view all driver history"
  ON public.driver_location_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can view all user history"
  ON public.user_location_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Driver: peut insérer son propre historique
CREATE POLICY "Driver can insert own history"
  ON public.driver_location_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = driver_id);

-- Driver: peut lire son propre historique
CREATE POLICY "Driver can view own history"
  ON public.driver_location_history FOR SELECT
  TO authenticated
  USING (auth.uid() = driver_id);

-- User: peut insérer son propre historique
CREATE POLICY "User can insert own history"
  ON public.user_location_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- User: peut lire son propre historique
CREATE POLICY "User can view own history"
  ON public.user_location_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- 4. Grants
-- ═══════════════════════════════════════════════════════════════
GRANT SELECT, INSERT ON public.driver_location_history TO authenticated;
GRANT SELECT, INSERT ON public.user_location_history TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 5. Trigger pour détecter mouvement
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.detect_movement()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_moving := (NEW.speed IS NOT NULL AND NEW.speed > 0.5);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER driver_location_detect_movement
  BEFORE INSERT OR UPDATE ON public.driver_location_history
  FOR EACH ROW EXECUTE FUNCTION public.detect_movement();

-- ═══════════════════════════════════════════════════════════════
-- 6. Fonction nettoyage automatique (90 jours)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.cleanup_location_history()
RETURNS void AS $$
BEGIN
  DELETE FROM public.driver_location_history 
  WHERE captured_at < NOW() - INTERVAL '90 days';
  
  DELETE FROM public.user_location_history 
  WHERE captured_at < NOW() - INTERVAL '90 days';
  
  RAISE NOTICE 'Location history cleaned up (90+ days old)';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- 7. Fonction calcul distance (Haversine)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.calculate_distance(
  lat1 DOUBLE PRECISION,
  lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lng2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
  r DOUBLE PRECISION := 6371000; -- Rayon terre en mètres
  dlat DOUBLE PRECISION;
  dlng DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  dlat := RADIANS(lat2 - lat1);
  dlng := RADIANS(lng2 - lng1);
  
  a := SIN(dlat / 2) * SIN(dlat / 2) +
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
       SIN(dlng / 2) * SIN(dlng / 2);
  
  c := 2 * ATAN2(SQRT(a), SQRT(1 - a));
  
  RETURN r * c; -- Distance en mètres
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ═══════════════════════════════════════════════════════════════
-- 8. Vue statistiques livreurs
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.driver_location_stats AS
SELECT 
  driver_id,
  COUNT(*) as total_positions,
  MIN(captured_at) as first_position,
  MAX(captured_at) as last_position,
  AVG(speed) as avg_speed_ms,
  MAX(speed) as max_speed_ms,
  AVG(accuracy) as avg_accuracy_m,
  COUNT(*) FILTER (WHERE is_moving = true) as positions_moving,
  COUNT(*) FILTER (WHERE is_moving = false) as positions_stopped
FROM public.driver_location_history
WHERE captured_at > NOW() - INTERVAL '24 hours'
GROUP BY driver_id;

-- ═══════════════════════════════════════════════════════════════
-- 9. Realtime publication
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
  -- Activer realtime sur tables historique (pour analytics en temps réel)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'driver_location_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_location_history;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_location_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_location_history;
  END IF;
END $$;

-- Comments
COMMENT ON TABLE public.driver_location_history IS 'Complete GPS history for drivers (90 days retention)';
COMMENT ON TABLE public.user_location_history IS 'Complete GPS history for users/clients (90 days retention)';
COMMENT ON FUNCTION public.calculate_distance IS 'Calculate distance between two GPS coordinates using Haversine formula';
COMMENT ON FUNCTION public.cleanup_location_history IS 'Cleanup location history older than 90 days';
