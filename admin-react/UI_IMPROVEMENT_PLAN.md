# GBA Admin — Plan d'amélioration UI/UX

> Document de suivi des tâches d'amélioration de l'interface web admin.
> Chaque tâche est marquée `[ ]` (à faire) ou `[x]` (terminée).

---

## 🧹 ÉTAPE 0 — Nettoyage résidus MUI dans main.jsx

- [x] **0.1** Supprimer `ThemeProvider`, `CssBaseline`, `LocalizationProvider`, `AdapterDateFns` de `main.jsx`
- [x] **0.2** Supprimer l'import `theme/theme` devenu inutile

---

## 🗂️ ÉTAPE 1 — Sidebar navigation moderne (collapsible)

### Comportement
- [x] **1.1** Mode **expanded** (264px) : logo + labels + sections
- [x] **1.2** Mode **collapsed** (72px) : icônes seulement, tooltips au survol
- [x] **1.3** Bouton toggle `PanelLeftClose/Open` dans le header (desktop)
- [x] **1.4** L'état collapsed est persisté dans `localStorage`
- [x] **1.5** Sur mobile : drawer overlay avec backdrop blur
- [x] **1.6** Transition fluide `motion.div` width animé (Framer Motion)

### Badges live
- [x] **1.7** Badge rouge sur "Commandes" : commandes `pending` via Supabase realtime
- [x] **1.8** Badge sur "Messages" : conversations `open`
- [x] **1.9** Badge sur "Livraisons" : orders `processing/shipped`

### Visuel
- [x] **1.10** Indicateur actif : gradient indigo/purple + icône colorée
- [x] **1.11** `whileTap` scale animé sur chaque item
- [x] **1.12** Section labels masqués en mode collapsed

---

## 🔍 ÉTAPE 2 — Header : recherche globale (Cmd+K)

- [x] **2.1** Bouton "Rechercher…" dans le header avec hint `⌘K`
- [x] **2.2** Raccourci clavier `Cmd+K` / `Ctrl+K` ouvre le modal
- [x] **2.3** Modal : input autofocus, backdrop blur
- [x] **2.4** Recherche dans titres + sections
- [x] **2.5** Résultats avec icône + titre + section + ArrowRight
- [x] **2.6** Fermeture avec `Escape`

---

## 🔔 ÉTAPE 3 — Header : panneau notifications

- [ ] **3.1** Cloche avec badge count (nb notifications non lues)
- [ ] **3.2** Panel slide-in depuis la droite au clic sur la cloche
- [ ] **3.3** Notifications : nouvelle commande, nouveau message, livraison mise à jour
- [ ] **3.4** Marquer comme lu au clic
- [ ] **3.5** "Tout marquer comme lu" en haut du panel
- [ ] **3.6** Notifications alimentées par Supabase realtime (`user_activity_logs` ou table dédiée)

---

## 📊 ÉTAPE 4 — Dashboard amélioré

- [ ] **4.1** KPI cards avec sparkline mini-chart (7 derniers jours)
- [ ] **4.2** Activité récente : flux live des dernières actions (commandes, inscriptions)
- [ ] **4.3** Top produits du jour avec barres de progression
- [ ] **4.4** Carte statut livraisons (donut : en attente / en cours / livrées / annulées)
- [ ] **4.5** Revenus par période : sélecteur Aujourd'hui / Semaine / Mois
- [ ] **4.6** Section "Actions rapides" : liens directs vers les tâches fréquentes

---

## 🧭 ÉTAPE 5 — UX global

- [x] **5.1** **Breadcrumbs** dans le header : Section › Page
- [ ] **5.2** **Scroll-to-top** bouton flottant apparaît après 300px de scroll
- [ ] **5.3** **Page transitions** : animation fade+slide entre routes (déjà partiel, améliorer)
- [ ] **5.4** **Empty states** uniformes sur toutes les pages (illustration + message + CTA)
- [ ] **5.5** **Loading skeletons** uniformes (remplacer les spinners isolés)
- [ ] **5.6** **Raccourcis clavier** : `G+D` → Dashboard, `G+O` → Orders, `G+U` → Users

---

## 🎨 ÉTAPE 6 — Finitions visuelles

- [x] **6.1** `document.title` dynamique selon la page courante (via `useEffect` dans Header)
- [ ] **6.2** **Mode sombre** toggle (classe `dark:` Tailwind, persisté localStorage)
- [ ] **6.3** Polices Inter déjà en place — vérifier le chargement (local vs CDN)
- [ ] **6.4** Micro-animations sur les boutons (scale + shadow au hover)
- [ ] **6.5** Couleurs de statut cohérentes sur toutes les pages (palette unifiée)

---

## 📋 Ordre d'exécution recommandé

| Priorité | Étape | Raison |
|----------|-------|--------|
| 🔴 Haute | 0 — Nettoyage main.jsx | Supprime les erreurs console MUI |
| 🔴 Haute | 1 — Sidebar collapsible + badges | Impact visuel majeur, gain d'espace |
| 🔴 Haute | 2 — Recherche globale | UX très attendue sur admin |
| 🟠 Moyenne | 3 — Notifications | Nécessite table Supabase |
| 🟠 Moyenne | 4 — Dashboard | Valeur métier élevée |
| 🟡 Basse | 5 — UX global | Polish progressif |
| 🟡 Basse | 6 — Finitions visuelles | Mode sombre en dernier |

---

*Dernière mise à jour : 24 février 2026*
