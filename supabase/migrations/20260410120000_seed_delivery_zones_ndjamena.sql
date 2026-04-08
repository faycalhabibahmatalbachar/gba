-- Zones de démo N'Djamena + positions récentes pour livreurs actifs (données de test)
INSERT INTO public.delivery_zones (name, color, geojson, is_active)
SELECT 'Centre-ville N''Djamena', '#6C47FF',
  '{"type":"Polygon","coordinates":[[[15.030,12.095],[15.070,12.095],[15.070,12.120],[15.030,12.120],[15.030,12.095]]]}'::jsonb,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_zones WHERE name = 'Centre-ville N''Djamena');

INSERT INTO public.delivery_zones (name, color, geojson, is_active)
SELECT 'Quartier Moursal', '#00D4AA',
  '{"type":"Polygon","coordinates":[[[15.040,12.110],[15.080,12.110],[15.080,12.140],[15.040,12.140],[15.040,12.110]]]}'::jsonb,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_zones WHERE name = 'Quartier Moursal');

-- Position à jour par livreur (upsert : contrainte UNIQUE sur driver_id)
INSERT INTO public.driver_locations (driver_id, lat, lng, captured_at, recorded_at, speed_mps, heading, battery_level, is_moving)
SELECT d.user_id,
  12.1048 + (random() - 0.5) * 0.05,
  15.0445 + (random() - 0.5) * 0.05,
  now(),
  now(),
  6 + random() * 10,
  random() * 360,
  60 + (random() * 40)::int,
  true
FROM public.drivers d
WHERE d.is_active = true
  AND d.user_id IS NOT NULL
ON CONFLICT (driver_id) DO UPDATE SET
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  captured_at = EXCLUDED.captured_at,
  recorded_at = EXCLUDED.recorded_at,
  speed_mps = EXCLUDED.speed_mps,
  heading = EXCLUDED.heading,
  battery_level = EXCLUDED.battery_level,
  is_moving = EXCLUDED.is_moving;

NOTIFY pgrst, 'reload schema';
