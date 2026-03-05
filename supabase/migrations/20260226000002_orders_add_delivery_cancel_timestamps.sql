-- ============================================================
-- GBA — orders: ajouter delivered_at + cancelled_at (enterprise)
--
-- Objectif:
-- - Standardiser les timestamps de cycle de vie commande au niveau DB
-- - Permettre aux apps (admin + driver + client) d'afficher des dates fiables
-- - Supporter le trigger set_order_status_timestamps (migration 20260226000001)
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
