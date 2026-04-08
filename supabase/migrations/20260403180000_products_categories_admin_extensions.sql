-- Extensions admin produits / catégories (GBA admin_gba)
-- Colonnes optionnelles : idempotentes

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS listing_status text NOT NULL DEFAULT 'active'
    CHECK (listing_status IN ('draft', 'active', 'archived'));

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS gallery_urls text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS admin_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'XOF';

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS accent_color text;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS icon_key text;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_listing_status ON public.products (listing_status);
CREATE INDEX IF NOT EXISTS idx_products_created_at_id ON public.products (created_at DESC, id DESC);

-- Filtres performance admin (BFF)
CREATE OR REPLACE FUNCTION public.admin_product_ids_bestsellers(p_limit integer DEFAULT 500)
RETURNS uuid[]
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(x.product_id ORDER BY x.tr DESC), ARRAY[]::uuid[])
  FROM (
    SELECT oi.product_id, SUM(oi.total_price)::numeric AS tr
    FROM public.order_items oi
    GROUP BY oi.product_id
    ORDER BY tr DESC NULLS LAST
    LIMIT p_limit
  ) x;
$$;

CREATE OR REPLACE FUNCTION public.admin_product_ids_slow_movers(p_limit integer DEFAULT 500)
RETURNS uuid[]
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(x.product_id ORDER BY x.tr ASC NULLS FIRST), ARRAY[]::uuid[])
  FROM (
    SELECT p.id AS product_id, COALESCE(s.tr, 0)::numeric AS tr
    FROM public.products p
    LEFT JOIN (
      SELECT product_id, SUM(total_price)::numeric AS tr
      FROM public.order_items
      GROUP BY product_id
    ) s ON s.product_id = p.id
    WHERE COALESCE(p.quantity, 0) > 0
    ORDER BY tr ASC NULLS FIRST, p.created_at DESC
    LIMIT p_limit
  ) x;
$$;

GRANT EXECUTE ON FUNCTION public.admin_product_ids_bestsellers(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_product_ids_slow_movers(integer) TO service_role;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS admin_response text,
  ADD COLUMN IF NOT EXISTS admin_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderation_status text DEFAULT 'pending';

DROP POLICY IF EXISTS "reviews_admin_update" ON public.reviews;
CREATE POLICY "reviews_admin_update"
  ON public.reviews FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
