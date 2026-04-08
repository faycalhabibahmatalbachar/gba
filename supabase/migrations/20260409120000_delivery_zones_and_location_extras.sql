-- Zones de livraison (GeoJSON) + champs optionnels positions livreurs
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6C47FF',
  geojson jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON public.delivery_zones (is_active);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_zones_deny_auth ON public.delivery_zones;
CREATE POLICY delivery_zones_deny_auth ON public.delivery_zones FOR ALL TO authenticated USING (false) WITH CHECK (false);

ALTER TABLE public.driver_locations
  ADD COLUMN IF NOT EXISTS battery_level int,
  ADD COLUMN IF NOT EXISTS is_moving boolean DEFAULT false;

NOTIFY pgrst, 'reload schema';
