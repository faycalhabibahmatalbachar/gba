-- ============================================================
-- Push Notification Triggers: Delivery + Special Orders
-- Adds missing triggers for delivery_assignments and special_orders
-- ============================================================

-- ============================================================
-- 6. DELIVERY STATUS CHANGED → notify customer
--    Fires delivery_picked_up / delivery_completed based on status
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_delivery_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_event_type TEXT;
BEGIN
  -- Only fire when status actually changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Determine event type based on new status
  IF NEW.status IN ('picked_up', 'in_transit', 'out_for_delivery') THEN
    v_event_type := 'delivery_picked_up';
  ELSIF NEW.status IN ('delivered', 'completed') THEN
    v_event_type := 'delivery_completed';
  ELSE
    RETURN NEW;  -- No notification for other statuses
  END IF;

  -- Fetch order details (user_id, order_number)
  SELECT id, order_number, user_id
    INTO v_order
    FROM public.orders
   WHERE id = NEW.order_id;

  IF v_order IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.invoke_push_notification(
    jsonb_build_object(
      'type', v_event_type,
      'record', jsonb_build_object(
        'id', v_order.id,
        'order_number', v_order.order_number,
        'user_id', v_order.user_id,
        'status', NEW.status,
        'driver_id', NEW.driver_id
      )
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_status_changed ON public.delivery_assignments;
CREATE TRIGGER trg_delivery_status_changed
  AFTER UPDATE ON public.delivery_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.on_delivery_status_changed();

-- ============================================================
-- 7. SPECIAL ORDER STATUS CHANGED → notify customer
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_special_order_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  PERFORM public.invoke_push_notification(
    jsonb_build_object(
      'type', 'special_order_status_changed',
      'record', jsonb_build_object(
        'id', NEW.id,
        'status', NEW.status,
        'user_id', NEW.user_id
      )
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_special_order_status_changed ON public.special_orders;
CREATE TRIGGER trg_special_order_status_changed
  AFTER UPDATE ON public.special_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.on_special_order_status_changed();
