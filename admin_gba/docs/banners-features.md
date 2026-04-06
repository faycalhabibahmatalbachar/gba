# Page Bannières (`/banners`)

Implémentation : [`src/app/(admin)/banners/page.tsx`](../src/app/(admin)/banners/page.tsx).

## Données

- Table Supabase `public.banners`.
- Tri par `display_order` ascendant (colonne alignée avec les migrations GBA).
- Champs typiques : `title`, `image_url`, `link_url`, `is_active`, `display_order`, `created_at`.

## Actions

1. **Liste** — Chargement via client Supabase (`select('*')`), cache React Query 30 s.
2. **Création** — Formulaire titre / URL image / lien ; insertion avec `is_active: true` et `display_order` par défaut.
3. **Activation / désactivation** — Mise à jour `is_active` par ligne.
4. **Suppression** — Avec dialogue de confirmation (`ConfirmDialog`).
5. **Prévisualisation** — Miniature via `next/image` lorsque `image_url` est défini.

## Stockage images

- Bucket dédié `banners` (voir migrations Supabase) pour les fichiers hébergés côté stockage ; la page accepte aussi une **URL externe** dans `image_url`.

## Droits

- RLS `banners_admin_all` pour utilisateurs authentifiés admin selon politiques du projet ; en cas d’erreur 401/403, vérifier le rôle profil et les policies.

## Déploiement

- Même variables Supabase que le reste de l’admin (`NEXT_PUBLIC_*` + session).
