-- ============================================================
-- GBA — orders: timestamps auto selon changement de status
--
-- Objectif:
-- - Cohérence globale (admin web + app driver + autres clients)
-- - Dès que status devient 'delivered' => delivered_at = now()
-- - Dès que status devient 'cancelled' => cancelled_at = now()
--
-- Règles:
-- - On n'écrase pas un timestamp déjà renseigné.
-- - Si on sort de delivered/cancelled, on ne null pas automatiquement (historique).
--   (Si tu veux le nulling auto, on peut l'ajouter.)
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_order_status_timestamps()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF lower(coalesce(NEW.status, '')) = 'delivered' THEN
      IF NEW.delivered_at IS NULL THEN
        NEW.delivered_at := now();
      END IF;
    ELSIF lower(coalesce(NEW.status, '')) = 'cancelled' THEN
      IF NEW.cancelled_at IS NULL THEN
        NEW.cancelled_at := now();
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_set_status_timestamps ON public.orders;

CREATE TRIGGER trg_orders_set_status_timestamps
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_status_timestamps();
