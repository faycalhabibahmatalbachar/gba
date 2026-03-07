-- Migration: Location tracking tables for professional GPS tracking
-- Created: 2026-03-07
-- Description: Tables for storing user location history and current positions

-- Table: user_locations (historical location data)
CREATE TABLE IF NOT EXISTS public.user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: user_current_location (real-time current position)
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON public.user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_created_at ON public.user_locations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_locations_user_time ON public.user_locations(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_current_location ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT ON public.user_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_current_location TO authenticated;

-- RLS Policies for user_locations

-- Users can insert their own locations
CREATE POLICY "Users can insert own locations"
  ON public.user_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own location history
CREATE POLICY "Users can view own location history"
  ON public.user_locations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all locations
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

-- Drivers can view locations of their assigned orders
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
        AND customer_id = user_locations.user_id
        AND status IN ('confirmed', 'processing', 'shipped', 'out_for_delivery')
    )
  );

-- RLS Policies for user_current_location

-- Users can upsert their own current location
CREATE POLICY "Users can upsert own current location"
  ON public.user_current_location
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all current locations
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

-- Drivers can view current location of customers with active orders
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
        AND customer_id = user_current_location.user_id
        AND status IN ('confirmed', 'processing', 'shipped', 'out_for_delivery')
    )
  );

-- Function to clean old location data (keep last 30 days)
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

-- Comment on tables
COMMENT ON TABLE public.user_locations IS 'Historical GPS location data for delivery tracking';
COMMENT ON TABLE public.user_current_location IS 'Real-time current position of users for live tracking';
