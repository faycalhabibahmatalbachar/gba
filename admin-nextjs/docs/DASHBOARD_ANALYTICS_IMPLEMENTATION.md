# Dashboard Analytics — Implémentation & Validation

## 1. Structure des requêtes (données réelles) 

Toutes les métriques proviennent de la base Supabase, sans mock.

| Donnée | Source | Colonnes / logique |
|--------|--------|--------------------|
| Commandes période | `orders` | `id, order_number, status, created_at, total_amount, paid_at, customer_name` filtré par `created_at` (dateFrom → dateTo), limit 2000 |
| Commandes période précédente | `orders` | Même select, plage `periodToPreviousRange(period)` pour variation % |
| Produits & stock | `products` | `id, name, quantity, price, category_id, categories(name)`, limit 5000 |
| Lignes commandes | `order_items` | `order_id, product_id, product_name, quantity, unit_price` pour order_ids de la période, limit 20000 |
| Funnel & recherches | `user_activities` | `session_id, action_type, page_name, action_details, created_at` sur la période, limit 50000. Funnel: visites / cart_add / checkout_started / payment_completed|order_placed. Top recherches: action_type=search, action_details.query. Checkout abandonné: action_type=checkout_abandoned |
| Détail commande (drawer) | `order_details_view` ou `orders` + `order_items` | View avec items agrégés ou fallback 2 requêtes |
| Livreurs (select) | `profiles` | `id, first_name, last_name, phone` où role=driver |

## 2. Optimisations proposées

- **Une passe de calcul** : une fois `orders` + `products` + `order_items` + `user_activities` chargés, tout est dérivé en mémoire (KPIs, séries, top produits/catégories, alertes, funnel). Pas de N+1.
- **Période précédente** : une seule requête supplémentaire sur `orders` (même filtres, autre plage) pour les variations %.
- **Realtime** : abonnement Supabase sur `orders`, `order_items`, `products`, `user_activities` avec debounce 500 ms pour refresh silencieux.
- **Memoization** : `useMemo` pour les séries, funnel, conversion, variations, topCategoriesUi, filteredRecentOrders, configs graphiques.
- **Index recommandés** (si pas déjà présents) : `orders(created_at)`, `order_items(order_id)`, `user_activities(created_at, action_type)`.

## 3. Structure visuelle détaillée

1. **Header Analytics Live** : indicateur LIVE (pulse), texte “Analytics temps réel”, timestamp relatif, Segmented 24h/7j/30j, variation % vs période précédente, boutons Actualiser / Exporter.
2. **KPI Cards** : 4 cartes (Total commandes, En attente, Livrées, Revenus). Chaque carte : icône, titre, valeur, variation % si période précédente disponible, mini sparkline (commandes/jour ou revenus/jour) où applicable.
3. **Alertes** : carte “Alertes critiques” avec badge count, liste alertes (severity), liste produits en rupture + lien “Voir stock”.
4. **Top recherches** : barres horizontales (top 5 termes), volume, clic → filtre commandes.
5. **Checkout abandonné** : valeur, sous-texte “événements”, indicateur % vs visites (cercle).
6. **Série temporelle** : graphique ligne (commandes par jour), tooltips, période en en-tête.
7. **Funnel** : étapes verticales (Visite → Panier → Checkout → Achat), barres proportionnelles, taux de conversion par step et global.
8. **Table commandes** : filtres par statut, recherche, pagination (8 par page), temps relatif, clic ligne → drawer détail.
9. **Top produits** : classement 1–3 (badge), image, nom, barre de part, qté et montant, lien détail produit.
10. **Top catégories** : donut (Pie innerRadius) + légende/liste avec part % et montant FCFA.

## 4. Plan responsive

- **Mobile** : KPI en 2 colonnes (grid-cols-2). Header : stack, Segmented et boutons wrap. Alertes / Top recherches / Checkout en colonne. Série + Funnel en colonne. Table scroll horizontal. Top produits et catégories en colonne.
- **Tablet** : idem avec grilles lg (3–4 colonnes pour KPIs, 2+1 pour série+funnel, 2+1 pour produits+catégories).
- **Desktop** : grilles xl/lg comme dans le code (header une ligne, 4 KPI, 4+5+3 pour alertes/recherches/checkout, 2+1 pour chartes, table pleine largeur, 2+1 pour produits/catégories).

## 5. Améliorations UX

- Timestamp “Mis à jour il y a X min” pour feedback live.
- Variation % vs période précédente pour donner du sens aux KPIs.
- Sparklines sur les cartes pour tendance rapide.
- Clic sur KPI (commandes, attente, livrées) → filtre automatique sur la table.
- Clic ligne table → drawer détail sans rechargement inutile (données déjà en cache ou une requête ciblée).
- États vides explicites (aucune recherche, aucune catégorie avec ventes, etc.).
- Skeleton sur tous les blocs pendant le chargement.

## 6. Vérifications base nécessaires

- Tables `orders`, `order_items`, `products`, `user_activities`, `profiles` accessibles (RLS OK pour le rôle admin).
- Vue `order_details_view` avec colonne `items` (JSONB) et optionnellement `delivered_at`, `cancelled_at`.
- Relation `products.categories` (ou jointure `categories`) pour top catégories.
- `user_activities.action_details` peut contenir `query` / `q` / `term` pour les recherches.

## 7. Checklist production-ready

- [x] Aucune donnée fictive ; tout depuis la BDD.
- [x] Gestion d’erreur (try/catch, setError, affichage + Réessayer).
- [x] État vide (isEmpty) avec EmptyState et message clair.
- [x] Realtime avec debounce pour éviter surcharge.
- [x] Pagination table (8 par page, showTotal).
- [x] Export CSV (commandes, top produits, top catégories).
- [x] Drawer détail commande avec statut, livreur, timeline, articles.
- [x] Thème dark pris en charge (classes dark:, variables CSS).
- [x] Responsive (grilles Tailwind, wrap, scroll).
- [x] Accessibilité basique (titres, boutons, labels).
