-- ═══════════════════════════════════════════════════════════════
-- Garantie finale RLS banners
-- Dépend de is_admin() défini dans 20260225000000
-- (vérifie profiles.role ET JWT user_metadata.role ET app_metadata.role)
-- ═══════════════════════════════════════════════════════════════

-- S'assurer que RLS est activé
ALTER TABLE IF EXISTS public.banners ENABLE ROW LEVEL SECURITY;

-- Supprimer toutes les anciennes policies
DROP POLICY IF EXISTS "Active banners are public"   ON public.banners;
DROP POLICY IF EXISTS "Admins can view banners"     ON public.banners;
DROP POLICY IF EXISTS "Admins can insert banners"   ON public.banners;
DROP POLICY IF EXISTS "Admins can update banners"   ON public.banners;
DROP POLICY IF EXISTS "Admins can delete banners"   ON public.banners;
DROP POLICY IF EXISTS "banners_public_select"       ON public.banners;
DROP POLICY IF EXISTS "banners_admin_insert"        ON public.banners;
DROP POLICY IF EXISTS "banners_admin_update"        ON public.banners;
DROP POLICY IF EXISTS "banners_admin_delete"        ON public.banners;
DROP POLICY IF EXISTS "banners_admin_select"        ON public.banners;

-- SELECT : public pour les bannières actives, admin voit tout
CREATE POLICY "banners_public_select"
  ON public.banners FOR SELECT
  USING (is_active = true OR public.is_admin());

-- INSERT : admin seulement
CREATE POLICY "banners_admin_insert"
  ON public.banners FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- UPDATE : admin seulement
CREATE POLICY "banners_admin_update"
  ON public.banners FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE : admin seulement
CREATE POLICY "banners_admin_delete"
  ON public.banners FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ─── Auto-fix : si JWT contient role=admin, mettre à jour le profil ─────────
-- Cette fonction est idempotente — appelée depuis AuthContext après login
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
    WHERE id = auth.uid()
      AND (role IS DISTINCT FROM 'admin');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_admin_profile() TO authenticated;
