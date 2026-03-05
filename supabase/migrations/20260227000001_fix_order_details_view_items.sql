-- ============================================================
-- GBA — Fix order_details_view: restore items aggregation + driver join
--
-- Issue: Previous migration simplified view to SELECT o.* which lost:
-- - items aggregation from order_items table
-- - driver_name, driver_phone from profiles join
-- - total_items calculation
--
-- This fix restores the full view with all needed columns
-- ============================================================

DROP VIEW IF EXISTS public.order_details_view;

CREATE OR REPLACE VIEW public.order_details_view
WITH (security_invoker = true)
AS
SELECT
  -- Core order columns (explicit list to avoid duplicates with o.*)
  o.id,
  o.order_number,
  o.user_id,
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

  -- Profil client (phone from profiles, may override if exists in orders)
  COALESCE(p.phone, o.customer_phone_profile) AS customer_phone_profile,

  -- Livreur assigné
  CASE
    WHEN d.id IS NOT NULL
    THEN TRIM(COALESCE(d.first_name, '') || ' ' || COALESCE(d.last_name, ''))
    ELSE NULL
  END AS driver_name,
  d.phone AS driver_phone,
  d.email AS driver_email,

  -- Articles: aggregate from order_items table, or fallback to orders.items JSONB column
  CASE
    WHEN items_from_table.items IS NOT NULL AND jsonb_array_length(items_from_table.items) > 0
    THEN items_from_table.items
    ELSE COALESCE(o.items, '[]'::jsonb)
  END AS items,

  -- Total items: from order_items or fallback
  CASE
    WHEN items_from_table.total_items IS NOT NULL AND items_from_table.total_items > 0
    THEN items_from_table.total_items
    ELSE COALESCE(o.total_items, 0)
  END AS total_items

FROM public.orders o

-- Profil client
LEFT JOIN public.profiles p ON p.id = o.user_id

-- Profil livreur
LEFT JOIN public.profiles d ON d.id = o.driver_id

-- Articles de la commande (from order_items table)
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
) items_from_table ON true;

-- Permissions
GRANT SELECT ON public.order_details_view TO authenticated;
GRANT SELECT ON public.order_details_view TO anon;

-- Validation
DO $$
DECLARE
  v_cols text;
BEGIN
  SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
  INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'order_details_view'
    AND column_name  IN ('items', 'total_items', 'driver_name', 'driver_phone', 'customer_phone_profile');

  RAISE NOTICE '[order_details_view] Colonnes exposées : %', v_cols;
END $$;
