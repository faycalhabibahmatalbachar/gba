-- Allow admins to read/update/delete any device_tokens (admin panel notifications + cleanup)

DROP POLICY IF EXISTS "device_tokens_admin_all" ON public.device_tokens;
CREATE POLICY "device_tokens_admin_all"
ON public.device_tokens
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
