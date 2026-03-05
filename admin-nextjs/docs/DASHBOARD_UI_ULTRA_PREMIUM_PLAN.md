---
description: Plan d’amélioration UI/UX ultra premium — Dashboard e-commerce temps réel
---

# Objectif
Transformer la page `/dashboard` en une expérience **ultra premium** (style Boardroom / dashboards SaaS modernes), tout en gardant des données **réelles + temps réel** (Supabase) et une UX robuste (skeletons, empty states, erreurs, perf).

# Principes design (guidelines)
- **Clarté avant densité**: peu de chiffres mais très lisibles, hiérarchie visuelle forte.
- **Rythme vertical**: sections régulières (header, KPIs, charts, tables), spacing cohérent.
- **Actions rapides**: filtres, drill-down, navigation contextuelle.
- **États complets**: loading, empty, error, partial-failure.
- **Realtime discret**: indicateur “Live” + update debounced, pas de clignotement.

# Dépendances / stack UI
## Déjà présentes
- `antd` (layout, grid, Table, Card, Statistic, Segmented, Tabs, Tooltip)
- `@ant-design/charts` (Line, Bar)
- `lucide-react` (icônes premium cohérentes)
- `tailwindcss` (micro-layout, spacing, classes utilitaires)

## Optionnelles (si tu veux encore plus premium)
- `framer-motion` (animations micro-interactions: hover, transition de chiffres, apparition sections)
- `@tanstack/react-query` (cache, refetch, retries, stale-time pour améliorer la perf perçue)

> Important: on peut faire un rendu ultra premium **sans** rajouter de dépendances, en restant sur Ant Design + charts.

# Structure visuelle recommandée (layout)
## 1) Topbar Dashboard
- Titre + sous-titre (période active)
- **Segmented** période + **DateRange (option)**
- Boutons:
  - “Actualiser” (manual refresh)
  - “Exporter” (CSV/PDF plus tard)
- Indicateur Live:
  - pastille verte + “Live”
  - “Dernière mise à jour: 12:48”

## 2) Rangée KPI (cards)
Objectif: cartes “premium” avec micro-détails.
- Cards: `Total commandes`, `En attente`, `Livrées`, `Revenus`
- Deuxième rangée: `Rupture stock`, `En cours`, `Annulées`, `Conversion (Achat/Visite)`

### UX KPI premium
- Ajout d’un petit delta (vs période précédente) si possible:
  - ex: `+12%` vs semaine dernière
- Mini sparkline par KPI (option)
- Click KPI → filtre le tableau “Commandes récentes” (drill-down)

## 3) Zone Charts (2 colonnes)
- Gauche: “Commandes (série)” + toggle “par jour / par heure (24h)”
- Droite: Funnel “Visite → Panier → Checkout → Achat”

### Premium touches
- Tooltips plus riches (date + count + conversion)
- Annotations: pic max, jour 0
- Sélecteur “Afficher: commandes / revenus / items” (option)

## 4) Tables & insights
### Commandes récentes (table)
- Colonnes: numéro, client, statut (Tag), total, date
- Rangées cliquables → page /orders ou /deliveries
- Badge “Nouveau” si < 1h

### Top produits / catégories
- Ajouter:
  - “Qté vendue”
  - “Montant”
  - “Part %”
- Row click → page produit/catégorie

## 5) Section “Alerts / Actions” (premium)
- Bloc compact “À traiter”:
  - commandes pending > X minutes
  - produits en rupture
  - checkout_abandoned élevé
- Chaque alerte a un CTA: “Voir”, “Corriger”, “Relancer”

# Comportement & Interactions
## Drill-down
- Cliquer un KPI applique un filtre:
  - status=pending → table commandes
  - rupture stock → ouvre liste produits stock=0
- Cliquer un point du graphe → filtre table sur la date

## Realtime UX
- Realtime déclenche un refresh **debounced**.
- Ne pas remplacer brutalement l’écran:
  - update “soft” (spinner discret dans header)
  - conserver scroll position

## Loading / skeleton
- Skeleton pour KPIs (4 cards)
- Skeleton pour charts (block)
- Table: `loading` + placeholder rows

## Gestion d’erreurs (ultra important)
- Si `products` échoue mais `orders` ok:
  - dashboard reste utilisable
  - bloc “stock” affiche un état “indisponible”
- Toast non-intrusif + bouton “Réessayer”

# Architecture code (refacto recommandé)
Objectif: rendre la page plus “clean” et scalable.

## 1) Extraire un service
Créer `src/lib/services/dashboard.ts` avec:
- `fetchDashboardSnapshot({dateFrom, dateTo})`
  - retourne: `kpis`, `ordersSeries`, `recentOrders`, `topProducts`, `topCategories`, `funnel`

Avantage:
- page plus lisible
- tests unitaires possibles

## 2) Extraire des composants UI
- `DashboardHeader`
- `KpiGrid`
- `OrdersSeriesCard`
- `FunnelCard`
- `RecentOrdersTable`
- `TopProductsTable`
- `TopCategoriesTable`

## 3) Éviter les gros fetchs côté client (perf)
Actuellement on lit beaucoup de lignes et on agrège en JS.
Plan premium:
- Ajouter des **vues** ou **RPC** Supabase:
  - `dashboard_kpis(date_from, date_to)`
  - `dashboard_top_products(date_from, date_to, limit)`
  - `dashboard_top_categories(date_from, date_to, limit)`
  - `dashboard_funnel(date_from, date_to)`

Avantage:
- beaucoup plus rapide
- moins de bande passante
- plus robuste avec RLS (RPC security definer)

# Performance & scalabilité
- Debounce refresh (déjà)
- Pagination tables si nécessaire
- Limiter:
  - `user_activities` sur période (index `created_at`)
- Ajouter index si besoin:
  - `orders(created_at)`
  - `order_items(order_id, product_id)`
  - `user_activities(created_at, action_type, session_id)`

# Accessibilité & détails premium
- Contrastes des tags status
- Tooltips accessibles
- Keyboard navigation sur tables
- Format nombres:
  - `toLocaleString('fr-FR')`
- Cohérence des labels (FR)

# Roadmap (itérations)
## Itération 1 (rapide, 1-2h)
- UI polish: header, spacing, live badge, skeletons
- drill-down simple (KPI → filtre table)

## Itération 2 (perf)
- Extract `dashboard.ts`
- Introduire `react-query` (option)

## Itération 3 (pro)
- RPC/vues SQL pour KPIs/top/funnel
- RLS admin propre

## Itération 4 (wow)
- Animations (framer-motion)
- Export CSV
- “Alerts / Actions”
