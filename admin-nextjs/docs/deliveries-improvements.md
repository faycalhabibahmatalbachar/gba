---
description: Améliorations de la page /deliveries (admin-nextjs)
---

# Objectif
Améliorer la page **/deliveries** pour faciliter l’exploitation opérationnelle (dispatch, suivi GPS, paiements, retards) avec une UX plus rapide et orientée actions.

# Contexte actuel
- Table AntD listant les commandes/livraisons.
- Filtres: recherche, statut, livreur, plage de dates.
- KPI cards (aujourd’hui, en cours, retards, livrées, annulées).
- Actions actuelles:
  - Boutons `Maps` (Google) et `OSM` (liens externes)
  - Bouton détails (Drawer)

# Priorités (implémentées / à implémenter)

## P0 — Accès direct au suivi GPS (tracking live)
- Remplacer l’action principale par une **icône localisation**.
- Au clic: rediriger vers **/delivery-tracking** avec pré-sélection:
  - `driverId` (si `driver_id` existe)
  - `orderId` (commande)

**UX attendue**
- Un dispatch ouvre le tracking live en 1 clic.

## P0 — Indicateur “Signal GPS” directement dans la liste
- Afficher un badge `GPS: actif/inactif` basé sur la présence récente dans `driver_locations`.
- Méthode recommandée: requête “dernière position par driver_id” (groupée) ou vue SQL.

**Option simple**
- Ajouter une colonne `Dernier GPS`:
  - Date/heure
  - Couleur selon âge (ex: <2min vert, <10min orange, sinon gris)

## P1 — Amélioration section Actions
- Remplacer `Maps/OSM` par:
  - `📍 Tracking` (interne, /delivery-tracking)
  - `🧭 OSM` (externe)
  - `📄 Détails` (drawer)
- Conserver l’ouverture externe OSM uniquement si coordonnées valides.

## P1 — Paiement plus clair
- Dans la colonne Paiement:
  - badge `Payé` / `Non payé`
  - + méthode (`manual`, `cash_on_delivery`, etc.)
  - + si possible: montant payé/à payer.

## P1 — Retards (Operational)
- Ajouter une colonne `Retard` basée sur:
  - statut `shipped` depuis X heures
  - ou `created_at` > X heures sans livraison
- Permettre de filtrer “Retards uniquement”.

## P2 — Détails plus actionnables (Drawer)
- Dans le Drawer:
  - lien direct Tracking
  - lien OSM
  - affichage “destination lat/lng” si présent
  - affichage items sous forme table (au lieu JSON)

## P2 — Qualité de vie
- Copie rapide du téléphone client (`CopyOutlined`) + bouton WhatsApp (optionnel).
- Mémoriser filtres dans l’URL (query string) pour partage.

# Implémentation (ordre)
1) P0: `📍` vers /delivery-tracking (driverId + orderId)
2) P1: rationaliser colonne Actions (tracking interne en premier)
3) P2: améliorer Drawer (liens + items)

# Notes
- `tile.openstreetmap.org` est utilisable, mais respecter la policy si trafic élevé.
- Le tracking live dépend de `driver_locations` (foreground service Android + permissions Always).
