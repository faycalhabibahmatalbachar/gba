# Orders — Order Management Center (Enterprise)

## 1. Architecture UI

- **Page** : `src/app/(admin)/orders/page.tsx` — composant client unique avec états centralisés.
- **Composants réutilisables** :
  - `OrderStatusBadge` (`src/components/orders/OrderStatusBadge.tsx`) : badge statut avec couleurs (pending=amber, processing=blue, delivered=green, cancelled=red, refunded=purple).
  - `PageHeader`, `EmptyState` (UI partagée).
- **Sections** :
  1. **Header** : titre, sous-titre, actions (Exporter CSV, Actualiser).
  2. **KPI bar (sticky)** : 5 cartes (Total commandes, Revenus, Panier moyen, En attente, Livrées + taux), chargement skeleton.
  3. **Filtres** : recherche, statut, livreur, plage de dates, montant min/max, tri.
  4. **Bulk actions** : barre conditionnelle (N sélectionnée(s), Assigner livreur, Changer statut, Annuler).
  5. **Table** : rowSelection, colonnes (ID, Client, Total, Paiement, Statut, Livreur, Date, Actions), pagination serveur, clic ligne → drawer.
  6. **Drawer (80%)** : résumé, client & contact, paiement, articles, livraison, historique ; footer avec actions (Annuler, Confirmer, Prépa, Expédier, Livrée, Livreur).
  7. **Modals** : Assigner livreur (single + bulk), Changer statut (bulk), Confirmation annulation, Aperçu image.

## 2. Structure des données (Supabase / PostgreSQL)

- **orders** : id, order_number, created_at, updated_at, customer_name, customer_phone, customer_phone_profile, total_amount, total_items, status, driver_id, payment_method, paid_at, delivered_at, cancelled_at, shipping_*, etc.
- **order_items** : id, order_id, product_id, product_name, product_image, quantity, unit_price, total_price, created_at.
- **order_details_view** (optionnelle) : vue agrégée pour le détail (jointure orders + items ou JSON items).
- **profiles** : id, first_name, last_name, email, role (driver pour la liste livreurs).

Index recommandés (si pas déjà présents) :

- `orders(created_at DESC)`
- `orders(status)`
- `orders(driver_id)`
- `orders(created_at)` pour les range date
- `order_items(order_id)`

## 3. Service & requêtes

- **fetchOrders(params)** : liste paginée avec filtres (search, status, driverId, dateFrom, dateTo, amountMin, amountMax, sortBy, sortOrder). Utilise `range(from, to)` et `count: 'exact'`.
- **fetchOrdersKpis(params)** : agrégats sur les mêmes filtres (sans pagination) ; récupère jusqu’à 5000 lignes et calcule côté client totalOrders (count), revenue, avgBasket, pendingCount, deliveredCount, deliveryRate. Pour des volumes > 5000, prévoir une RPC ou une vue matérialisée pour des KPIs exacts.
- **fetchOrderDetails(orderId)** : détail via `order_details_view` + `order_items`.
- **updateOrderStatus**, **bulkUpdateOrderStatus** : mise à jour statut (+ delivered_at / cancelled_at si livrée / annulée).
- **assignOrderDriver**, **bulkAssignDriver** : mise à jour driver_id.

Fallback : si des colonnes (ex. customer_phone_profile, payment_method, driver_name) sont absentes, le service réessaie avec un select réduit pour rester compatible avec plusieurs schémas.

## 4. Sécurité & RLS

- **Admin** : accès complet en lecture/écriture sur `orders` et `order_items` (politique type `role = 'admin'` ou service role).
- **Livreur** : voir uniquement ses commandes : `driver_id = auth.uid()` (ou équivalent profil).
- **Client** : voir uniquement ses commandes : `user_id = auth.uid()` (si colonne user_id présente).

L’app admin actuelle suppose un contexte authentifié admin ; les politiques RLS doivent restreindre les autres rôles comme ci-dessus. Aucune donnée sensible (ex. tokens paiement) ne doit être exposée dans les selects.

## 5. Logique métier

- **Machine à états (statut)** : pending → confirmed → processing → shipped → delivered ; ou cancelled à tout moment. Côté UI : boutons conditionnels selon le statut actuel (Confirmer, Préparation, Expédier, Marquer livrée, Annuler). Pas de passage direct à « livrée » sans paiement si la règle métier l’exige (à renforcer côté API si besoin).
- **Annulation** : confirmation modale avant appel à `updateOrderStatus(id, 'cancelled')`.
- **Assignation livreur** : single (depuis la ligne ou le drawer) ou bulk (sélection multiple) ; même modal, branchement sur assignOrderDriver ou bulkAssignDriver.

## 6. États UI

- **loading** : skeleton table / drawer pendant fetch.
- **kpisLoading** : skeleton des cartes KPI.
- **empty** : aucun résultat (avec ou sans filtres) → EmptyState + message + action « Réinitialiser » si filtres actifs.
- **error** : message.error + possibilité de réessayer (Actualiser).
- **statusUpdating / assigning / bulkActionLoading** : désactivation des boutons et confirmLoading sur les modals.
- **No results (filtres)** : même empty state avec explication et réinitialisation des filtres.

## 7. Optimisations

- Pagination côté serveur (limit/offset).
- Debounce recherche (400 ms) pour limiter les appels.
- Realtime Supabase sur `orders` avec debounce 600 ms pour recharger liste + KPIs.
- useMemo pour fetchParams, selectedOrders, columns.
- useCallback pour load, loadKpis.

## 8. Plan de tests (checklist)

- [ ] Chargement liste : pagination, tri, changement pageSize.
- [ ] Filtres : recherche (ID, nom, tél), statut, livreur, dates, montant min/max ; réinitialisation.
- [ ] KPIs : cohérence avec la liste filtrée (au moins sur < 5000 lignes).
- [ ] Sélection : checkbox, bulk bar, assignation bulk, changement statut bulk.
- [ ] Drawer : ouverture au clic ligne (sans ouvrir au clic checkbox), détail complet, actions (confirmer, prépa, expédier, livrée, annuler), assignation livreur.
- [ ] Modals : assigner (single + bulk), statut bulk, confirmation annulation.
- [ ] URL ?open=orderId : ouverture automatique du drawer après chargement.
- [ ] Export CSV : contenu correct.
- [ ] Realtime : mise à jour liste après modification externe.

## 9. Checklist production

- [x] Aucun mock : données réelles Supabase.
- [x] Pagination backend.
- [x] Filtres et tri appliqués côté requête.
- [x] KPIs dérivés des mêmes filtres (avec limite 5000 pour perf).
- [x] RLS documenté et à vérifier en environnement.
- [x] États loading / empty / error gérés.
- [x] Confirmations pour annulation et actions bulk.
- [x] Drawer 80 % largeur, sections claires.
- [x] Badges statut cohérents, accessibilité de base (labels, boutons).
- [ ] Tests E2E (optionnel) : parcours critique commande (voir plan ci-dessus).
