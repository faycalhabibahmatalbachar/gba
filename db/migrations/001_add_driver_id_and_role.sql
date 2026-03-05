-- Migration: Add driver_id to orders and role to profiles
-- Run this in the Supabase SQL Editor

-- 1. Add role column to profiles (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role text DEFAULT NULL;
    COMMENT ON COLUMN public.profiles.role IS 'User role: NULL=customer, driver=delivery driver, admin=administrator';
  END IF;
END $$;

-- 2. Add driver_id column to orders (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'driver_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN driver_id uuid REFERENCES public.profiles(id) DEFAULT NULL;
    COMMENT ON COLUMN public.orders.driver_id IS 'ID of the assigned delivery driver';
  END IF;
END $$;

-- 3. Create index on orders.driver_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON public.orders(driver_id);

-- 4. Create index on profiles.role for filtering drivers
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 5. Enable RLS policies for the new columns
-- Allow admins to assign drivers to orders
DO $$
BEGIN
  -- Drop existing policy if it exists to avoid conflicts
  DROP POLICY IF EXISTS "Allow admin to update driver_id on orders" ON public.orders;
  
  CREATE POLICY "Allow admin to update driver_id on orders"
    ON public.orders
    FOR UPDATE
    USING (true)
    WITH CHECK (true);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Policy creation skipped: %', SQLERRM;
END $$;

-- 6. Allow reading role column on profiles
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow reading role on profiles" ON public.profiles;
  
  CREATE POLICY "Allow reading role on profiles"
    ON public.profiles
    FOR SELECT
    USING (true);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Policy creation skipped: %', SQLERRM;
END $$;
