-- Add is_available column to profiles for driver availability toggle
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT true;

-- Index for fast availability queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_available
  ON public.profiles (is_available)
  WHERE role = 'driver';

COMMENT ON COLUMN public.profiles.is_available IS
  'Driver availability toggle — true = available, false = on break/unavailable';
