-- Migration: Auto-assign driver to new orders
-- Created: 2026-03-08
-- Description: Automatically assign best available driver when order is created

-- ═══════════════════════════════════════════════════════════════
-- 1. Function to auto-assign driver
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.auto_assign_driver()
RETURNS TRIGGER AS $$
DECLARE
  best_driver_id UUID;
  client_lat DOUBLE PRECISION;
  client_lng DOUBLE PRECISION;
BEGIN
  -- Si déjà assigné, skip
  IF NEW.driver_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Récupérer localisation client
  client_lat := NEW.delivery_lat;
  client_lng := NEW.delivery_lng;
  
  -- Si pas de localisation, essayer user_current_location
  IF client_lat IS NULL OR client_lng IS NULL THEN
    SELECT latitude, longitude INTO client_lat, client_lng
    FROM public.user_current_location
    WHERE user_id = NEW.user_id
    LIMIT 1;
  END IF;
  
  -- Trouver meilleur livreur disponible
  SELECT p.id INTO best_driver_id
  FROM public.profiles p
  LEFT JOIN (
    -- Compter commandes actives par driver
    SELECT driver_id, COUNT(*) as active_count
    FROM public.orders
    WHERE status IN ('confirmed', 'processing', 'shipped', 'out_for_delivery')
      AND driver_id IS NOT NULL
    GROUP BY driver_id
  ) o ON o.driver_id = p.id
  LEFT JOIN LATERAL (
    -- Position récente du driver (<10 min)
    SELECT latitude, longitude, captured_at
    FROM public.driver_location_history
    WHERE driver_id = p.id
      AND captured_at > NOW() - INTERVAL '10 minutes'
    ORDER BY captured_at DESC
    LIMIT 1
  ) dl ON true
  WHERE p.role = 'driver'
    AND (p.is_available = true OR p.is_available IS NULL) -- Disponible
    AND dl.captured_at IS NOT NULL -- En ligne (position récente)
  ORDER BY 
    COALESCE(o.active_count, 0) ASC, -- Moins chargé en premier
    CASE 
      WHEN client_lat IS NOT NULL AND client_lng IS NOT NULL THEN
        public.calculate_distance(dl.latitude, dl.longitude, client_lat, client_lng)
      ELSE 999999 -- Si pas de localisation client, distance max
    END ASC -- Plus proche en premier
  LIMIT 1;
  
  -- Assigner si trouvé
  IF best_driver_id IS NOT NULL THEN
    NEW.driver_id := best_driver_id;
    -- Garder le statut tel quel (pending ou confirmed selon logique métier)
    RAISE NOTICE 'Auto-assigned driver % to order %', best_driver_id, NEW.id;
  ELSE
    RAISE NOTICE 'No available driver found for order %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- 2. Trigger on INSERT orders
-- ═══════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS trigger_auto_assign_driver ON public.orders;

CREATE TRIGGER trigger_auto_assign_driver
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_driver();

-- Comments
COMMENT ON FUNCTION public.auto_assign_driver IS 'Automatically assign best available driver to new orders based on: availability, online status, workload, and proximity to client';
COMMENT ON TRIGGER trigger_auto_assign_driver ON public.orders IS 'Auto-assign driver when new order is created';
