-- ═══════════════════════════════════════════════════════════════
-- Admin robustness: is_admin() checks profiles + JWT + app_metadata
-- AND ensures delete_user_complete works correctly
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. is_admin() — version consolidée ───────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
    OR COALESCE((auth.jwt() -> 'app_metadata'  ->> 'role'), '') = 'admin'
  );
$$;

-- ─── 2. ensure_admin_profile() — appelable après login ────────
-- Permet à l'admin dashboard de s'auto-promouvoir
-- si son JWT user_metadata.role = 'admin'
CREATE OR REPLACE FUNCTION public.ensure_admin_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
  OR COALESCE((auth.jwt() -> 'app_metadata'  ->> 'role'), '') = 'admin'
  THEN
    UPDATE public.profiles
    SET role = 'admin', updated_at = now()
    WHERE id = auth.uid() AND (role IS DISTINCT FROM 'admin');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_admin_profile() TO authenticated;

-- ─── 3. delete_user_complete — version corrigée ───────────────
-- Vérifie admin via is_admin() (JWT ou profil) pour éviter le blocage
-- quand profil.role n'est pas encore 'admin' mais JWT l'est
CREATE OR REPLACE FUNCTION public.delete_user_complete(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  DELETE FROM public.user_activities  WHERE user_id = target_user_id;
  DELETE FROM public.cart_items       WHERE user_id = target_user_id;
  DELETE FROM public.favorites        WHERE user_id = target_user_id;

  UPDATE public.orders
  SET user_id = NULL
  WHERE user_id = target_user_id;

  DELETE FROM public.device_tokens    WHERE user_id = target_user_id;
  DELETE FROM public.profiles         WHERE id = target_user_id;
  DELETE FROM auth.users              WHERE id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_complete(UUID) TO authenticated;
