-- Force admin profile to have role='admin' using the known admin UUID
-- This ensures is_admin() returns true for the admin user
INSERT INTO public.profiles (id, role, updated_at)
VALUES ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'admin', NOW())
ON CONFLICT (id) DO UPDATE
  SET role = 'admin',
      updated_at = NOW();

-- Also update any user whose auth metadata already declares admin role
-- (handles accounts created before explicit profile role was set)
UPDATE public.profiles p
SET role = 'admin', updated_at = NOW()
FROM auth.users u
WHERE p.id = u.id
  AND p.role IS DISTINCT FROM 'admin'
  AND (
    (u.raw_user_meta_data ->> 'role') = 'admin'
    OR (u.raw_app_meta_data ->> 'role') = 'admin'
    OR u.email = (
      SELECT email FROM auth.users WHERE id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d' LIMIT 1
    )
  );
