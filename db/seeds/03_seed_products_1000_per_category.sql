-- Assurer les catégories de base si elles n'existent pas
insert into public.categories (name, slug, description, display_order, is_active)
values
  ('Électronique', 'electronique', 'Téléphones, ordinateurs, accessoires', 1, true),
  ('Casques Audio', 'casques-audio', 'Casques, écouteurs, enceintes', 2, true),
  ('Mode', 'mode', 'Vêtements, chaussures, accessoires', 3, true)
on conflict (slug) do nothing;

with
categories as (
  select id, name, slug
  from public.categories
  where is_active = true
),
series as (
  select generate_series(1, 1000) as i
),
base as (
  select
    c.id as category_id,
    c.name as category_name,
    c.slug as category_slug,
    s.i as n,
    format('SEED-%s-%s', upper(replace(c.slug, ' ', '')), lpad(s.i::text, 4, '0')) as sku,
    case c.slug
      when 'electronique' then
        (array['Smartphone Android','Ordinateur Portable','Tablette','Télévision 4K','Console de Jeu','Appareil Photo','Smartwatch','Enceinte Bluetooth','Routeur WiFi','Clé USB'])[1 + (abs(hashtext('type-' || c.slug || s.i::text)::bigint) % 10)]
      when 'casques-audio' then
        (array['Casque Bluetooth','Écouteurs In-ear','Enceinte Portative','Casque Gaming','Barre de Son','Écouteurs True Wireless','Casque Hi-Fi','Enceinte Connectée','Micro Casque','Casque Sport'])[1 + (abs(hashtext('type-' || c.slug || s.i::text)::bigint) % 10)]
      else 'Produit Générique'
    end as product_type,
    case c.slug
      when 'electronique' then
        (array['Apple','Samsung','Xiaomi','Huawei','Sony','LG','Lenovo','HP','Dell','Asus'])[1 + (abs(hashtext('brand-' || c.slug || s.i::text)::bigint) % 10)]
      when 'casques-audio' then
        (array['Sony','Bose','JBL','Sennheiser','Beats','Audio-Technica','Marshall','Bang & Olufsen','Sennheiser','AKG'])[1 + (abs(hashtext('brand-' || c.slug || s.i::text)::bigint) % 10)]
      else
        (array['Generic','PremiumCo','BestChoice','ProLine','EcoBrand','UrbanStyle','HomePlus','TopValue'])[1 + (abs(hashtext('brand-' || c.slug || s.i::text)::bigint) % 8)]
    end as brand_name
  from categories c
  cross join series s
)
insert into public.products (
  name,
  slug,
  description,
  price,
  compare_at_price,
  sku,
  quantity,
  track_quantity,
  category_id,
  brand,
  main_image,
  images,
  specifications,
  tags,
  rating,
  reviews_count,
  is_featured,
  is_active
)
select
  format('%s %s - Modèle %s', b.brand_name, b.product_type, b.n) as name,
  format('%s-%s-modele-%s', lower(replace(b.brand_name, ' ', '-')), lower(replace(b.product_type, ' ', '-')), b.n) as slug,
  format('Produit de qualité %s %s de la catégorie %s', b.brand_name, b.product_type, b.category_name) as description,
  (5000 + (abs(hashtext(b.sku)::bigint) % 1495000))::numeric(12,2) as price,
  round(
    ((5000 + (abs(hashtext(b.sku)::bigint) % 1495000))::numeric) *
    (1 + ((5 + (abs(hashtext('cmp-' || b.sku)::bigint) % 26))::numeric / 100)),
    2
  ) as compare_at_price,
  b.sku,
  (abs(hashtext('qty-' || b.sku)::bigint) % 250)::int as quantity,
  true as track_quantity,
  b.category_id,
  b.brand_name as brand,
  format('https://picsum.photos/seed/%s/800/800', b.sku) as main_image,
  array[
    format('https://picsum.photos/seed/%s-a/800/800', b.sku),
    format('https://picsum.photos/seed/%s-b/800/800', b.sku)
  ] as images,
  jsonb_build_object(
    'seed', true,
    'category_slug', b.category_slug,
    'index', b.n,
    'product_type', b.product_type,
    'weight_kg', round(((abs(hashtext('w-' || b.sku)::bigint) % 5000) / 1000.0)::numeric, 3),
    'color', (array['noir','blanc','bleu','rouge','vert','argent','or'])[1 + (abs(hashtext('color-' || b.sku)::bigint) % 7)]
  ) as specifications,
  array[
    b.category_slug,
    'seed',
    lower(replace(b.product_type, ' ', '-')),
    (array['promo','nouveau','best-seller','premium','eco'])[1 + (abs(hashtext('tag-' || b.sku)::bigint) % 5)]
  ] as tags,
  (3.5 + ((abs(hashtext('rating-' || b.sku)::bigint) % 150)::double precision / 100.0)) as rating,
  (abs(hashtext('reviews-' || b.sku)::bigint) % 500)::int as reviews_count,
  ((abs(hashtext('featured-' || b.sku)::bigint) % 20) = 0) as is_featured,
  true as is_active
from base b
on conflict (sku) do nothing;
