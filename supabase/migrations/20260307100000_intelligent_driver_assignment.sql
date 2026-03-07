-- Migration: Intelligent driver assignment on order creation
-- Created: 2026-03-07
-- Description: Automatically assign available drivers to new orders

-- Function to assign available driver to new order
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
  IF NEW.status != 'pending' OR NEW.driver_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get customer's current location
  SELECT latitude, longitude INTO v_customer_lat, v_customer_lng
  FROM public.user_current_location
  WHERE user_id = NEW.user_id
  LIMIT 1;

  -- Find closest available driver
  -- Priority: 1) Available drivers, 2) Closest to customer, 3) Least active orders
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
    -- Prioritize drivers with location data
    CASE WHEN ucl.latitude IS NOT NULL THEN 0 ELSE 1 END,
    -- Then by distance (if customer location available)
    CASE 
      WHEN v_customer_lat IS NOT NULL AND v_customer_lng IS NOT NULL AND ucl.latitude IS NOT NULL THEN
        SQRT(
          POWER(ucl.latitude - v_customer_lat, 2) + 
          POWER(ucl.longitude - v_customer_lng, 2)
        )
      ELSE 999999
    END,
    -- Then by workload
    COALESCE(active_orders.active_count, 0),
    -- Random for fairness
    RANDOM()
  LIMIT 1;

  -- If driver found, assign and update status
  IF v_driver_id IS NOT NULL THEN
    NEW.driver_id := v_driver_id;
    NEW.status := 'confirmed';
    NEW.updated_at := NOW();
    
    -- Log assignment
    RAISE NOTICE 'Auto-assigned driver % to order %', v_driver_id, NEW.id;
  ELSE
    -- No driver available, keep pending
    RAISE NOTICE 'No available driver for order %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for automatic driver assignment
DROP TRIGGER IF EXISTS trigger_assign_driver_on_insert ON public.orders;
CREATE TRIGGER trigger_assign_driver_on_insert
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_available_driver();

-- Comment
COMMENT ON FUNCTION public.assign_available_driver() IS 'Automatically assigns closest available driver to new orders';
