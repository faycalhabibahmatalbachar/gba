-- ============================================================
-- GBA — RLS Policies: categories + banners | Categories link_url
-- Date: 2026-03-01
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Categories table: add link_url column if missing
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'link_url'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN link_url TEXT;
    COMMENT ON COLUMN public.categories.link_url IS 'Optional redirect URL for the category';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. RLS — Categories table
-- Public: read active categories
-- Admin: full CRUD
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_public_read"  ON public.categories;
DROP POLICY IF EXISTS "categories_admin_all"    ON public.categories;

-- Anyone can read active categories (mobile app + admin)
CREATE POLICY "categories_public_read"
  ON public.categories FOR SELECT
  USING (is_active = true OR public.is_admin());

-- Admins have full write access
CREATE POLICY "categories_admin_all"
  ON public.categories FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 3. RLS — Banners table
-- Public: read active banners
-- Admin: full CRUD
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banners_public_read"  ON public.banners;
DROP POLICY IF EXISTS "banners_admin_all"    ON public.banners;

-- Anyone can read active banners (for mobile app)
CREATE POLICY "banners_public_read"
  ON public.banners FOR SELECT
  USING (is_active = true OR public.is_admin());

-- Admins have full write access
CREATE POLICY "banners_admin_all"
  ON public.banners FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 4. Grants
-- ────────────────────────────────────────────────────────────
GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;

GRANT SELECT ON public.banners TO anon;
GRANT SELECT ON public.banners TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.banners TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 5. Validation
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cat_rls  boolean;
  v_ban_rls  boolean;
BEGIN
  SELECT relrowsecurity INTO v_cat_rls FROM pg_class WHERE relname = 'categories' AND relnamespace = 'public'::regnamespace;
  SELECT relrowsecurity INTO v_ban_rls FROM pg_class WHERE relname = 'banners'    AND relnamespace = 'public'::regnamespace;
  RAISE NOTICE '[RLS] categories.rls = %, banners.rls = %', v_cat_rls, v_ban_rls;
END $$;
