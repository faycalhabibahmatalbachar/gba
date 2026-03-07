-- ============================================================
-- Push Notification Trigger: Special Order Created
-- Notifies admins when a customer creates a new special order
-- ============================================================

CREATE OR REPLACE FUNCTION public.on_special_order_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.invoke_push_notification(
    jsonb_build_object(
      'type', 'special_order_created',
      'record', jsonb_build_object(
        'id', NEW.id,
        'status', NEW.status,
        'user_id', NEW.user_id,
        'product_name', NEW.product_name,
        'quantity', NEW.quantity
      )
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_special_order_created ON public.special_orders;
CREATE TRIGGER trg_special_order_created
  AFTER INSERT ON public.special_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.on_special_order_created();
