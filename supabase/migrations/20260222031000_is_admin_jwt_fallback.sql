-- Update is_admin() to also accept users whose JWT user_metadata.role = 'admin'
-- This covers admins who were created via signUp({ data: { role: 'admin' } })
-- even before their profiles.role is explicitly set.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (
    -- 1. Check profiles table role column
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    -- 2. Check JWT user_metadata.role (set during signUp by the admin app)
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
    OR
    -- 3. Check JWT app_metadata.role (service-level override)
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  );
$$;

-- Also ensure the admin's profile has role='admin' if it exists
-- (matching by JWT sub is not possible here, so we update via auth.users join)
UPDATE public.profiles p
SET role = 'admin'
FROM auth.users u
WHERE p.id = u.id
  AND (
    (u.raw_user_meta_data ->> 'role') = 'admin'
    OR (u.raw_app_meta_data ->> 'role') = 'admin'
  )
  AND (p.role IS NULL OR p.role != 'admin');
