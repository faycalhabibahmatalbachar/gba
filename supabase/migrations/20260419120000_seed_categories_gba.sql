-- Catégories racines + sous-catégories (idempotent, slug unique)
INSERT INTO public.categories (name, slug, description, is_active, sort_order, parent_id)
VALUES
  ('Alimentation & boissons', 'alimentation-boissons', 'Épicerie, frais, boissons', true, 10, NULL),
  ('Maison & quotidien', 'maison-quotidien', 'Entretien, décoration, essentiels', true, 20, NULL),
  ('Électronique & accessoires', 'electronique-accessoires', 'Téléphones, accessoires, gadgets', true, 30, NULL),
  ('Mode & textile', 'mode-textile', 'Vêtements, chaussures, accessoires', true, 40, NULL)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.categories (name, slug, description, is_active, sort_order, parent_id)
SELECT
  v.name,
  v.slug,
  v.description,
  true,
  v.sort_order,
  p.id
FROM public.categories p
JOIN (
  VALUES
    ('alimentation-boissons', 'Épicerie sèche', 'epicerie-seche', 'Céréales, conserves, huiles', 1),
    ('alimentation-boissons', 'Boissons', 'boissons', 'Eau, jus, sodas', 2),
    ('maison-quotidien', 'Entretien', 'entretien-maison', 'Produits ménagers', 1),
    ('electronique-accessoires', 'Téléphonie', 'telephonie', 'Smartphones et accessoires', 1),
    ('mode-textile', 'Homme', 'mode-homme', 'Prêt-à-porter homme', 1),
    ('mode-textile', 'Femme', 'mode-femme', 'Prêt-à-porter femme', 2)
) AS v(parent_slug, name, slug, description, sort_order) ON p.slug = v.parent_slug
ON CONFLICT (slug) DO NOTHING;
