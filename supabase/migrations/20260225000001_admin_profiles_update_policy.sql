-- ═══════════════════════════════════════════════════════════════
-- Admin UPDATE/DELETE on profiles
-- Nécessaire pour : suspend / unsuspend / edit / delete users
-- dans UserManagementUltra
-- ═══════════════════════════════════════════════════════════════

-- Politique UPDATE admin (peut modifier n'importe quel profil)
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Politique DELETE admin
-- (delete_user_complete est SECURITY DEFINER donc bypass RLS,
--  mais cette policy est nécessaire si on appelle .delete() directement)
DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.is_admin());
