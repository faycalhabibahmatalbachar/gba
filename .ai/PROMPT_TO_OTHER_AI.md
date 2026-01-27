# Prompt à donner à l'autre AI (à exécuter dans ce repo)

## Contexte
Tu travailles dans le repository `gba`. Nous collaborons à deux IA (ou plus) sur le même codebase.
Objectif: collaboration **quasi temps réel** sans copier/coller, en utilisant le repo comme canal de synchronisation.

## ACTION IMMÉDIATE (obligatoire)
1) Ouvre et lis `./.ai/PROTOCOL.md`.
2) Choisis un identifiant stable `AGENT_ID` (exemples: `AI_RECSYS_BACKEND`, `AI_MOBILE_FLUTTER`, `AI_ADMIN_REACT`).
3) Crée ton journal: `./.ai/updates/<AGENT_ID>.md` si absent.
4) Avant chaque changement de code:
   - Lis tous les fichiers `./.ai/claims/*.md`.
   - Lis `./.ai/updates/AI_CASCADE.md` et les updates des autres agents.

## RÈGLES DE COLLABORATION (non négociables)
- **Pas de travail “fantôme”**: tu ne démarres jamais une tâche sans créer un claim dans `./.ai/claims/`.
- **Anti-conflit fichiers**: tu ne modifies pas un fichier listé dans un claim `in_progress` d'un autre agent.
- **Communication continue**: après chaque étape significative (implémentation, bugfix, tests, commit), tu ajoutes un update dans ton journal.
- **Toujours une bonne nouvelle**: chaque update doit contenir au moins un point concret validé (ex: test OK, bug identifié, fix mergé, perf améliorée).

## FORMAT OBLIGATOIRE D'UPDATE
Ajoute ce bloc dans `./.ai/updates/<AGENT_ID>.md` (append-only):

---
### Update <YYYY-MM-DD HH:MM>
Good news:
- 
Changements:
- 
Tests / Build:
- Commandes exécutées:
- Résultats:
Bugs / Risques:
- 
Idées (backlog):
- 
Next:
- 
---

## CLAIM DE TÂCHE (obligatoire)
Crée un fichier:
- `./.ai/claims/<TASK_ID>__<slug>.md`

Template minimal:
- Owner: <AGENT_ID>
- Status: in_progress | blocked | done
- Scope: backend | flutter | admin | data
- Files (prévu):
  - <liste>
- Branch (si Git): <nom>
- Definition of Done:
  - <critère 1>
  - <critère 2>
  - <critère 3>

## BUG TICKETS (si bug)
Si tu détectes un bug, crée:
- `./.ai/bugs/BUG-<YYYYMMDD>-<short>.md`

Contenu:
- Symptômes
- Étapes reproduction
- Attendu / obtenu
- Zone suspecte (fichiers)
- Root cause (hypothèse puis confirmée)
- Fix (résumé)
- Preuves (logs/tests)

## OUTILS / CI / TESTS (qui exécute quoi)
### Objectif
On veut un système qui:
- détecte automatiquement les bugs (lint/tests)
- évite les régressions
- rend les changements vérifiables

### Rôles recommandés (si 2 agents)
- **Toi (Implémentation)**: tu codes la feature ou le bugfix principal.
- **AI_CASCADE (Validation/Qualité)**: review, edge cases, tests, stabilité API, instrumentation.

### Commandes de validation (à exécuter selon scope)
- Backend (FastAPI):
  - au minimum: lancer une vérification import/compile + lancer l'app si possible
  - si lint/format présent: exécuter aussi
- Flutter:
  - `flutter analyze`
  - `flutter test` (si tests existants)
- Admin React:
  - `npm run build` (ou équivalent)

Dans chaque update, indique exactement quelles commandes tu as exécutées.

## SYSTÈME DE DÉCOUPAGE DES TÂCHES (spécifique RecoSys GBA)
### Contexte technique (déjà en place)
- Backend: `backend/app.py` expose `GET /v1/recommendations` (algo actuel: `v3_affinity_cooccurrence`).
- Flutter: `RecommendationService` consomme l'endpoint et `ActivityTrackingService` produit les événements `user_activities`.

### Répartition initiale conseillée (pour éviter conflits)
- Tâche A (Toi): Algo & Data
  - améliorer scoring/diversification
  - clarifier tables `top_viewed_products` / `product_similar_products`
  - gérer cold-start proprement
- Tâche B (AI_CASCADE): Robustesse & Qualité
  - durcir erreurs/auth/timeouts
  - définir tests minimaux + instrumentation
  - préparer CI/CD (workflow)

### Si on travaille sur la même tâche (mode Driver/Navigator)
- 1 seul agent = **Driver** (écrit le code)
- l'autre = **Navigator** (review/stratégie)
- Le Driver est l'unique auteur des modifications sur les fichiers réservés.

## RÈGLE ANTI-DUPLICATION
Avant de commencer une nouvelle action:
- vérifier claims existants
- si un claim similaire existe: ajouter un commentaire dans ton update + demander alignement (sans modifier les fichiers du claim)

## OBJECTIF DE CHAQUE ÉCHANGE
À chaque message/update:
- donner une **bonne nouvelle** (concret)
- proposer au moins **1 idée** (petite amélioration) OU **1 correctif**
- si bug trouvé: créer un bug ticket + proposer fix

## DÉMARRAGE MAINTENANT
1) Crée ton `AGENT_ID`.
2) Crée un claim `RECSYS-XXX`.
3) Écris ton premier update.
