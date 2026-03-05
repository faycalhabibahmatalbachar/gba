---
description: Dashboard e-commerce temps réel (KPIs + funnel + top produits)
---

# Objectif
Mettre en place une page `/dashboard` (admin-nextjs) inspirée des dashboards e-commerce modernes (type Boardroom), **branchée sur Supabase** avec:
- KPIs commandes en temps réel (en attente, confirmées/en cours, livrées, annulées, retard)
- Revenus (basé sur `orders.total_amount` des commandes payées/livrées selon règle)
- Top produits / catégories
- Taux de rupture de stock (produits `stock_quantity <= 0`)
- Funnel & comportement utilisateur: **visite → panier → checkout → achat** basé sur `user_activities`
- Realtime: mise à jour instantanée via Supabase Realtime (écoute `orders`, `order_items`, `products`, `user_activities`)

# Hypothèses / Pré-requis
- Supabase env vars configurées dans `admin-nextjs`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Tables/vues attendues (minimales):
  - `orders(id, status, created_at, total_amount, paid_at?)`
  - `order_items(order_id, product_id, quantity, unit_price?)` (ou équivalent)
  - `products(id, name, category_id, price, stock_quantity, image_url?)`
  - `categories(id, name)`
  - `user_activities(id, user_id, created_at, action_type, entity_type, entity_id, page_name, session_id)`

Si certains noms diffèrent, on ajoute une couche de mapping (service) ou on bascule vers des vues SQL.

# Dépendances (déjà présentes)
- `antd` (layout, Card, Statistic, Table, Segmented, Tabs)
- `@ant-design/charts` (line/bar charts)
- `@supabase/supabase-js` (data + realtime)
- `dayjs` (périodes)

# Design UI / UX
- Header: titre + sous-titre + sélecteur de période (24h / 7j / 30j)
- Rangée KPI (cards):
  - Total commandes
  - En attente
  - Livrées
  - Revenus
  - Rupture stock (%)
- Bloc Charts:
  - Série temporelle commandes/jour (line)
  - Funnel (bar horizontal)
- Tables:
  - Dernières commandes (table compacte)
  - Top produits (table)
  - Top catégories (table)

# Données & calculs
## Fenêtre temporelle
- Période sélectionnée (ex: 7 jours): `dateFrom = now - N days`.

## KPIs commandes
Source: `orders`.
- `totalOrders`: count période
- `pending`: status in ('pending')
- `inProgress`: ('confirmed','processing','shipped')
- `delivered`: ('delivered')
- `cancelled`: ('cancelled')
- `revenue`: somme `total_amount` sur commandes `paid_at not null` OU status='delivered'

## Rupture de stock
Source: `products`.
- `outOfStockCount`: `stock_quantity <= 0`
- `stockoutRate`: outOfStockCount / totalProducts

## Top produits
Source: `order_items` join `products`.
- Somme des quantités par produit dans la période (join orders par date)
- Montant par produit si `unit_price` dispo sinon `quantity * products.price`

## Top catégories
Source: `order_items` join `products` join `categories`.
- Somme quantités / montant par catégorie

## Funnel analytics (user_activities)
Source: `user_activities` filtré par période.
On compte le **nombre de sessions distinctes** (via `session_id`) par étape:
- Visite: `action_type='page_view'` (ou `product_view`) + `page_name` in ('home','product','catalog')
- Panier: `action_type='add_to_cart'`
- Checkout: `action_type in ('checkout_start','checkout')`
- Achat: `action_type in ('purchase','order_paid')`

Règle de comptage:
- `visits`: distinct session_id où action_type est visite
- `cart`: distinct session_id où add_to_cart
- `checkout`: distinct session_id où checkout
- `purchase`: distinct session_id où purchase

On peut aussi afficher les taux de conversion:
- cart/visits
- checkout/cart
- purchase/checkout

# Realtime
On met en place des subscriptions:
- `orders`: INSERT/UPDATE/DELETE → recalcul KPIs + dernières commandes + top via refresh
- `order_items`: INSERT/UPDATE/DELETE → refresh tops
- `products`: UPDATE → refresh stockout
- `user_activities`: INSERT → refresh funnel

Stratégie perf:
- Realtime déclenche un `refresh()` debounced (ex 500ms) pour éviter spam.

# Sécurité / RLS
- Le dashboard nécessite lecture sur les tables.
- Si RLS bloque côté anon key, il faut:
  - soit utiliser login admin (supabase auth) + policies `is_admin()`
  - soit exposer des vues/RPC security definer (recommandé pour agrégats).

# Implémentation (livrables)
- `src/lib/services/dashboard.ts`:
  - `fetchDashboardSnapshot({dateFrom, dateTo})` → retourne un objet unique (KPIs + series + tables)
  - helpers: mapping statuts, agrégations JS si SQL complexe
- `src/app/(admin)/dashboard/page.tsx`:
  - UI + états (period, loading, data)
  - hook realtime subscriptions

# Tests manuels
- Ouvrir `/dashboard`.
- Modifier une commande (status) dans l’admin deliveries → vérifier KPI instant.
- Ajouter une activity `add_to_cart` → funnel met à jour.
- Mettre un produit stock=0 → stockout met à jour.
