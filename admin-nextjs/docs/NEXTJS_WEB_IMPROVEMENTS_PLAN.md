# Plan d’implémentation — Améliorations Next.js (admin-nextjs)

## Portée
- Application concernée: `admin-nextjs/` (Next.js App Router)
- Pages concernées: toutes les routes sous `src/app/(admin)/*` + `/login`

## Objectifs
- Sécuriser l’accès aux pages admin (protection server-side)
- Améliorer SEO/metadata (notamment `noindex` pour l’admin)
- Améliorer performances (bundle JS, Core Web Vitals, chargements)
- Standardiser la gestion des images (passage à `next/image`)

## Principes
- Changements minimalistes et sûrs: pas de refonte UI massive.
- Priorité à la sécurité (auth/guard) avant le reste.
- Ne pas casser les intégrations Supabase existantes.

## Plan (priorisé)

### 1) Protection d’accès server-side (P0)
**But**: empêcher l’accès aux routes admin sans session valide.

**Actions** (choisir la stratégie la plus robuste, préférer `middleware.ts`):
- Ajouter un `middleware.ts` à la racine `admin-nextjs/src/` ou `admin-nextjs/` (selon la config Next) pour:
  - Rediriger vers `/login` si l’utilisateur n’est pas authentifié.
  - Autoriser `/login`, assets, et éventuellement endpoints publics.
- Définir précisément quelles routes sont protégées:
  - protéger `/(admin)/*`.

**Critères d’acceptation**:
- Accès à `/dashboard` sans session => redirection immédiate vers `/login`.
- Aucun « flash » de contenu admin avant redirection.

### 2) Metadata & robots (P1)
**But**: clarifier titres, améliorer partage, et éviter l’indexation d’un admin.

**Actions**:
- Dans `src/app/layout.tsx`:
  - Compléter `metadata` (au minimum): `title`, `description`, `robots`.
  - Mettre `robots: { index: false, follow: false }`.
- Sur `/login`:
  - Ajouter metadata dédiée (title/description).
- Optionnel:
  - `metadataBase` (si URL production connue).

**Critères d’acceptation**:
- Les pages admin exposent `noindex`.
- Title cohérent par page.

### 3) Images: passage à `next/image` (P1)
**But**: optimiser lazy-loading, tailles, et réduire CLS.

**Actions**:
- Remplacer les `<img>` dans:
  - `src/app/(admin)/products/page.tsx`
  - `src/app/(admin)/orders/page.tsx`
  - autres pages similaires
- Mettre à jour `next.config.ts` pour autoriser les domaines d’images (Supabase Storage/CDN) via `images.remotePatterns`.

**Critères d’acceptation**:
- Zéro usage de `<img>` non justifié dans l’admin.
- Images distantes chargent correctement en dev et prod.

### 4) Performance: réduire le bundle et isoler les lourdeurs (P2)
**But**: réduire le JS chargé initialement.

**Actions**:
- `Dashboard`:
  - isoler charts via `dynamic import` avec `ssr: false`.
  - découper le composant en sous-composants (KPI, tables, charts, drawers).
- Optionnel:
  - déplacer logique "fallback schema" dans `lib/services/*`.

**Critères d’acceptation**:
- Navigation plus fluide.
- Le dashboard reste fonctionnel (realtime ok).

### 5) Qualité UX/A11y (P2)
**But**: améliorer l’accessibilité et la cohérence.

**Actions**:
- Ajouter `aria-label` aux boutons icône-only.
- Remplacer le stepper custom par `Steps` AntD ou ajouter attributs a11y.

**Critères d’acceptation**:
- Contrôles utilisables au clavier.
- Lecteurs d’écran: labels compréhensibles.

## Dépendances / décisions à valider
- Source de vérité de la session Supabase côté serveur:
  - cookies SSR (recommandé) vs seulement client.
- URL de production pour `metadataBase`.

## Rollback
- Chaque étape doit être un commit séparé.
- Si un problème survient, revert du commit de l’étape concernée.
