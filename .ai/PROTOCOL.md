# Protocole de collaboration Multi-AI (RepoSync v1)

## Objectif
Permettre une collaboration "quasi temps réel" entre plusieurs assistants IA dans le même repository, sans copier/coller, en utilisant le repo comme bus de communication.

## Règles non négociables
- Une IA ne démarre jamais une tâche sans l'avoir "claim" (voir section Tâches).
- Une IA ne modifie jamais un fichier déjà "réservé" par une autre IA (voir section Réservations), sauf accord explicite écrit.
- Après chaque étape significative (commit, tests, fix), l'IA écrit un update dans son journal.
- Chaque update doit contenir: ce qui a été fait, ce qui est validé (tests), et le prochain pas.

## Structure des fichiers (répertoire .ai)
- `.ai/PROTOCOL.md` : ce document (stable, rarement modifié)
- `.ai/updates/<AGENT_ID>.md` : journal append-only de chaque IA (un fichier par IA)
- `.ai/claims/` : fichiers de claim de tâches (un fichier par tâche)
- `.ai/bugs/` : tickets bugs (un fichier par bug)

## Identité (AGENT_ID)
Chaque IA choisit un identifiant stable, par exemple:
- `AI_RECSYS_BACKEND`
- `AI_MOBILE_FLUTTER`
- `AI_ADMIN_REACT`

## Tâches (claim)
Pour prendre une tâche, créer un fichier:
- `.ai/claims/<TASK_ID>__<slug>.md`

Contenu minimal:
- Owner: <AGENT_ID>
- Status: in_progress | blocked | done
- Scope: backend | flutter | admin | data
- Files (prévu): liste des fichiers touchés
- Branch (si Git): nom de branche
- Definition of Done: 2-5 critères

Changer le `Status` à chaque étape.

## Réservations de fichiers (anti-conflit)
Dans chaque claim, maintenir la liste `Files (prévu)`.
- Si un fichier est listé dans un claim `in_progress` d'une autre IA: ne pas l'éditer.
- Si c'est nécessaire: ouvrir une demande dans le journal de l'autre IA (ou dans son claim) et attendre accord.

## Journal d'updates (communication)
Chaque IA écrit uniquement dans son propre fichier:
- `.ai/updates/<AGENT_ID>.md`

Format obligatoire (copier/coller ce bloc):

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

## Gestion des bugs (auto-identification)
Créer un ticket:
- `.ai/bugs/BUG-<YYYYMMDD>-<short>.md`

Template:
- Symptômes:
- Étapes de reproduction:
- Résultat attendu / obtenu:
- Zone suspecte (fichiers):
- Root cause (hypothèse puis confirmée):
- Fix (résumé):
- Preuves (logs/tests):

## Tests et qualité (minimum)
Avant de marquer une tâche `done`, exécuter au moins:
- Backend (FastAPI): lint/format si configuré + au minimum import/compile (et tests si présents)
- Flutter: `flutter analyze` + `flutter test` (si possible)
- Admin React: `npm run build` (ou équivalent)

## Stratégie Git recommandée
- Branches courtes, une feature par branche.
- Petites PR, merges fréquents.
- Un agent "Driver" implémente, l'autre "Navigator" review/valide.

