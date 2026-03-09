-- Migration: Location tracking tables for professional GPS tracking
-- Created: 2026-03-07
-- Description: Upgrade existing user_locations + create user_current_location
--
-- NOTE: public.user_locations already exists (migration 20260221170000)
--   with columns: user_id(PK), lat, lng, speed, heading, accuracy, captured_at.
--   This migration renames/adds columns to match the new schema and drops the
--   single-row-per-user PK so we can store location history.

-- ═══════════════════════════════════════════════════════════════
-- 1. ALTER existing user_locations table
-- ═══════════════════════════════════════════════════════════════

-- Add id column (will become the new PK)
ALTER TABLE public.user_locations
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Rename lat/lng → latitude/longitude
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='user_locations' AND column_name='lat') THEN
    ALTER TABLE public.user_locations RENAME COLUMN lat TO latitude;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='user_locations' AND column_name='lng') THEN
    ALTER TABLE public.user_locations RENAME COLUMN lng TO longitude;
  END IF;
END $$;

-- Rename captured_at → created_at
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='user_locations' AND column_name='captured_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='user_locations' AND column_name='created_at') THEN
    ALTER TABLE public.user_locations RENAME COLUMN captured_at TO created_at;
  END IF;
END $$;

-- Add missing columns
ALTER TABLE public.user_locations
  ADD COLUMN IF NOT EXISTS altitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Set REPLICA IDENTITY FULL before dropping PK (required for realtime updates)
ALTER TABLE public.user_locations REPLICA IDENTITY FULL;

-- Make user_id NOT NULL (it was already PK so it is, but be explicit)
-- Drop the old PK on user_id so we can store multiple rows per user
ALTER TABLE public.user_locations DROP CONSTRAINT IF EXISTS user_locations_pkey;

-- Set new PK on id
-- First ensure all existing rows have an id
UPDATE public.user_locations SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.user_locations ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.user_locations ADD PRIMARY KEY (id);

-- Now set REPLICA IDENTITY back to DEFAULT (uses PK)
ALTER TABLE public.user_locations REPLICA IDENTITY DEFAULT;

-- Make created_at NOT NULL with default
ALTER TABLE public.user_locations
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW();

-- ═══════════════════════════════════════════════════════════════
-- 2. CREATE user_current_location (new table)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_current_location (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 3. Indexes for performance
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON public.user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_created_at ON public.user_locations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_locations_user_time ON public.user_locations(user_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 4. RLS + Grants
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_current_location ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.user_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_current_location TO authenticated;

-- Drop old policies on user_locations to avoid conflicts
DROP POLICY IF EXISTS "users_own_location" ON public.user_locations;
DROP POLICY IF EXISTS "drivers_read_user_locations" ON public.user_locations;
DROP POLICY IF EXISTS "admin_read_user_locations" ON public.user_locations;
DROP POLICY IF EXISTS "Users can insert own locations" ON public.user_locations;
DROP POLICY IF EXISTS "Users can view own location history" ON public.user_locations;
DROP POLICY IF EXISTS "Admins can view all locations" ON public.user_locations;
DROP POLICY IF EXISTS "Drivers can view customer locations for assigned orders" ON public.user_locations;

-- user_locations policies
CREATE POLICY "Users can insert own locations"
  ON public.user_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own location history"
  ON public.user_locations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all locations"
  ON public.user_locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Drivers can view customer locations for assigned orders"
  ON public.user_locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'driver'
    )
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE driver_id = auth.uid()
        AND user_id = user_locations.user_id
        AND status IN ('confirmed', 'processing', 'shipped', 'out_for_delivery')
    )
  );

-- user_current_location policies
DROP POLICY IF EXISTS "Users can upsert own current location" ON public.user_current_location;
DROP POLICY IF EXISTS "Admins can view all current locations" ON public.user_current_location;
DROP POLICY IF EXISTS "Drivers can view customer current locations" ON public.user_current_location;

CREATE POLICY "Users can upsert own current location"
  ON public.user_current_location
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all current locations"
  ON public.user_current_location
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Drivers can view customer current locations"
  ON public.user_current_location
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'driver'
    )
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE driver_id = auth.uid()
        AND user_id = user_current_location.user_id
        AND status IN ('confirmed', 'processing', 'shipped', 'out_for_delivery')
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 5. Cleanup function
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.cleanup_old_locations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.user_locations
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Comments
COMMENT ON TABLE public.user_locations IS 'Historical GPS location data for delivery tracking';
COMMENT ON TABLE public.user_current_location IS 'Real-time current position of users for live tracking';
