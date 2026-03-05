-- ============================================================
-- GBA — Seed Électronique (30 produits)
-- Idempotent : ON CONFLICT (slug) pour catégories, ON CONFLICT (sku) pour produits
-- UUIDs réels via gen_random_uuid()
-- Exécution : supabase db execute --file supabase/seeds/seed_electronique.sql
-- ============================================================

DO $$
DECLARE
  v_cat UUID;
BEGIN
  RAISE NOTICE '[seed_electronique] Début insertion catégorie...';

  -- Catégorie Électronique
  INSERT INTO public.categories (id, name, slug, description)
  VALUES (gen_random_uuid(), 'Électronique', 'electronique',
          'Smartphones, téléviseurs, audio et accessoires électroniques')
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_cat FROM public.categories WHERE slug = 'electronique';

  RAISE NOTICE '[seed_electronique] category_id = %', v_cat;
  RAISE NOTICE '[seed_electronique] Insertion des 30 produits...';

  INSERT INTO public.products
    (id, name, slug, sku, description, price, compare_at_price,
     quantity, category_id, brand, main_image, is_featured, is_active)
  VALUES
    (gen_random_uuid(),'Smartphone Samsung Galaxy A54 5G','samsung-galaxy-a54-5g','SKU-ELEC-001',
     'Écran Super AMOLED 6.4", 128 Go, caméra 50 MP, batterie 5000 mAh',
     185000,210000,25,v_cat,'Samsung',
     'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80',true,true),

    (gen_random_uuid(),'Smartphone Tecno Camon 20','tecno-camon-20','SKU-ELEC-002',
     'Écran 6.67" FHD+, 256 Go, caméra 64 MP, batterie 5000 mAh',
     89000,105000,40,v_cat,'Tecno',
     'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&q=80',false,true),

    (gen_random_uuid(),'Smartphone Infinix Hot 30','infinix-hot-30','SKU-ELEC-003',
     'Écran 6.78" HD+, 128 Go, batterie 5000 mAh, charge rapide 18W',
     65000,78000,50,v_cat,'Infinix',
     'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&q=80',false,true),

    (gen_random_uuid(),'Téléviseur Samsung 43" 4K UHD','samsung-tv-43-4k','SKU-ELEC-004',
     'Résolution 4K UHD, Smart TV, WiFi, HDR10, Dolby Digital',
     145000,165000,15,v_cat,'Samsung',
     'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=80',true,true),

    (gen_random_uuid(),'Téléviseur Hisense 32" HD','hisense-tv-32-hd','SKU-ELEC-005',
     'Résolution HD Ready, Smart TV Android, 2 ports HDMI',
     68000,80000,20,v_cat,'Hisense',
     'https://images.unsplash.com/photo-1461151304267-38535e780c79?w=800&q=80',false,true),

    (gen_random_uuid(),'Téléviseur LG 55" OLED 4K','lg-oled-55-4k','SKU-ELEC-006',
     'Dalle OLED, 4K, Dolby Vision IQ, Processeur α9 Gen6',
     420000,480000,8,v_cat,'LG',
     'https://images.unsplash.com/photo-1601944179066-29786cb9d1e9?w=800&q=80',true,true),

    (gen_random_uuid(),'Tablette Samsung Galaxy Tab A8','samsung-tab-a8','SKU-ELEC-007',
     'Écran 10.5" TFT, 64 Go, WiFi, batterie 7040 mAh',
     98000,115000,18,v_cat,'Samsung',
     'https://images.unsplash.com/photo-1561154464-82e9adf32764?w=800&q=80',false,true),

    (gen_random_uuid(),'Écouteurs Bluetooth JBL Tune 520BT','jbl-tune-520bt','SKU-ELEC-008',
     'Pure Bass Sound, 57h autonomie, pliable, multipoint',
     22000,28000,60,v_cat,'JBL',
     'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',true,true),

    (gen_random_uuid(),'Casque Sony WH-1000XM5','sony-wh1000xm5','SKU-ELEC-009',
     'ANC leader du marché, 30h autonomie, son 360 Reality Audio',
     185000,220000,10,v_cat,'Sony',
     'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&q=80',true,true),

    (gen_random_uuid(),'Enceinte Bluetooth JBL Charge 5','jbl-charge-5','SKU-ELEC-010',
     'IP67, 20h autonomie, powerbank intégré, son 360°',
     58000,68000,30,v_cat,'JBL',
     'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&q=80',false,true),

    (gen_random_uuid(),'Chargeur rapide 65W GaN Type-C','chargeur-65w-gan','SKU-ELEC-011',
     'GaN III, 3 ports (2×USB-C + USB-A), compact, universel',
     8500,12000,100,v_cat,'Baseus',
     'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',false,true),

    (gen_random_uuid(),'Câble USB-C 100W 2m tressé','cable-usbc-100w-2m','SKU-ELEC-012',
     '100W Power Delivery, data 10 Gbps, nylon tressé',
     3500,5000,200,v_cat,'Anker',
     'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80',false,true),

    (gen_random_uuid(),'Batterie externe 20000 mAh Anker','anker-powercore-20000','SKU-ELEC-013',
     '22.5W, 2 USB-A + 1 USB-C, LED indicateur, voyage',
     22000,28000,45,v_cat,'Anker',
     'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800&q=80',true,true),

    (gen_random_uuid(),'Caméra de surveillance IP WiFi','camera-surveillance-ip-wifi','SKU-ELEC-014',
     '1080p, vision nocturne, détection mouvement, micro SD',
     18500,24000,35,v_cat,'Xiaomi',
     'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80',false,true),

    (gen_random_uuid(),'Clé USB 64 Go USB 3.0','cle-usb-64go-usb3','SKU-ELEC-015',
     'Vitesse lecture 100 Mo/s, compatible PC/Mac/TV',
     4500,6000,150,v_cat,'SanDisk',
     'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?w=800&q=80',false,true),

    (gen_random_uuid(),'Disque dur externe 1 To USB 3.0','disque-dur-1to-usb3','SKU-ELEC-016',
     '1 To, USB 3.0, compatible PC/Mac/Xbox/PS5, slim',
     28000,35000,25,v_cat,'WD',
     'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',false,true),

    (gen_random_uuid(),'Routeur WiFi 6 TP-Link AX1800','tplink-ax1800-wifi6','SKU-ELEC-017',
     'WiFi 6, 1800 Mbps, 4 antennes, MU-MIMO, OFDMA',
     45000,55000,20,v_cat,'TP-Link',
     'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&q=80',true,true),

    (gen_random_uuid(),'Montre connectée Samsung Galaxy Watch 6','samsung-galaxy-watch6','SKU-ELEC-018',
     'BioActive Sensor, suivi santé, GPS, 40 mm, batterie 300 mAh',
     135000,155000,12,v_cat,'Samsung',
     'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',true,true),

    (gen_random_uuid(),'Smartphone iPhone 14 128 Go','iphone-14-128go','SKU-ELEC-019',
     'Puce A15 Bionic, écran 6.1" Super Retina XDR, iOS 16',
     485000,550000,6,v_cat,'Apple',
     'https://images.unsplash.com/photo-1603891128711-11b4b03bb138?w=800&q=80',true,true),

    (gen_random_uuid(),'Clavier Bluetooth Logitech MX Keys','logitech-mx-keys','SKU-ELEC-020',
     'Rétroéclairé, multi-devices (3), frappe précise, USB-C',
     52000,62000,15,v_cat,'Logitech',
     'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',false,true),

    (gen_random_uuid(),'Souris sans fil Logitech MX Master 3','logitech-mx-master-3','SKU-ELEC-021',
     'MagSpeed 70 jours autonomie, USB-C, 7 boutons',
     58000,70000,15,v_cat,'Logitech',
     'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80',false,true),

    (gen_random_uuid(),'Écran PC 24" Full HD IPS','ecran-24-fullhd-ips','SKU-ELEC-022',
     '24" IPS, 1920×1080, 75 Hz, HDMI+VGA, anti-reflet',
     72000,88000,12,v_cat,'Dell',
     'https://images.unsplash.com/photo-1585792180666-f7347c490ee2?w=800&q=80',false,true),

    (gen_random_uuid(),'Webcam Full HD 1080p Logitech C920','logitech-c920-1080p','SKU-ELEC-023',
     '1080p/30fps, autofocus, double microphone stéréo, USB',
     28000,34000,20,v_cat,'Logitech',
     'https://images.unsplash.com/photo-1563298723-dcfebaa392e3?w=800&q=80',false,true),

    (gen_random_uuid(),'Drone DJI Mini 3 Pro','dji-mini-3-pro','SKU-ELEC-024',
     '4K/60fps, 3 axes, 34 min vol, détection obstacles',
     385000,440000,4,v_cat,'DJI',
     'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=800&q=80',true,true),

    (gen_random_uuid(),'Console Nintendo Switch OLED','nintendo-switch-oled','SKU-ELEC-025',
     'Écran OLED 7", stockage 64 Go, modes TV/tablette/portable',
     185000,210000,8,v_cat,'Nintendo',
     'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=800&q=80',true,true),

    (gen_random_uuid(),'SSD Portable Samsung T7 500 Go','samsung-t7-500go','SKU-ELEC-026',
     'USB 3.2 Gen2, 1050 Mo/s, IP55, compact',
     38000,48000,22,v_cat,'Samsung',
     'https://images.unsplash.com/photo-1541752171745-8d46f9627e33?w=800&q=80',false,true),

    (gen_random_uuid(),'Barre de son Samsung HW-Q60B','samsung-hw-q60b','SKU-ELEC-027',
     '3.1 canaux, 340W, Dolby Atmos, DTS:X, WiFi/Bluetooth',
     125000,148000,9,v_cat,'Samsung',
     'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&q=80',false,true),

    (gen_random_uuid(),'Lampe de bureau LED rechargeable','lampe-bureau-led-rechargeable','SKU-ELEC-028',
     '3 températures, 10 niveaux luminosité, port USB, pliable',
     12500,16000,50,v_cat,'Baseus',
     'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=800&q=80',false,true),

    (gen_random_uuid(),'Hub USB-C 7-en-1 multiport','hub-usbc-7en1','SKU-ELEC-029',
     'HDMI 4K, 3×USB-A, SD/microSD, 100W PD, aluminium',
     15500,20000,40,v_cat,'Anker',
     'https://images.unsplash.com/photo-1588417747253-d06d43e50b70?w=800&q=80',false,true),

    (gen_random_uuid(),'Imprimante HP LaserJet Pro M404n','hp-laserjet-pro-m404n','SKU-ELEC-030',
     '40 ppm, Ethernet, USB, duplexeur auto, 1200 dpi',
     145000,170000,7,v_cat,'HP',
     'https://images.unsplash.com/photo-1585011650347-c59dbef5a823?w=800&q=80',false,true)

  ON CONFLICT (sku) DO UPDATE SET
    main_image      = EXCLUDED.main_image,
    price           = EXCLUDED.price,
    compare_at_price= EXCLUDED.compare_at_price,
    quantity        = EXCLUDED.quantity,
    name            = EXCLUDED.name,
    updated_at      = NOW();

  RAISE NOTICE '[seed_electronique] ✅ 30 produits Électronique insérés/mis à jour.';
END $$;
