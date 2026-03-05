-- ============================================================
-- GBA — Seed Textile & Habillement (30 produits)
-- Idempotent : ON CONFLICT (slug) catégories, ON CONFLICT (sku) produits
-- UUIDs réels via gen_random_uuid()
-- Exécution : supabase db execute --file supabase/seeds/seed_textile.sql
-- ============================================================

DO $$
DECLARE
  v_cat UUID;
BEGIN
  RAISE NOTICE '[seed_textile] Insertion catégorie...';

  INSERT INTO public.categories (id, name, slug, description)
  VALUES (gen_random_uuid(), 'Textile & Habillement', 'textile-habillement',
          'Vêtements, chaussures, accessoires mode homme, femme, enfant')
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_cat FROM public.categories WHERE slug = 'textile-habillement';

  RAISE NOTICE '[seed_textile] category_id = %', v_cat;
  RAISE NOTICE '[seed_textile] Insertion des 30 produits...';

  INSERT INTO public.products
    (id, name, slug, sku, description, price, compare_at_price,
     quantity, category_id, brand, main_image, is_featured, is_active)
  VALUES
    (gen_random_uuid(),'Djellaba homme coton brodée','djellaba-homme-coton-brodee','SKU-TEXT-001',
     'Coton 100%, broderie artisanale, col mandarin, disponible en blanc, beige, gris',
     8500,11000,35,v_cat,'GBA Fashion',
     'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&q=80',true,true),

    (gen_random_uuid(),'Caftan femme soie naturelle','caftan-femme-soie','SKU-TEXT-002',
     'Soie naturelle 100%, broderie fil d''or, ceinture assortie, taille unique ajustable',
     22000,28000,15,v_cat,'Maison Fatima',
     'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80',true,true),

    (gen_random_uuid(),'T-shirt homme col rond coton bio','tshirt-homme-coton-bio','SKU-TEXT-003',
     'Coton biologique 180g/m², GOTS certifié, disponible S-XXXL, lavable 40°',
     3500,5000,100,v_cat,'EcoWear',
     'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80',false,true),

    (gen_random_uuid(),'Jean homme slim stretch','jean-homme-slim-stretch','SKU-TEXT-004',
     'Denim stretch 98% coton 2% élasthane, coupe slim, double coutures renforcées',
     6800,9000,60,v_cat,'DenimPro',
     'https://images.unsplash.com/photo-1542272489-3be3e7e7b60c?w=800&q=80',false,true),

    (gen_random_uuid(),'Robe femme lin estivale','robe-femme-lin-estivale','SKU-TEXT-005',
     'Lin 100%, robe midi, manches courtes, imprimé floral, légère et respirante',
     7500,10000,40,v_cat,'LinStyle',
     'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80',true,true),

    (gen_random_uuid(),'Polo homme piqué coton','polo-homme-piquet-coton','SKU-TEXT-006',
     'Piqué coton 220g/m², col classique, 3 boutons, bandes contrastées, S-XXL',
     4500,6500,70,v_cat,'PoloClub',
     'https://images.unsplash.com/photo-1625910611093-7e2f5f1e3f80?w=800&q=80',false,true),

    (gen_random_uuid(),'Veste homme tweed laine','veste-homme-tweed-laine','SKU-TEXT-007',
     'Laine tweed 70%, polyester 30%, doublure intérieure, 2 boutons, taille 46-54',
     18500,24000,20,v_cat,'TaileurBen',
     'https://images.unsplash.com/photo-1544441893-675173785526?w=800&q=80',false,true),

    (gen_random_uuid(),'Abaya femme crêpe luxe','abaya-femme-crepe-luxe','SKU-TEXT-008',
     'Crêpe lourd, coupe droite, broderie manchette, fermeture camouflée, noir/marine',
     12000,16000,30,v_cat,'Maison Fatima',
     'https://images.unsplash.com/photo-1569058019576-1c3a5cb57a0b?w=800&q=80',true,true),

    (gen_random_uuid(),'Pantalon chino homme stretch','pantalon-chino-homme-stretch','SKU-TEXT-009',
     'Coton stretch, coupe slim, 5 coloris disponibles, taille 38-52',
     5500,7500,55,v_cat,'ChicoStyle',
     'https://images.unsplash.com/photo-1624378515195-4ecaef4be8e2?w=800&q=80',false,true),

    (gen_random_uuid(),'Chemise homme oxford rayée','chemise-homme-oxford-rayee','SKU-TEXT-010',
     'Oxford coton 120g, col classique, rayures fines, repassage facile, S-XXL',
     5800,7800,45,v_cat,'OxfordMan',
     'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=800&q=80',false,true),

    (gen_random_uuid(),'Sneakers homme cuir Kappa','kappa-sneakers-cuir-homme','SKU-TEXT-011',
     'Cuir synthétique, semelle EVA, lacets plats, coloris blanc/noir, 40-46',
     9500,13000,35,v_cat,'Kappa',
     'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',true,true),

    (gen_random_uuid(),'Sandales femme cuir véritable','sandales-femme-cuir-veritable','SKU-TEXT-012',
     'Cuir véritable, semelle anatomique, bride ajustable, coloris naturel, 36-41',
     7800,11000,28,v_cat,'LeatherSoft',
     'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80',false,true),

    (gen_random_uuid(),'Babouches artisanales homme velours','babouches-homme-velours','SKU-TEXT-013',
     'Velours 100%, semelle cuir, broderie traditionnelle, tailles 40-45',
     4500,6500,40,v_cat,'Artisanat GBA',
     'https://images.unsplash.com/photo-1606293926075-69ed450a4444?w=800&q=80',true,true),

    (gen_random_uuid(),'Boots femme daim talon block','boots-femme-daim-talon-block','SKU-TEXT-014',
     'Daim synthétique, talon bloc 7 cm, fermeture éclair latérale, 36-40',
     11500,15000,22,v_cat,'BootStyle',
     'https://images.unsplash.com/photo-1548036161-b3d6a31aba86?w=800&q=80',false,true),

    (gen_random_uuid(),'Chaussures Oxford cuir pleine fleur','oxford-homme-cuir-pleine-fleur','SKU-TEXT-015',
     'Cuir pleine fleur, semelle cuir, bout fleuri, coloris marron/noir, 40-46',
     14500,18000,18,v_cat,'CorduroyBros',
     'https://images.unsplash.com/photo-1533867522753-0ed7c1a85042?w=800&q=80',false,true),

    (gen_random_uuid(),'Hijab soie satinée premium','hijab-soie-satinee-premium','SKU-TEXT-016',
     'Soie satinée 70×180 cm, anti-glisse, 15 coloris, emballage cadeau',
     3200,4500,80,v_cat,'SilkNoor',
     'https://images.unsplash.com/photo-1594938298603-61bb45f04b55?w=800&q=80',false,true),

    (gen_random_uuid(),'Ceinture homme cuir tressé 35mm','ceinture-homme-cuir-tresse','SKU-TEXT-017',
     'Cuir véritable tressé, boucle dorée/argentée, tailles 90-120 cm',
     4200,5800,50,v_cat,'BeltMaestro',
     'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=80',false,true),

    (gen_random_uuid(),'Sac à main femme simili luxe','sac-main-femme-simili-luxe','SKU-TEXT-018',
     'Simili cuir texturé, bandoulière réglable, double compartiment, 28×18×10 cm',
     8800,12000,25,v_cat,'BagLux',
     'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=80',true,true),

    (gen_random_uuid(),'Écharpe laine cachemire mixte','echarpe-laine-cachemire','SKU-TEXT-019',
     'Laine 60% cachemire 40%, 70×190 cm, franges, coloris naturels',
     6500,9000,30,v_cat,'WoolSoft',
     'https://images.unsplash.com/photo-1545442441-a99543b2394d?w=800&q=80',false,true),

    (gen_random_uuid(),'Pyjama homme coton flanelle','pyjama-homme-flanelle','SKU-TEXT-020',
     'Flanelle coton 100%, veste boutonnée + pantalon, tailles S-XXL, 3 coloris',
     5200,7200,40,v_cat,'ComfortNight',
     'https://images.unsplash.com/photo-1631679706909-1bb13a1e51b0?w=800&q=80',false,true),

    (gen_random_uuid(),'Sous-vêtements homme pack ×5','sous-vetements-homme-pack5','SKU-TEXT-021',
     'Coton élasthane 95/5%, coupe classique, pack 5 slips, tailles S-XXXL',
     3800,5500,60,v_cat,'InnerComfort',
     'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80',false,true),

    (gen_random_uuid(),'Robe enfant fille 2-8 ans','robe-enfant-fille-2-8ans','SKU-TEXT-022',
     'Coton 100%, broderie fleurs, nœud dos, lavable machine, tailles 2-8 ans',
     3200,4500,50,v_cat,'KidsJoy',
     'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6d8?w=800&q=80',false,true),

    (gen_random_uuid(),'Ensemble survêtement garçon 6-14 ans','ensemble-survet-garcon','SKU-TEXT-023',
     'Polyester recyclé, veste zippée + pantalon, bande latérale, 6-14 ans',
     4800,6500,40,v_cat,'SportKid',
     'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=800&q=80',false,true),

    (gen_random_uuid(),'Blouson bombers homme satin','blouson-bombers-homme-satin','SKU-TEXT-024',
     'Satin polyester, doublure côtes tricoté, fermeture éclair, tailles S-XXL',
     8500,12000,22,v_cat,'UrbanWear',
     'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80',true,true),

    (gen_random_uuid(),'Costume homme 2 pièces slim','costume-homme-2pieces-slim','SKU-TEXT-025',
     'Polyester/viscose, coupe slim, 2 boutons, doublure, disponible 46-56',
     32000,42000,12,v_cat,'TaileurBen',
     'https://images.unsplash.com/photo-1509631928351-0cc8dbbf74ae?w=800&q=80',true,true),

    (gen_random_uuid(),'Manteau femme laine double face','manteau-femme-laine-double-face','SKU-TEXT-026',
     'Laine double face 85%, coupe droite, boutons discrets, coloris camel/noir',
     24000,32000,10,v_cat,'Maison Fatima',
     'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&q=80',true,true),

    (gen_random_uuid(),'Short de bain homme boardshort','short-bain-homme-boardshort','SKU-TEXT-027',
     'Polyester quick-dry, imperméable, ficelle intérieure, imprimé surf, S-XXL',
     3800,5500,55,v_cat,'BeachPro',
     'https://images.unsplash.com/photo-1564514279-af22ee02b5b8?w=800&q=80',false,true),

    (gen_random_uuid(),'Lunettes de soleil polarisées UV400','lunettes-soleil-polarisees-uv400','SKU-TEXT-028',
     'Verres polarisés UV400, monture acétate légère, étui rigide + chiffon inclus',
     6500,9000,35,v_cat,'OptiSol',
     'https://images.unsplash.com/photo-1574258495973-c5e4d3c33b2e?w=800&q=80',false,true),

    (gen_random_uuid(),'Gants cuir conduite homme','gants-cuir-conduite-homme','SKU-TEXT-029',
     'Cuir véritable, doublure soie, coutures sellier, tailles S-XL',
     5800,7800,20,v_cat,'GloveArt',
     'https://images.unsplash.com/photo-1585338832735-e1ab93e5f1c0?w=800&q=80',false,true),

    (gen_random_uuid(),'Chapeau fedora feutre laine','chapeau-fedora-feutre-laine','SKU-TEXT-030',
     'Feutre laine 100%, bandeau gros grain, taille universelle 57-59 cm',
     4200,6000,25,v_cat,'HatMaison',
     'https://images.unsplash.com/photo-1521369909-c49c9f32c8d1?w=800&q=80',false,true)

  ON CONFLICT (sku) DO UPDATE SET
    main_image       = EXCLUDED.main_image,
    price            = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price,
    quantity         = EXCLUDED.quantity,
    name             = EXCLUDED.name,
    updated_at       = NOW();

  RAISE NOTICE '[seed_textile] ✅ 30 produits Textile & Habillement insérés/mis à jour.';
END $$;
