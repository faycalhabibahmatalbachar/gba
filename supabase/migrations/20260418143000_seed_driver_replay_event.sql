-- Seed de test replay : insère un point GPS récent pour un livreur actif (si présent).
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT d.user_id INTO v_uid
  FROM public.drivers d
  WHERE d.is_active = true
    AND d.user_id IS NOT NULL
  ORDER BY d.updated_at DESC NULLS LAST, d.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_uid IS NOT NULL THEN
    INSERT INTO public.driver_locations (
      driver_id,
      lat,
      lng,
      captured_at,
      recorded_at,
      speed_mps,
      heading,
      battery_level,
      is_moving
    )
    VALUES (
      v_uid,
      12.1175,
      15.0530,
      now(),
      now(),
      3.2,
      95,
      87,
      true
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

