-- ============================================================
-- GBA — order_details_view: exposer delivered_at + cancelled_at
--
-- Objectif:
-- - Permettre au dashboard admin (Drawer Timeline) de lire delivered_at/cancelled_at
-- - Sans changer la logique métier: on expose simplement les colonnes de orders via o.*
--
-- Notes:
-- - Cette migration suppose que public.orders possède delivered_at/cancelled_at.
-- - Si ces colonnes n'existent pas dans ton projet Supabase, applique d'abord la migration
--   qui les ajoute à orders, puis relance celle-ci.
-- ============================================================

DROP VIEW IF EXISTS public.order_details_view;

CREATE OR REPLACE VIEW public.order_details_view
WITH (security_invoker = true)
AS
SELECT o.* FROM public.orders o;

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
    AND column_name  IN ('delivered_at','cancelled_at','driver_name','customer_name');

  RAISE NOTICE '[order_details_view] Colonnes exposées : %', v_cols;
END $$;
