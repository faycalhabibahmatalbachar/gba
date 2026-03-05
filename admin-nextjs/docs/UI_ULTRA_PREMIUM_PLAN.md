# Plan UI Ultra-Premium – Admin GBA

## Objectif
Offrir une interface admin **moderne, cohérente et attrayante** sur toutes les pages : Dashboard, Commandes, Monitoring, Produits (dont Catégories/Tags), Livraisons, Tracking, Livreurs, Utilisateurs, Messages, Bannières, Paramètres.

## Principes
- **Design system** : couleurs, typographie, espacements, rayons, ombres définis en variables (CSS + Ant Design tokens).
- **Hiérarchie visuelle** : titres de page clairs, sous-titres secondaires, cartes avec états vides soignés.
- **Cohérence** : même style de cartes, boutons, tables et états vides sur toutes les pages.
- **Accessibilité** : contrastes suffisants, focus visible, libellés explicites.
- **Responsive** : grilles adaptatives, tables scrollables sur mobile.

---

## 1. Design system (tokens)

### Couleurs
- **Primaire** : indigo/violet (#4f46e5 → #6366f1) avec variantes hover/active.
- **Fond** : light `#fafafa` / `#ffffff`, dark `#0f172a` / `#1e293b`.
- **Surfaces** : cartes avec bordure légère + ombre douce (light) ou fond légèrement surélevé (dark).
- **États** : success, warning, error, info avec teintes cohérentes.

### Typographie
- **Titres de page** : font-semibold, taille 1.5–2rem, couleur foreground.
- **Sous-titres** : text-secondary, taille 0.875rem.
- **Corps** : base 0.9375rem, line-height 1.5.
- **Tables** : en-têtes en font-medium, taille réduite pour densité.

### Espacements
- **Contenu principal** : padding 20–24px (au lieu de 16px).
- **Cartes** : padding body 20px, gap entre cartes 16–20px.
- **Sections** : margin-bottom 24px pour séparer les blocs.

### Composants
- **Cartes** : `border-radius: 12–16px`, `box-shadow` léger, hover discret.
- **Boutons** : primary avec dégradé optionnel, secondary avec bordure.
- **Tables** : en-têtes avec fond subtle, bordures 1px, lignes alternées optionnelles.
- **États vides** : illustration ou icône + titre + description + CTA (pas seulement « Aucune donnée »).

---

## 2. Layout global
- **Sidebar** : déjà en place (gradient logo, menu dark). Conserver et affiner (espacement des items, état actif plus visible).
- **Header** : bordure basse, breadcrumb lisible, zone utilisateur avec dropdown propre.
- **Content** : `max-width` optionnel pour très grands écrans, padding augmenté, `min-height` pour éviter pied de page collé.

---

## 3. Pages cibles et améliorations

| Page | Améliorations proposées |
|------|-------------------------|
| **Dashboard** | Cartes KPI avec icônes et couleurs sémantiques, graphiques dans cartes avec padding cohérent, alertes en listes stylées, empty state illustré. |
| **Orders** | Filtres en barre compacte, table avec statuts en tags colorés, détail en drawer avec étapes et actions claires. |
| **Monitoring** | Cartes métriques, indicateurs temps réel, empty state si pas de données. |
| **Products** | Barre d’outils (recherche, filtres, vues), grille/table unifiée, cartes produit en mode grille, drawer détail avec onglets. |
| **Products/categories** | Liste/cartes avec hiérarchie, formulaire modal/drawer, empty state. |
| **Products/tags** | Tags sous forme de chips, ajout/suppression rapide, empty state. |
| **Deliveries** | Liste des livraisons avec statut, carte ou timeline, filtres par statut/date. |
| **Delivery-tracking** | Carte plein écran ou grande carte, sidebar liste des livraisons, popups sur la carte. |
| **Drivers** | Cartes ou table avec avatar, statut, actions, empty state. |
| **Users** | Table avec rôles, recherche, détail utilisateur (drawer ou page). |
| **Messages** | Liste des conversations, zone message avec bulles distinctes, indicateurs non lus. |
| **Banners** | Grille d’images avec aperçu, formulaire édition, ordre (drag). |
| **Settings** | Onglets avec sections bien séparées, champs groupés, boutons d’action alignés. |

---

## 4. Implémentation (ordre suggéré)
1. **Tokens & thème** : `globals.css` (variables), `ThemeProvider` (Ant Design token overrides).
2. **Layout** : padding content, optionnel `PageContainer` avec titre/sous-titre réutilisable.
3. **Composants partagés** : `PageHeader`, `EmptyState` (icône + texte + CTA), `StatCard` pour KPIs.
4. **Pages** : appliquer progressivement (Dashboard en premier, puis Orders, Products, etc.).

---

## 5. Fichiers modifiés / créés
- `src/app/globals.css` – variables design
- `src/components/layout/ThemeProvider.tsx` – tokens Ant Design
- `src/app/(admin)/layout.tsx` – padding / structure content
- `src/components/ui/PageHeader.tsx` (nouveau) – titre + sous-titre
- `src/components/ui/EmptyState.tsx` (nouveau) – état vide premium
- `src/components/ui/StatCard.tsx` (nouveau) – carte KPI
- Chaque `page.tsx` – utilisation de PageHeader, EmptyState, classes communes

Ce document sert de référence pour les évolutions UI ; l’implémentation commence par le design system et le layout, puis les composants réutilisables et enfin chaque page.
