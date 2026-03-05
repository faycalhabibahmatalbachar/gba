# Dashboard Analytics – Validation & Production

## 1. Structure des requêtes (données réelles)

| Donnée | Source | Champs utilisés | Période |
|--------|--------|-----------------|--------|
| Commandes courantes | `orders` | id, order_number, status, created_at, total_amount, paid_at, customer_name | dateFrom → dateTo (24h / 7j / 30j) |
| Commandes période précédente | `orders` | id, status, created_at, total_amount, paid_at | prevRange (même durée avant) |
| Produits | `products` | id, name, quantity, price, category_id, main_image, images, categories(name) | Tous (limit 5000) |
| Lignes commandes | `order_items` | order_id, product_id, product_name, quantity, unit_price | in(order_id, ids) |
| Activités (funnel, recherche, abandon) | `user_activities` | session_id, action_type, page_name, action_details, created_at | dateFrom → dateTo |

- **Variation %** : calculée côté client à partir des KPIs courants vs `prevKpis` (période précédente).
- **Séries temporelles** : agrégation par jour (date) des `orders` et `order_items` (revenus par jour).
- **Top catégories** : jointure `order_items` → `products` → `categories` ; agrégation par `category_id` avec nom de catégorie.

## 2. Optimisations proposées

- **Parallélisation** : `Promise.all` pour orders + products + prevOrders en une seule vague.
- **Pas de sur-fetch** : `limit(2000)` sur orders, `limit(5000)` sur products, `limit(20000)` sur order_items.
- **Realtime** : abonnement Supabase sur `orders`, `order_items`, `products`, `user_activities` avec debounce 500 ms pour éviter les re-fetch en rafale.
- **Mémo** : `useMemo` pour `variation`, `ordersChartConfig`, `funnelChartConfig`, `filteredRecentOrders`, `topCategoriesUi`, etc.
- **Skeleton** : états de chargement avec `Skeleton` Ant Design sur chaque bloc pour éviter layout shift.

## 3. Structure visuelle détaillée

1. **Header Analytics Live** : indicateur LIVE (pulse), timestamp, libellé variation % vs période précédente, Segmented (24h / 7j / 30j), boutons Actualiser / Exporter.
2. **KPI Cards (4)** : icône, valeur, variation % (↑/↓), MiniSparkline 7j, hover shadow.
3. **Alertes** : carte avec liste alertes critiques, liste produits en rupture (5 max + lien Produits), bouton action.
4. **Top recherches** : barres horizontales (top 5), volume, clic → filtre commandes.
5. **Checkout abandonné** : donut (Pie innerRadius) Abandonnés / Complétés, valeur centrale.
6. **Série commandes** : Line chart avec area gradient, tooltips.
7. **Funnel** : Column chart vertical (étapes × sessions), taux conversion en dessous.
8. **Commandes récentes** : table avec badges statut, temps relatif (il y a X min), pagination 10, hover, clic → drawer.
9. **Top produits** : table avec rang 1/2/3, image, nom, qté, part %, montant.
10. **Top catégories** : Donut (Pie) + table (catégorie, qté, part %, montant).

## 4. Plan responsive

- **Grid** : `Row` / `Col` avec `xs={12} md={6}` pour KPIs (4 colonnes desktop, 2 colonnes mobile).
- **Alertes / Recherches / Donut** : `xs={24} lg={8}` (stack vertical sur mobile, 3 colonnes desktop).
- **Série + Funnel** : `xs={24} lg={14}` et `xs={24} lg={10}`.
- **Commandes récentes + colonne droite** : `xs={24} lg={14}` et `xs={24} lg={10}` ; table `scroll={{ x: true }}`.
- **Top catégories** : `flex-col lg:flex-row` pour Donut + table.

## 5. Améliorations UX

- Temps relatif (il y a X min) sur la table commandes.
- Clic sur une ligne commande → ouverture du drawer détail (existant).
- Filtres commandes (Segmented) + recherche (numéro / client).
- Top recherches cliquables → filtre + scroll vers la table.
- Lien « Voir tout » sur ruptures de stock → `/products?stock=out`.
- Indicateur LIVE animé + variation globale pour confiance données temps réel.

## 6. Vérifications base nécessaires

- Tables `orders`, `order_items`, `products`, `categories`, `user_activities` présentes et accessibles (RLS admin).
- Vue `order_details_view` optionnelle (fallback sur `orders` + `order_items` pour le drawer).
- Colonnes utilisées : `orders.paid_at`, `orders.delivered_at`, `orders.cancelled_at` (optionnelles selon schéma).
- Index recommandés : `orders(created_at)`, `order_items(order_id)`, `user_activities(created_at)`.

## 7. Checklist production-ready

- [x] Aucun mock : toutes les métriques viennent de la base.
- [x] Skeleton loading sur tous les blocs.
- [x] Gestion d’erreur (message + bouton Réessayer).
- [x] État vide (EmptyState) quand aucune donnée sur la période.
- [x] Realtime avec debounce pour éviter surcharge.
- [x] Export CSV (commandes, top produits, top catégories).
- [x] Dark mode cohérent (classes Tailwind dark:).
- [x] Table accessible (hover, pagination, libellés clairs).
