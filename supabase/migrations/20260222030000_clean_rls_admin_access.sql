-- ============================================================
-- Clean RLS on profiles (remove any stale recursive policies)
-- and add admin access policies for orders
-- ============================================================

-- 1. Drop ALL existing SELECT policies on profiles to eliminate
--    any recursive policy that may have been created manually
-- ============================================================
DROP POLICY IF EXISTS "Users can view all profiles"         ON public.profiles;
DROP POLICY IF EXISTS "Users can view active profiles"      ON public.profiles;
DROP POLICY IF EXISTS "Drivers can read own profile"        ON public.profiles;
DROP POLICY IF EXISTS "driver_read_client_profile"          ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"        ON public.profiles;
DROP POLICY IF EXISTS "admin_read_all_profiles"             ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users"    ON public.profiles;

-- Re-create clean profiles SELECT policy (no subqueries → no recursion)
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Keep update-own policy
DROP POLICY IF EXISTS "Users can update own profile"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"                 ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Keep insert-own policy (for profile creation on signup)
DROP POLICY IF EXISTS "profiles_insert_own"                 ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ============================================================
-- 2. SECURITY DEFINER function to check admin role
--    (bypasses RLS → no circular dependency)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================
-- 3. Admin policies on orders
-- ============================================================
DROP POLICY IF EXISTS "Admins can view all orders"    ON public.orders;
DROP POLICY IF EXISTS "Admins can update all orders"  ON public.orders;
DROP POLICY IF EXISTS "Admins can insert orders"      ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders"      ON public.orders;

CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.is_admin() OR auth.uid() = user_id OR driver_id = auth.uid());

CREATE POLICY "Admins can update all orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR driver_id = auth.uid())
  WITH CHECK (public.is_admin() OR driver_id = auth.uid());

CREATE POLICY "Admins can insert orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR auth.uid() = user_id);

-- Remove the old narrower SELECT policy (now superseded)
DROP POLICY IF EXISTS "Users can view own orders"                ON public.orders;
DROP POLICY IF EXISTS "Drivers can view their assigned orders"   ON public.orders;
DROP POLICY IF EXISTS "Drivers can update their assigned orders" ON public.orders;

-- ============================================================
-- 4. Admin policy on order_items
-- ============================================================
DROP POLICY IF EXISTS "Admins can view order items"       ON public.order_items;

CREATE POLICY "Admins can view order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (o.user_id = auth.uid() OR o.driver_id = auth.uid())
    )
  );

-- Drop old narrow order_items policy
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
