# Pistes d'amélioration — application cliente & application livreur (Flutter)

Contexte : le dépôt `ecommerce_client` contient **deux expériences** dans le même code :
- **Client** : point d'entrée `lib/main.dart`.
- **Livreur** : point d'entrée `lib/main_driver.dart`, sélectionné si `packageName` se termine par `.driver` (voir `lib/main.dart`).

Ce document liste des améliorations **priorisées** (sécurité, robustesse offline, conformité stores, UX, observabilité).

---

## Sécurité & configuration (priorité critique)

- **Retirer les secrets et defaults en dur** : `lib/main_driver.dart` embarque une valeur par défaut de `SUPABASE_ANON_KEY` / `SUPABASE_URL` via `String.fromEnvironment(..., defaultValue: ...)`. Même une clé « anon » doit être injectée par build (`--dart-define`) et **ne pas** être versionnée. Idem côté web Firebase dans `lib/main.dart` : éviter des `defaultValue` avec identifiants projet en clair.
- **Séparer configs par flavor** : fichiers `app_config_driver.dart` / `app_config_client.dart` + `flutter build ... --dart-define-from-file`.
- **Durcir RLS & surface API** : vérifier que les flux livreur n'exposent pas de colonnes sensibles (téléphone client, adresse complète) sans consentement / besoin opérationnel.
- **Jetons FCM** : rotation, révocation à la déconnexion, et stockage secure (Keychain/Keystore) si nécessaire.

---

## Fiabilité réseau / Supabase

- **Politique de retry avec backoff** sur lectures critiques (commandes, chat) + file d'attente locale pour actions « intents » (ex: changement statut) quand réseau indisponible.
- **Gestion des timeouts** et messages utilisateur explicites (au lieu d'écrans vides / spinners infinis).
- **Mode dégradé** : cache des listes produits / commandes avec `shared_preferences` + horodatage de fraîcheur.

---

## Géolocalisation & tâches en arrière-plan (livreur)

- **Compliance OS** : Android 10+ / iOS foreground service — vérifier wording des permissions, limitation de tracking hors mission, et économie batterie (intervalles adaptatifs).
- **États mission** : lier précisément le tracking GPS à une commande « active » (éviter l'écriture continue si aucune livraison en cours).
- **Résilience `driver_locations`** : stratégie si upsert échoue (buffer + flush).

---

## Notifications (client + livreur)

- **Canalisation unique** : garantir qu'un même type d'événement ne crée pas doubles notifications (local + push + in-app) sans règles.
- **Deep links** : ouvrir l'écran exact (commande, chat, suivi) depuis la notification.
- **Préférences utilisateur** : écran réglages par catégorie (promo, commande, message).

---

## UX / produit

- **Statuts & langues** : harmoniser l'affichage des statuts (FR côté admin + apps) — mapping centralisé côté client/driver pour éviter les codes bruts.
- **Accessibilité** : tailles de touch targets, contrastes, lecteurs d'écran sur écrans clés (checkout, suivi).
- **Performance listes** : pagination infinie + skeletons ; réduire `select('*')` quand possible.

---

## Qualité logicielle

- **Tests** : widget tests sur flows critiques (login, panier, paiement simulé) ; integration tests sur flux livreur (assignation → statut livré).
- **Analyse statique** : `dart analyze` en CI, `very_good_analysis` ou règles custom (interdire `defaultValue` secrets).
- **Feature flags** : activer/désactiver Stripe, FCM, tracking selon build.

---

## Builds Android (APK) avec `dart_defines`

Les flavors sont définis dans `android/app/build.gradle.kts` (`client` / `driver`).

1. Copier [`dart_defines.example.json`](../dart_defines.example.json) vers `dart_defines.json` à la racine du dépôt (fichier ignoré par git) et renseigner les clés.
2. **APK client** : `flutter build apk --flavor client -t lib/main.dart --dart-define-from-file=dart_defines.json`
3. **APK livreur** : `flutter build apk --flavor driver -t lib/main_driver.dart --dart-define-from-file=dart_defines.json`
4. En cas d'erreur `PathExistsException` sur `driverRelease`, utilisez le script robuste:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\build_driver_release.ps1 -DefinesFile dart_defines.json`
   - Le script nettoie les artefacts `driverRelease`, relance `flutter clean`, puis reconstruit avec la bonne cible `lib/main_driver.dart`.

Les sorties se trouvent sous `build/app/outputs/flutter-apk/`.

---

## Observabilité

- **Télémétrie** : erreurs + latence Supabase + « funnel » commande (événements anonymisés).
- **Journalisation contrôlée** : éviter logs avec PII en production ; niveaux debug vérouillés.

---

## Alignement avec l'admin web (`admin_gba`)

- Même vocabulaire de statuts commande / livraison entre **admin**, **client**, **livreur**.
- Webhooks / triggers : lorsqu'une commande passe à `shipped`, notifier livreur + client de façon cohérente.

