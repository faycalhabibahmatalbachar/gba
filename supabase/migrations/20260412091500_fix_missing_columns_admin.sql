-- GBA admin — colonnes / vues / tables utilitaires (idempotent)
-- Complète 20260403180000 (accent_color catégories) et 20260404000000 (products/orders).

-- ── Catégories : couleurs / icône alias ─────────────────────────────────────
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS color varchar(7) DEFAULT '#6C47FF',
  ADD COLUMN IF NOT EXISTS icon varchar(50);

-- ── Produits : stats dénormalisées (optionnelles, alimentées par trigger) ─
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS total_revenue numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_orders int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_units_sold int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS return_rate numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wishlist_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_rate numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sold_at timestamptz;

-- Slug si absent (certaines bases n’ont que name)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.products p
SET slug = lower(regexp_replace(COALESCE(p.name, p.slug, 'produit'), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE (p.slug IS NULL OR btrim(p.slug) = '')
  AND COALESCE(p.name, '') <> '';

-- ── Commandes : nombre de lignes articles ───────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS item_count int NOT NULL DEFAULT 0;

UPDATE public.orders o
SET item_count = sub.cnt
FROM (
  SELECT order_id, COUNT(*)::int AS cnt
  FROM public.order_items
  GROUP BY order_id
) sub
WHERE o.id = sub.order_id;

-- ── chat_messages : hub admin ─────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.chat_messages') IS NOT NULL THEN
    ALTER TABLE public.chat_messages
      ADD COLUMN IF NOT EXISTS message_type varchar(20) DEFAULT 'text',
      ADD COLUMN IF NOT EXISTS read_at timestamptz,
      ADD COLUMN IF NOT EXISTS is_important boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
      ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS image_url text,
      ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ── device_tokens ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.device_tokens') IS NOT NULL THEN
    ALTER TABLE public.device_tokens
      ADD COLUMN IF NOT EXISTS device_model varchar(100),
      ADD COLUMN IF NOT EXISTS notifications_received int NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ── Tables utilitaires (si absentes) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  device_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level varchar(10) NOT NULL DEFAULT 'info',
  message text NOT NULL,
  metric varchar(50),
  threshold numeric,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  action_taken text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_alerts_level_chk CHECK (level IN ('critical', 'warning', 'info'))
);

CREATE TABLE IF NOT EXISTS public.export_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type varchar(50),
  filters jsonb,
  file_path text,
  row_count int NOT NULL DEFAULT 0,
  format varchar(10),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

-- ── Vue order_items enrichie (produit live) ─────────────────────────────────
CREATE OR REPLACE VIEW public.order_items_enriched AS
SELECT
  oi.id,
  oi.order_id,
  oi.product_id,
  oi.product_name,
  oi.product_image,
  oi.quantity,
  oi.unit_price,
  oi.total_price,
  oi.created_at,
  p.name AS product_name_live,
  p.main_image AS product_image_live,
  p.sku AS sku_live
FROM public.order_items oi
LEFT JOIN public.products p ON p.id = oi.product_id;

GRANT SELECT ON public.order_items_enriched TO authenticated;
GRANT SELECT ON public.order_items_enriched TO anon;

-- ── Vue stats produit (si favorites existe) ─────────────────────────────────
DO $stats$
BEGIN
  IF to_regclass('public.favorites') IS NOT NULL THEN
    EXECUTE $v$
CREATE OR REPLACE VIEW public.product_stats_view AS
SELECT
  p.id AS product_id,
  p.name,
  p.sku,
  p.price,
  COALESCE(p.stock_quantity, 0) AS stock_quantity,
  p.rating,
  p.reviews_count,
  p.status,
  p.created_at,
  COALESCE(SUM(oi.total_price), 0) AS total_revenue,
  COALESCE(SUM(oi.quantity), 0) AS total_units_sold,
  COUNT(DISTINCT oi.order_id) FILTER (
    WHERE o.status IS NULL OR lower(o.status::text) NOT IN ('cancelled', 'refunded')
  ) AS total_orders,
  (
    SELECT COUNT(DISTINCT f.user_id)::bigint
    FROM public.favorites f
    WHERE f.product_id = p.id
  ) AS wishlist_count,
  MAX(o.created_at) FILTER (
    WHERE o.status IS NULL OR lower(o.status::text) NOT IN ('cancelled', 'refunded')
  ) AS last_sold_at
FROM public.products p
LEFT JOIN public.order_items oi ON oi.product_id = p.id
LEFT JOIN public.orders o ON o.id = oi.order_id
GROUP BY p.id, p.name, p.sku, p.price, p.stock_quantity, p.rating, p.reviews_count, p.status, p.created_at
$v$;
    EXECUTE 'GRANT SELECT ON public.product_stats_view TO authenticated';
    EXECUTE 'GRANT SELECT ON public.product_stats_view TO anon';
  END IF;
END
$stats$;

-- ── Vue livraisons enrichie ─────────────────────────────────────────────────
DO $del$
BEGIN
  IF to_regclass('public.deliveries') IS NOT NULL THEN
    EXECUTE $v$
CREATE OR REPLACE VIEW public.deliveries_enriched AS
SELECT
  d.id,
  d.order_id,
  d.driver_id,
  d.status,
  d.pickup_address,
  d.delivery_address,
  d.estimated_delivery_at,
  d.actual_delivery_at,
  d.delivery_fee,
  d.notes,
  d.created_at,
  d.updated_at,
  TRIM(COALESCE(dp.first_name, '') || ' ' || COALESCE(dp.last_name, '')) AS driver_name,
  dp.phone AS driver_phone,
  dp.avatar_url AS driver_avatar,
  dr.vehicle_type,
  dr.vehicle_plate,
  COALESCE(o.total, o.total_amount) AS order_total,
  o.status AS order_status,
  o.order_number,
  TRIM(COALESCE(cp.first_name, '') || ' ' || COALESCE(cp.last_name, '')) AS customer_name,
  cp.phone AS customer_phone
FROM public.deliveries d
LEFT JOIN public.drivers dr ON dr.id = d.driver_id
LEFT JOIN public.profiles dp ON dp.id = COALESCE(dr.user_id, dr.id)
LEFT JOIN public.orders o ON o.id = d.order_id
LEFT JOIN public.profiles cp ON cp.id = o.user_id
$v$;
    EXECUTE 'GRANT SELECT ON public.deliveries_enriched TO authenticated';
    EXECUTE 'GRANT SELECT ON public.deliveries_enriched TO anon';
  END IF;
END
$del$;

-- ── Trigger MAJ stats produit depuis order_items ────────────────────────────
CREATE OR REPLACE FUNCTION public.update_product_stats_from_order_items()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pid uuid;
BEGIN
  pid := COALESCE(NEW.product_id, OLD.product_id);
  IF pid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  UPDATE public.products SET
    total_orders = (
      SELECT COUNT(DISTINCT order_id) FROM public.order_items WHERE product_id = pid
    ),
    total_units_sold = (
      SELECT COALESCE(SUM(quantity), 0) FROM public.order_items WHERE product_id = pid
    ),
    total_revenue = (
      SELECT COALESCE(SUM(total_price), 0) FROM public.order_items WHERE product_id = pid
    ),
    last_sold_at = now()
  WHERE id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_product_stats ON public.order_items;
CREATE TRIGGER trg_update_product_stats
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.update_product_stats_from_order_items();

NOTIFY pgrst, 'reload schema';
