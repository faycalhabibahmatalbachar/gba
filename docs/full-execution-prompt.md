# Prompt d’exécution complète — GBA (admin Next.js + app Flutter)

Copiez le bloc **PROMPT** ci-dessous dans une nouvelle session agent. Exigez des **commits atomiques** par domaine et **aucune réponse partielle** : chaque item doit être implémenté, testé (commandes indiquées) ou documenté comme bloqué avec cause et prochaine action.

---

## PROMPT (à coller)

Tu es un agent senior sur le monorepo **GBA** : `admin_gba` (Next.js, Supabase service role, API routes) et racine **Flutter** (`lib/`, `pubspec.yaml`). Objectif : corriger et livrer **tout** le périmètre suivant **sans solution partielle**.

### Règles

- Ne pas inventer de colonnes DB : vérifier schémas / migrations / types générés avant de filtrer ou sélectionner.
- **Pas de secrets** dans le code : Gmail / SMTP via variables d’environnement uniquement ; documenter `.env.example`.
- **i18n** : tout texte utilisateur en **fr**, **en**, **ar** (fichiers ARB ou équivalent du projet).
- **Erreurs réseau** : ne jamais afficher d’URL brute (Supabase, stack) à l’utilisateur ; utiliser un widget/message unique cohérent.
- Après chaque groupe de changements : lancer les checks listés dans « Vérification ».

### 1) Admin — messagerie / stockage

- Route `POST /api/messages/upload` : aligner les buckets sur le mobile (**bucket `chat` en priorité**), création bucket si absent, erreurs 500 explicites.
- Vérifier cohérence des chemins avec les URLs `public/chat/...` côté client.

### 2) Admin — commandes `/api/orders` et UI `/orders`

- Filtres **commande standard** / **commande spéciale** : filtres PostgREST **null-safe** (notes/metadata nuls), pagination et `count` cohérents ; pas de filtrage post-page qui vide les pages.
- Affichage distinct des commandes spéciales (badge / libellé) quand le filtre « toutes » est actif.
- Corriger l’appel `profiles` (400) si rôles invalides (`driver` vs `livreur`) — aligner sur le schéma réel.

### 3) Mobile — checkout

- Après succès : **une seule** commande par flux ; **verrou** anti double tap ; vider le panier et **rafraîchir l’UI** ; masquer le bouton confirmer ; navigation sûre (pas d’écran noir au retour).

### 4) Mobile — commande spéciale

- Corriger la validation multi-étapes (pas de `Form` qui valide des champs non montés → faux « champs obligatoires »).
- GPS / champs requis : messages **FR / EN / AR** ; supprimer clés i18n affichées en dur (`special_order_summary_description`, `no_internet`, etc.) — ajouter les entrées manquantes dans les ARB.
- Aligner la logique métier avec l’admin (statuts, flags spéciaux visibles côté admin).

### 5) Mobile — hors ligne global

- Un seul **widget / écran** « pas de connexion » réutilisable sur : accueil, catégories, panier, favoris, profil, messages, promotions, commandes, commande spéciale, détail produit.
- Jamais d’URI ou de `ClientException` brute pour l’utilisateur.

### 6) Mobile — navigation

- Corriger crash / écran noir : retour app bar et **retour système Android** depuis paramètres, checkout, favoris, panier, contact (GoRouter / `pop` / `canPop`).

### 7) Mobile — notifications

- Messages vocaux / images : notification avec **type média** (icône audio / aperçu image), **pas** d’URL Supabase en texte.
- Supprimer la notification persistante indésirable **« Services en cours »** (ou équivalent).

### 8) Email admin (nouveau système)

- Envoi depuis SMTP Gmail (compte admin configurable, ex. `globalbusinessamdaradir0@gmail.com` via **mot de passe d’application** en env).
- Templates pour : nouveau message, nouvelle commande, nouvelle commande spéciale, alerte sécurité (tentatives de connexion échouées avec détails : IP, user-agent, horodatage, identifiant visé).
- Déclencher depuis les points d’API / hooks pertinents (admin ou Edge Functions selon l’archi actuelle — **choisir une approche et l’implémenter**).

### Vérification (obligatoire)

- `admin_gba` : `npx tsc --noEmit` et `npm run build`.
- Flutter : `dart analyze` (ou `flutter analyze`) sur les fichiers touchés.
- Scénarios manuels : upload vocal admin, filtres commandes, checkout une fois, commande spéciale avec GPS off/on, mode avion sur 2–3 écrans, notification reçue.

### Livrables

- Code + mise à jour `docs/` si nouvelles variables env.
- Liste courte des fichiers modifiés et comportement attendu par feature.

---

## État déjà traité dans le dépôt (à ne pas refaire sans vérifier)

- `admin_gba/src/app/api/orders/route.ts` : filtres `kind` côté serveur (`or` spéciales, `not` + `or` null-safe pour standard), champ `metadata` dans les `select`, `count` aligné sur la requête filtrée.
- `admin_gba/src/app/api/messages/upload/route.ts` : bucket `chat` en tête de liste + création de bucket si « bucket not found ».
- `lib/screens/checkout/ultra_checkout_screen.dart` : flag `_checkoutSuccess`, garde panier vide, barre du bas retirée après succès, snackbar si panier non vidé.
