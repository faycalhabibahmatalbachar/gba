# GBA Stabilisation Execution Playbook

## Contexte

Ce playbook orchestre la stabilisation mobile (`client`, `driver`) et web (`admin_gba`) avec une cadence livrable en production, des smoke tests répétables, et un rollback clair.

## Objectifs mesurables

1. **Build driver fiable**: `flutter build apk --flavor driver -t lib/main_driver.dart` passe sans `PathExistsException`.
2. **Auth/reset fiable**: signup/login/reset fonctionnels, erreurs FR lisibles, aucun message corrompu.
3. **Audio chat fiable**: upload vocal et lecture client/driver (play/pause) sans rendu image cassée.
4. **Offline UX propre**: pas d'URL Supabase affichée, écran no-internet sur flux critiques.
5. **Navigation retour cohérente**: retour Android suit le flux applicatif avant sortie.
6. **Admin enrichi**: dashboard inclut `user_behavior` réel, top produits ouvrables.
7. **Industrialisation**: pipeline CI `quality-gate` active (admin build/typecheck + flutter analyze/build smoke).

## Checklist d'acceptation

- [ ] Mobile client: inscription + connexion + oubli mot de passe.
- [ ] Mobile client: hors ligne sur catégories/panier/favoris -> message no internet.
- [ ] Mobile client: chat vocal lecture OK.
- [ ] Mobile driver: chat vocal lecture OK.
- [ ] Mobile driver: build APK flavor `driver` réussi.
- [ ] Admin: `/reset-password` accessible et opérationnel.
- [ ] Admin dashboard: bloc `Evenements (user_behavior)` alimenté.
- [ ] Admin dashboard: top produits ouvre la fiche produit.
- [ ] CI: workflow `quality-gate` vert sur PR.

## Commandes build/test

```bash
# Flutter
flutter pub get
dart analyze
powershell -ExecutionPolicy Bypass -File .\scripts\build_client_release.ps1 -DefinesFile dart_defines.json
powershell -ExecutionPolicy Bypass -File .\scripts\build_driver_release.ps1 -DefinesFile dart_defines.json
# Équivalent manuel client : flutter build apk --flavor client -t lib/main.dart --dart-define-from-file=dart_defines.json

# Admin
cd admin_gba
npm ci
npm run build
npx tsc --noEmit
```

## Rollback plan

1. Revenir au dernier commit stable (`git revert <sha>` ou redeploy Vercel précédent).
2. Désactiver temporairement les changements non critiques dashboard/realtime.
3. Restaurer build mobile sur artefacts APK précédents validés.
4. Vérifier auth/reset en priorité avant réouverture trafic.

## Prompt d'exécution recommandé

```text
Tu es l’agent principal de stabilisation GBA. Exécute en priorité les correctifs bloquants: (1) build APK driver sans PathExistsException, (2) reset password client/admin fully working avec redirect fiable mobile+web, (3) login/register erreurs propres FR sans texte corrompu, (4) audio chat client+driver upload+playback avec replay et vitesse, (5) UX offline sans URL Supabase affichée, (6) back navigation téléphone cohérente. Ensuite implémente user_behavior réel dans admin, dashboard modernisé, top produits cliquable, et optimisation drivers live. Après chaque lot: typecheck/lint/build/tests smoke, puis journal de changements et risques restants. Ne pas s’arrêter sans proposer correctifs additionnels détectés.
```
