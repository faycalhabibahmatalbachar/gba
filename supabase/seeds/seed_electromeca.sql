-- ============================================================
-- GBA — Seed Électromécanique & Électroménager (30 produits)
-- Idempotent : ON CONFLICT (slug) catégories, ON CONFLICT (sku) produits
-- UUIDs réels via gen_random_uuid()
-- Exécution : supabase db execute --file supabase/seeds/seed_electromeca.sql
-- ============================================================

DO $$
DECLARE
  v_elec UUID;
  v_mena UUID;
BEGIN
  RAISE NOTICE '[seed_electromeca] Insertion catégories...';

  INSERT INTO public.categories (id, name, slug, description)
  VALUES (gen_random_uuid(), 'Électromécanique', 'electromecanique',
          'Moteurs, pompes, outils électriques, équipements industriels')
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO public.categories (id, name, slug, description)
  VALUES (gen_random_uuid(), 'Électroménager', 'electromenager',
          'Climatiseurs, réfrigérateurs, machines à laver et petits appareils')
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_elec FROM public.categories WHERE slug = 'electromecanique';
  SELECT id INTO v_mena FROM public.categories WHERE slug = 'electromenager';

  RAISE NOTICE '[seed_electromeca] cat electromecanique=%, electromenager=%', v_elec, v_mena;
  RAISE NOTICE '[seed_electromeca] Insertion des 30 produits...';

  INSERT INTO public.products
    (id, name, slug, sku, description, price, compare_at_price,
     quantity, category_id, brand, main_image, is_featured, is_active)
  VALUES
    (gen_random_uuid(),'Climatiseur Gree 1.5 CV Split','gree-clim-15cv-split','SKU-EMEC-001',
     '12000 BTU, Inverter, R32, Wi-Fi, filtre anti-bactérien',
     145000,165000,12,v_mena,'Gree',
     'https://images.unsplash.com/photo-1631545806609-3d0e84d78b58?w=800&q=80',true,true),

    (gen_random_uuid(),'Climatiseur Midea 2 CV Inverter','midea-clim-2cv-inverter','SKU-EMEC-002',
     '18000 BTU, Inverter A++, WiFi, mode turbo, dégivrage auto',
     185000,210000,8,v_mena,'Midea',
     'https://images.unsplash.com/photo-1582744187451-8c01ef16b50c?w=800&q=80',true,true),

    (gen_random_uuid(),'Réfrigérateur Samsung No Frost 430 L','samsung-frigo-430l-nofrost','SKU-EMEC-003',
     '430 L, No Frost, Twin Cooling Plus, A+, 6ème sens',
     195000,228000,7,v_mena,'Samsung',
     'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&q=80',true,true),

    (gen_random_uuid(),'Réfrigérateur Hisense 3 portes 550 L','hisense-frigo-3portes-550l','SKU-EMEC-004',
     '550 L, Total No Frost, distributeur eau, A++',
     245000,285000,5,v_mena,'Hisense',
     'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',false,true),

    (gen_random_uuid(),'Machine à laver LG 8 kg ThinQ','lg-lave-linge-8kg-thinq','SKU-EMEC-005',
     '8 kg, AI DD, Vapeur, 1400 tr/min, WiFi, A+++',
     165000,195000,10,v_mena,'LG',
     'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=800&q=80',true,true),

    (gen_random_uuid(),'Machine à laver Haier 6 kg Top','haier-lave-linge-6kg-top','SKU-EMEC-006',
     '6 kg, chargement dessus, 700 tr/min, 12 programmes',
     82000,98000,15,v_mena,'Haier',
     'https://images.unsplash.com/photo-1560185007-cde3b8558f16?w=800&q=80',false,true),

    (gen_random_uuid(),'Four micro-ondes Samsung 23 L Grill','samsung-micro-ondes-23l','SKU-EMEC-007',
     '23 L, 800W, grill, 5 niveaux de puissance, minuterie',
     32000,40000,25,v_mena,'Samsung',
     'https://images.unsplash.com/photo-1565452344991-e879acfab065?w=800&q=80',false,true),

    (gen_random_uuid(),'Mixeur Blender Philips 2L 1200W','philips-blender-2l-1200w','SKU-EMEC-008',
     '2 L, 1200 W, jar verre, 3 vitesses + pulse, auto-clean',
     28000,35000,30,v_mena,'Philips',
     'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=800&q=80',false,true),

    (gen_random_uuid(),'Pompe submersible 0.5 CV Pedrollo','pedrollo-pompe-05cv','SKU-EMEC-009',
     '0.5 CV, 3600 L/h, profondeur max 8 m, inox',
     48000,58000,18,v_elec,'Pedrollo',
     'https://images.unsplash.com/photo-1558002242-5e3e0ff8f9b4?w=800&q=80',false,true),

    (gen_random_uuid(),'Pompe de surface 1 CV Grundfos','grundfos-pompe-surface-1cv','SKU-EMEC-010',
     '1 CV, 4800 L/h, moteur inox, filtre intégré, 230V',
     75000,90000,12,v_elec,'Grundfos',
     'https://images.unsplash.com/photo-1564844536702-1f23b0d0c4e9?w=800&q=80',true,true),

    (gen_random_uuid(),'Perceuse-visseuse Bosch 18V 5Ah','bosch-perceuse-18v-5ah','SKU-EMEC-011',
     '18V brushless, couple 65 Nm, 2 batteries 5Ah, coffret',
     88000,105000,14,v_elec,'Bosch',
     'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80',true,true),

    (gen_random_uuid(),'Meuleuse d''angle Makita 125mm 1200W','makita-meuleuse-125mm','SKU-EMEC-012',
     '1200W, 11000 tr/min, démarrage progressif, anti-vibration',
     38000,47000,20,v_elec,'Makita',
     'https://images.unsplash.com/photo-1571919799986-50e8cdb1e9a3?w=800&q=80',false,true),

    (gen_random_uuid(),'Perforateur Bosch GBH 2-26 800W','bosch-gbh-226-perforateur','SKU-EMEC-013',
     '800W, 2.7 J, SDS-Plus, 3 modes, vibration réduite',
     62000,75000,10,v_elec,'Bosch',
     'https://images.unsplash.com/photo-1510001618816-5d8e2d1edca6?w=800&q=80',false,true),

    (gen_random_uuid(),'Scie sauteuse Dewalt 701W DCS331','dewalt-scie-sauteuse-701w','SKU-EMEC-014',
     '701W, 3100 cps/min, pendulaire, anti-vibration, lumière LED',
     45000,55000,12,v_elec,'Dewalt',
     'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80',false,true),

    (gen_random_uuid(),'Groupe électrogène Powermate 3.5 kVA','powermate-groupe-35kva','SKU-EMEC-015',
     '3.5 kVA, essence, 4 temps, démarrage manuel, 2×220V',
     165000,190000,6,v_elec,'Powermate',
     'https://images.unsplash.com/photo-1565372195458-9de0b320ef04?w=800&q=80',true,true),

    (gen_random_uuid(),'Onduleur APC Back-UPS 1200VA','apc-backups-1200va','SKU-EMEC-016',
     '1200VA/720W, 8 prises protégées, AVR, USB, LCD',
     85000,98000,15,v_elec,'APC',
     'https://images.unsplash.com/photo-1558002242-5e3e0ff8f9b4?w=800&q=80',false,true),

    (gen_random_uuid(),'Panneau solaire 200W monocristallin','panneau-solaire-200w-mono','SKU-EMEC-017',
     '200W, monocristallin, rendement 21%, IP68, cadre alu',
     55000,68000,20,v_elec,'GreenPower',
     'https://images.unsplash.com/photo-1509391366636-b1ef13756122?w=800&q=80',true,true),

    (gen_random_uuid(),'Batterie solaire 200Ah AGM','batterie-solaire-200ah-agm','SKU-EMEC-018',
     '200Ah, 12V, AGM, décharge profonde, 800 cycles',
     95000,115000,10,v_elec,'Vision',
     'https://images.unsplash.com/photo-1620714223084-8fcacc2107c1?w=800&q=80',false,true),

    (gen_random_uuid(),'Régulateur solaire MPPT 40A','regulateur-solaire-mppt-40a','SKU-EMEC-019',
     '40A, MPPT, 12/24/36/48V auto, écran LCD, USB',
     22000,28000,25,v_elec,'Victron',
     'https://images.unsplash.com/photo-1508514177221-188b1707b983?w=800&q=80',false,true),

    (gen_random_uuid(),'Ventilateur industriel 18" 200W','ventilateur-industriel-18-200w','SKU-EMEC-020',
     '18", 200W, 3 vitesses, grille métallique, oscillant',
     18500,24000,30,v_mena,'Ventex',
     'https://images.unsplash.com/photo-1585771724684-38798b570e6a?w=800&q=80',false,true),

    (gen_random_uuid(),'Disjoncteur différentiel 63A 30mA','disjoncteur-diff-63a-30ma','SKU-EMEC-021',
     '63A, 30mA, Type AC, 2 pôles, classe A, certifié IEC',
     8500,11000,50,v_elec,'Schneider',
     'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&q=80',false,true),

    (gen_random_uuid(),'Tableau électrique 12 modules','tableau-elec-12-modules','SKU-EMEC-022',
     '12 modules, IP40, fixation murale, certifié CE',
     12000,15000,30,v_elec,'Schneider',
     'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',false,true),

    (gen_random_uuid(),'Compresseur d''air 50L 1.5 CV','compresseur-air-50l-15cv','SKU-EMEC-023',
     '50L, 1.5 CV, 8 bar, 180 L/min, manomètre double',
     78000,95000,8,v_elec,'Abac',
     'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&q=80',true,true),

    (gen_random_uuid(),'Câble électrique 2.5mm² 100m','cable-elec-25mm2-100m','SKU-EMEC-024',
     'Fil rigide H07VR, 2.5mm², 100m, cuivre nu, norme NF',
     28000,35000,20,v_elec,'Nexans',
     'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',false,true),

    (gen_random_uuid(),'Fer à souder à étain 60W','fer-soudure-60w','SKU-EMEC-025',
     '60W, 480°C max, pointe céramique, cordon caoutchouc',
     5500,7500,60,v_elec,'Weller',
     'https://images.unsplash.com/photo-1559827292-4e4ff4c8f6e2?w=800&q=80',false,true),

    (gen_random_uuid(),'Aspirateur balai Dyson V10 Absolute','dyson-v10-absolute','SKU-EMEC-026',
     'Sans sac, 126000 tr/min, 60 min, HEPA, convertible',
     285000,330000,5,v_mena,'Dyson',
     'https://images.unsplash.com/photo-1558317374-6ad945be12c9?w=800&q=80',true,true),

    (gen_random_uuid(),'Chauffe-eau électrique 80L vertical','chauffe-eau-elec-80l','SKU-EMEC-027',
     '80L, 2000W, vertical, résistance blindée, thermostat',
     55000,68000,12,v_mena,'Atlantic',
     'https://images.unsplash.com/photo-1555041469-db61d43c5df4?w=800&q=80',false,true),

    (gen_random_uuid(),'Robot aspirateur Xiaomi S10+','xiaomi-robot-aspirateur-s10','SKU-EMEC-028',
     'Lidar 3D, 4000 Pa, lavage auto-vidangeant, mappage multi-pièces',
     195000,228000,6,v_mena,'Xiaomi',
     'https://images.unsplash.com/photo-1599839575945-f43c14d21ea7?w=800&q=80',true,true),

    (gen_random_uuid(),'Moteur électrique triphasé 2.2 kW','moteur-elec-triphase-22kw','SKU-EMEC-029',
     '2.2 kW, 220/380V, 1450 tr/min, IE2, carcasse alu, classe F',
     48000,60000,10,v_elec,'WEG',
     'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&q=80',false,true),

    (gen_random_uuid(),'Variateur de fréquence 2.2 kW VFD','variateur-freq-22kw-vfd','SKU-EMEC-030',
     '2.2 kW, entrée 220V mono/triphasé, RS485 Modbus, IP20',
     38000,48000,10,v_elec,'Delta',
     'https://images.unsplash.com/photo-1558002242-5e3e0ff8f9b4?w=800&q=80',false,true)

  ON CONFLICT (sku) DO UPDATE SET
    main_image       = EXCLUDED.main_image,
    price            = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price,
    quantity         = EXCLUDED.quantity,
    name             = EXCLUDED.name,
    updated_at       = NOW();

  RAISE NOTICE '[seed_electromeca] ✅ 30 produits Électromécanique/Électroménager insérés/mis à jour.';
END $$;
