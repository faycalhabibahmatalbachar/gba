-- ============================================================
-- GBA — Fix Banners Storage + order_details_view currency
-- Date: 2026-03-01
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Create banners storage bucket (public, 5MB max)
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners',
  'banners',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public            = true,
  file_size_limit   = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/avif'];

-- ────────────────────────────────────────────────────────────
-- 2. Storage RLS policies for banners bucket (via storage.objects)
-- ────────────────────────────────────────────────────────────

-- Drop old policies to avoid conflicts
DROP POLICY IF EXISTS "banners_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "banners_admin_insert"  ON storage.objects;
DROP POLICY IF EXISTS "banners_admin_update"  ON storage.objects;
DROP POLICY IF EXISTS "banners_admin_delete"  ON storage.objects;

-- Public can read banner images
CREATE POLICY "banners_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'banners');

-- Admin can upload (insert) banner images
CREATE POLICY "banners_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'banners'
    AND public.is_admin()
  );

-- Admin can update banner images
CREATE POLICY "banners_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'banners'
    AND public.is_admin()
  );

-- Admin can delete banner images
CREATE POLICY "banners_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'banners'
    AND public.is_admin()
  );

-- ────────────────────────────────────────────────────────────
-- 3. Ensure banners table has all required columns
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- image_path (storage relative path)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'banners' AND column_name = 'image_path'
  ) THEN
    ALTER TABLE public.banners ADD COLUMN image_path TEXT;
  END IF;

  -- image_url (public URL)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'banners' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE public.banners ADD COLUMN image_url TEXT;
  END IF;

  -- link_url (optional redirect URL)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'banners' AND column_name = 'link_url'
  ) THEN
    ALTER TABLE public.banners ADD COLUMN link_url TEXT;
  END IF;

  -- position (alias for display_order)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'banners' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE public.banners ADD COLUMN display_order INTEGER DEFAULT 0;
  END IF;

  -- starts_at / ends_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'banners' AND column_name = 'starts_at'
  ) THEN
    ALTER TABLE public.banners ADD COLUMN starts_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'banners' AND column_name = 'ends_at'
  ) THEN
    ALTER TABLE public.banners ADD COLUMN ends_at TIMESTAMPTZ;
  END IF;

  -- updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'banners' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.banners ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_banners_is_active ON public.banners(is_active);
CREATE INDEX IF NOT EXISTS idx_banners_display_order ON public.banners(display_order);

-- ────────────────────────────────────────────────────────────
-- 4. Fix order_details_view — add currency + customer_id alias
-- ────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.order_details_view;

CREATE OR REPLACE VIEW public.order_details_view
WITH (security_invoker = true)
AS
SELECT
  -- Core order columns
  o.id,
  o.order_number,
  o.user_id,
  o.user_id AS customer_id,
  o.status,
  o.total_amount,
  o.shipping_fee,
  o.shipping_cost,
  o.tax_amount,
  o.discount_amount,
  o.payment_method,
  o.payment_status,
  o.payment_provider,
  o.paid_at,
  o.customer_name,
  o.customer_phone,
  o.customer_email,
  o.shipping_country,
  o.shipping_city,
  o.shipping_district,
  o.shipping_address,
  o.notes,
  o.driver_id,
  o.created_at,
  o.updated_at,
  o.delivery_lat,
  o.delivery_lng,
  o.delivery_accuracy,
  o.delivery_captured_at,
  o.delivered_at,
  o.cancelled_at,

  -- Currency (with fallback)
  COALESCE(o.currency, 'FCFA') AS currency,

  -- Client profile phone
  COALESCE(p.phone, o.customer_phone_profile) AS customer_phone_profile,

  -- Driver details
  CASE
    WHEN d.id IS NOT NULL
    THEN TRIM(COALESCE(d.first_name, '') || ' ' || COALESCE(d.last_name, ''))
    ELSE NULL
  END AS driver_name,
  d.phone AS driver_phone,
  d.email AS driver_email,

  -- Order items: from order_items table OR fallback to orders.items JSONB
  CASE
    WHEN items_agg.items IS NOT NULL AND jsonb_array_length(items_agg.items) > 0
    THEN items_agg.items
    ELSE COALESCE(o.items, '[]'::jsonb)
  END AS items,

  -- Total items count
  CASE
    WHEN items_agg.total_items IS NOT NULL AND items_agg.total_items > 0
    THEN items_agg.total_items
    ELSE COALESCE(o.total_items, 0)
  END AS total_items

FROM public.orders o

-- Client profile
LEFT JOIN public.profiles p ON p.id = o.user_id

-- Driver profile
LEFT JOIN public.profiles d ON d.id = o.driver_id

-- Aggregated order items
LEFT JOIN LATERAL (
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id',            oi.id,
        'product_id',    oi.product_id,
        'product_name',  oi.product_name,
        'product_image', oi.product_image,
        'quantity',      oi.quantity,
        'unit_price',    oi.unit_price,
        'total_price',   oi.total_price,
        'created_at',    oi.created_at
      )
      ORDER BY oi.created_at ASC
    ) AS items,
    SUM(oi.quantity)::int AS total_items
  FROM public.order_items oi
  WHERE oi.order_id = o.id
) items_agg ON true;

-- Permissions
GRANT SELECT ON public.order_details_view TO authenticated;
GRANT SELECT ON public.order_details_view TO anon;

-- ────────────────────────────────────────────────────────────
-- 5. Add currency column to orders table if missing
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'currency'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN currency TEXT DEFAULT 'FCFA';
    COMMENT ON COLUMN public.orders.currency IS 'Order currency (default: FCFA)';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 6. Ensure categories table supports hierarchy (parent_id)
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
    COMMENT ON COLUMN public.categories.parent_id IS 'Parent category for hierarchical structure';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'slug'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN slug TEXT;
    COMMENT ON COLUMN public.categories.slug IS 'URL-friendly identifier';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON public.categories(is_active);

-- Validation
DO $$
DECLARE v_cols text;
BEGIN
  SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
  INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'order_details_view';
  RAISE NOTICE '[order_details_view] Columns: %', v_cols;
END $$;
