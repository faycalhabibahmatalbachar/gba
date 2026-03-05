-- ============================================================
-- GBA — Fix order_details_view : ajouter driver_name + driver_phone
-- Root cause : la vue joignait uniquement le profil client (user_id),
--              pas le livreur (driver_id) → driver_name = null après refresh
-- ============================================================

DROP VIEW IF EXISTS public.order_details_view;

CREATE OR REPLACE VIEW public.order_details_view
WITH (security_invoker = true)
AS
SELECT
  o.*,

  -- Profil client (colonnes calculées qui n'existent pas dans orders)
  p.phone                                                                   AS customer_phone_profile,

  -- Livreur assigné : nouvelles colonnes exposées par ce fix
  CASE
    WHEN d.id IS NOT NULL
    THEN TRIM(COALESCE(d.first_name, '') || ' ' || COALESCE(d.last_name, ''))
    ELSE NULL
  END                                                                       AS driver_name,
  d.phone                                                                   AS driver_phone,
  d.email                                                                   AS driver_email,

  -- Articles
  COALESCE(items.items,       '[]'::jsonb)                                  AS items,
  COALESCE(items.total_items, 0)                                            AS total_items

FROM public.orders o

-- Profil client
LEFT JOIN public.profiles p ON p.id = o.user_id

-- Profil livreur (jointure clé du fix — exposé driver_name pour persistance après refresh)
LEFT JOIN public.profiles d ON d.id = o.driver_id

-- Articles de la commande (lateral)
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
    )             AS items,
    SUM(oi.quantity)::int AS total_items
  FROM public.order_items oi
  WHERE oi.order_id = o.id
) items ON true;

-- Permissions
GRANT SELECT ON public.order_details_view TO authenticated;
GRANT SELECT ON public.order_details_view TO anon;

-- Validation rapide post-migration
DO $$
DECLARE
  v_cols text;
BEGIN
  SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
  INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'order_details_view'
    AND column_name  IN ('driver_name','driver_phone','driver_email','customer_name');

  RAISE NOTICE '[order_details_view] Colonnes exposées : %', v_cols;
END $$;
