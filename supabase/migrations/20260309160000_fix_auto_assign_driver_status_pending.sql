-- Migration: Fix auto-assign driver trigger to keep new orders in 'pending'
-- Created: 2026-03-09
-- Purpose: A newly created order must remain 'pending' by default; driver assignment must not auto-confirm.

CREATE OR REPLACE FUNCTION public.assign_available_driver()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver_id UUID;
  v_customer_lat DOUBLE PRECISION;
  v_customer_lng DOUBLE PRECISION;
BEGIN
  -- Only assign for pending orders without driver
  IF NEW.status IS DISTINCT FROM 'pending' OR NEW.driver_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get customer's current location
  SELECT latitude, longitude INTO v_customer_lat, v_customer_lng
  FROM public.user_current_location
  WHERE user_id = NEW.user_id
  LIMIT 1;

  -- Find closest available driver
  SELECT p.id INTO v_driver_id
  FROM public.profiles p
  LEFT JOIN public.user_current_location ucl ON ucl.user_id = p.id
  LEFT JOIN (
    SELECT driver_id, COUNT(*) as active_count
    FROM public.orders
    WHERE status IN ('confirmed', 'processing', 'shipped', 'out_for_delivery')
    GROUP BY driver_id
  ) active_orders ON active_orders.driver_id = p.id
  WHERE p.role = 'driver'
    AND (p.is_available = true OR p.is_available IS NULL)
  ORDER BY 
    CASE WHEN ucl.latitude IS NOT NULL THEN 0 ELSE 1 END,
    CASE 
      WHEN v_customer_lat IS NOT NULL AND v_customer_lng IS NOT NULL AND ucl.latitude IS NOT NULL THEN
        SQRT(
          POWER(ucl.latitude - v_customer_lat, 2) +
          POWER(ucl.longitude - v_customer_lng, 2)
        )
      ELSE 999999
    END,
    COALESCE(active_orders.active_count, 0),
    RANDOM()
  LIMIT 1;

  -- If driver found, assign ONLY (keep status pending)
  IF v_driver_id IS NOT NULL THEN
    NEW.driver_id := v_driver_id;
    NEW.updated_at := NOW();
    RAISE NOTICE 'Auto-assigned driver % to order % (status kept as %)', v_driver_id, NEW.id, NEW.status;
  ELSE
    RAISE NOTICE 'No available driver for order %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger (ensure single authoritative trigger)
DROP TRIGGER IF EXISTS trigger_assign_driver_on_insert ON public.orders;
DROP TRIGGER IF EXISTS trigger_auto_assign_driver ON public.orders;

CREATE TRIGGER trigger_assign_driver_on_insert
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_available_driver();
