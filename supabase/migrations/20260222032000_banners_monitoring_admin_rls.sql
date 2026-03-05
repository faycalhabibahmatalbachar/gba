-- ============================================================
-- Admin policies for banners table
-- ============================================================
ALTER TABLE IF EXISTS public.banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view banners"   ON public.banners;
DROP POLICY IF EXISTS "Admins can insert banners"  ON public.banners;
DROP POLICY IF EXISTS "Admins can update banners"  ON public.banners;
DROP POLICY IF EXISTS "Admins can delete banners"  ON public.banners;
DROP POLICY IF EXISTS "Active banners are public"  ON public.banners;

-- Public can read active banners (mobile app)
CREATE POLICY "Active banners are public"
  ON public.banners FOR SELECT
  USING (is_active = true OR public.is_admin());

-- Admin full write access
CREATE POLICY "Admins can insert banners"
  ON public.banners FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update banners"
  ON public.banners FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete banners"
  ON public.banners FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- Admin read policies for monitoring pages
-- ============================================================

-- cart_items: admin can read all
DROP POLICY IF EXISTS "Admins can view all cart items" ON public.cart_items;
CREATE POLICY "Admins can view all cart items"
  ON public.cart_items FOR SELECT
  TO authenticated
  USING (public.is_admin() OR auth.uid() = user_id);

-- wishlist / favorites table (may be named either)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='wishlist') THEN
    EXECUTE $pol$
      DROP POLICY IF EXISTS "Admins can view all wishlist" ON public.wishlist;
      CREATE POLICY "Admins can view all wishlist"
        ON public.wishlist FOR SELECT
        TO authenticated
        USING (public.is_admin() OR auth.uid() = user_id);
    $pol$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='favorites') THEN
    EXECUTE $pol$
      DROP POLICY IF EXISTS "Admins can view all favorites" ON public.favorites;
      CREATE POLICY "Admins can view all favorites"
        ON public.favorites FOR SELECT
        TO authenticated
        USING (public.is_admin() OR auth.uid() = user_id);
    $pol$;
  END IF;
END $$;

-- products: admin can read all (including inactive)
DROP POLICY IF EXISTS "Admins can view all products" ON public.products;
CREATE POLICY "Admins can view all products"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.is_admin() OR is_active = true);

-- categories: admin can read all
DROP POLICY IF EXISTS "Admins can view all categories" ON public.categories;
CREATE POLICY "Admins can view all categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (public.is_admin() OR is_active = true);
