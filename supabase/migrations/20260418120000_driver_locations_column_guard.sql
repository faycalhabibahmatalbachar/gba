-- Garantit les colonnes attendues par l’admin BFF (évite erreurs PostgREST 400 si migrations partielles).
ALTER TABLE public.driver_locations
  ADD COLUMN IF NOT EXISTS recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS speed_mps double precision,
  ADD COLUMN IF NOT EXISTS heading double precision,
  ADD COLUMN IF NOT EXISTS battery_level int,
  ADD COLUMN IF NOT EXISTS is_moving boolean DEFAULT false;

NOTIFY pgrst, 'reload schema';
