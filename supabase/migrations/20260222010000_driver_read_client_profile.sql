-- The "Users can view all profiles" policy (USING true) already grants SELECT
-- to all authenticated users, including drivers. The previous policy here caused
-- infinite recursion (profiles -> orders -> profiles). Dropping it.
DROP POLICY IF EXISTS "driver_read_client_profile" ON public.profiles;
