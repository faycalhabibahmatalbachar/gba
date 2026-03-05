# Plan d'amélioration multi-langue – App mobile client GBA

## Contexte et objectifs

L’application cliente est censée être en français par défaut, mais une grande partie de l’interface s’affiche en anglais. On constate aussi des clés de traduction affichées en lieu de texte, des incohérences entre écrans et une fiabilité limitée lors des changements de langue ou de navigation.

**Objectifs :**

- Avoir une interface cohérente en français (et anglais/arabe) sans affichage de clés.
- Garantir que le changement de langue et la navigation ne cassent pas l’affichage des traductions.
- Centraliser et fiabiliser la logique i18n (une seule source de vérité, fallbacks clairs).

---

## 1. Diagnostic identifié

### 1.1 Cartes de traduction incomplètes

- **Anglais** : ~350 clés dans `_englishTranslations` (référence).
- **Français** : ~100 clés dans `_frenchTranslations` → **~250 clés manquantes**.
- **Arabe** : encore moins de clés.

Comportement actuel : pour la locale `fr`, `translate(key)` cherche d’abord dans `_frenchTranslations`. Si la clé est absente, fallback sur `_englishTranslations`, donc **affichage en anglais**. D’où l’impression « l’app est en français mais tout s’affiche en anglais ».

### 1.2 Clés affichées en brut

- Certaines clés (ex. `access_blocked`, `account_suspended`, `suspension_reason`, `what_to_do_now`) sont utilisées via des getters dans `AppLocalizations` mais **absentes des trois cartes** → la méthode `translate()` renvoie la clé elle-même.
- Risque d’autres clés manquantes utilisées dans l’UI.

### 1.3 Chaînes en dur

- Présence de chaînes non passées par `translate()` (ex. « Bonjour », « Bon après-midi », « Bonsoir » dans `home_screen_premium.dart`), ce qui casse la cohérence multi-langue.

### 1.4 Locale au démarrage

- `LanguageProvider` charge la locale sauvegardée de façon **asynchrone** dans `_load()`. Le premier frame peut s’afficher avec la locale par défaut (fr) avant que les préférences soient lues, ou avec un décalage si le device est en anglais.

### 1.5 Navigation et cohérence

- `MaterialApp.router` utilise bien `locale: languageProvider.locale` et les `localizationsDelegates`. Aucun `localeResolutionCallback` n’est défini pour les locales non supportées ou partielles (ex. `fr_CA`).
- Le délégué `AppLocalizations` utilise `shouldReload => false`, ce qui est correct pour Flutter : le changement de locale déclenche déjà un nouveau `load(locale)`.

---

## 2. Plan d’action (implémenté)

### 2.1 Compléter les traductions françaises

- **Action** : Ajouter dans `_frenchTranslations` **toutes** les clés présentes dans `_englishTranslations`, avec des traductions françaises.
- **Résultat** : En locale `fr`, plus de fallback systématique sur l’anglais pour les écrans principaux (accueil, catégories, panier, commandes, profil, paramètres, etc.).

### 2.2 Compléter les traductions arabes

- **Action** : Même principe pour `_arabicTranslations` : toute clé utilisée dans l’app (au minimum celles de l’anglais) doit exister avec une traduction arabe.
- **Résultat** : Interface cohérente en arabe, avec fallback anglais uniquement pour d’éventuelles clés très récentes.

### 2.3 Clés manquantes utilisées par les getters

- **Action** : Ajouter les clés `access_blocked`, `account_suspended`, `suspension_reason`, `what_to_do_now` (et toute autre utilisée par les getters) dans les trois cartes (en, fr, ar).
- **Résultat** : Plus d’affichage de clés brutes pour les écrans de blocage / suspension.

### 2.4 Fiabiliser le chargement de la locale au démarrage

- **Action** :
  - S’assurer que la locale par défaut est `fr` et que, au premier lancement, l’UI utilise bien cette valeur.
  - Conserver le chargement asynchrone des préférences mais éviter un « flash » incohérent (ex. afficher un splash ou ne pas reconstruire l’arbre avec une locale vide).
- **Option** : Dans `LanguageProvider`, initialiser `_locale` à `const Locale('fr', '')` et ne notifier qu’après `_load()` si la valeur a vraiment changé (déjà partiellement le cas ; vérifier que le premier build utilise bien `fr`).

### 2.5 Résolution de locale et fallback

- **Action** : Ajouter un `localeResolutionCallback` sur `MaterialApp.router` pour :
  - Choisir une locale supportée (`fr`, `en`, `ar`) à partir de la locale device (ex. `fr_CA` → `fr`, `en_US` → `en`).
  - Définir un fallback explicite (ex. `fr`) si aucune correspondance.
- **Résultat** : Comportement prévisible sur tous les devices et pas de locale « inconnue » qui ferait tout afficher en anglais.

### 2.6 Extension `context.tr()` (optionnel mais recommandé)

- **Action** : Créer une extension sur `BuildContext` du type `String tr(String key, [Map<String, String>? params])` qui appelle `AppLocalizations.of(context).translate(key)` ou `translateParams(key, params)`. Utiliser `tr()` dans les nouveaux écrans pour un accès court et cohérent.
- **Résultat** : Code plus lisible et un seul point d’appel pour les traductions (reconstruction automatique quand le contexte a la bonne locale).

### 2.7 Remplacer les chaînes en dur

- **Action** : Repérer les chaînes visibles par l’utilisateur (ex. « Bonjour », « Bon après-midi », « Bonsoir ») et les remplacer par des clés + `translate()` (ou `context.tr()`).
- **Résultat** : Tous les textes dépendent des cartes de traduction ; cohérence et maintenabilité.

### 2.8 Audit des clés manquantes (I18nAudit)

- **Action** : Garder (ou activer en debug) le mécanisme `I18nAudit` existant pour détecter les clés manquantes par locale. Optionnel : lancer une fois un parcours des écrans principaux avec `I18N_AUDIT=true` et corriger les clés remontées.
- **Résultat** : Détection précoce des régressions i18n.

---

## 3. Bonnes pratiques (référence)

- **Une seule source de vérité** : l’anglais comme carte de référence ; français et arabe contiennent au minimum les mêmes clés.
- **Pas de chaîne en dur** côté UI : tout texte affiché passe par `translate` / `tr`.
- **Fallback** : toujours `_englishTranslations[key] ?? key` en dernier recours pour ne jamais afficher une clé brute en production si la clé existe en anglais.
- **Placeholders** : utiliser `translateParams(key, {'name': value})` pour les messages avec variables (ex. « {name} added to cart »).
- **Locale** : `MaterialApp` reçoit la locale du `LanguageProvider` ; au changement de langue, `notifyListeners()` assure la reconstruction et le bon `AppLocalizations` pour la nouvelle locale.

---

## 4. Fichiers impactés

| Fichier | Modifications |
|--------|----------------|
| `lib/localization/app_localizations.dart` | Compléter `_frenchTranslations` et `_arabicTranslations`, ajouter clés manquantes (access_blocked, etc.) |
| `lib/providers/language_provider.dart` | Vérifier initialisation et chargement async pour éviter flash de mauvaise locale |
| `lib/main.dart` | Ajouter `localeResolutionCallback` sur `MaterialApp.router` |
| `lib/screens/home_screen_premium.dart` | Remplacer « Bonjour » / « Bon après-midi » / « Bonsoir » par des clés + translate |
| `lib/localization/app_localizations_extension.dart` | Extension `context.tr(key)` et `context.trParams(key, params)` (créé) |

---

## 5. Critères de succès

- En français : aucun libellé principal (navigation, menus, écrans principaux) ne s’affiche en anglais ni en clé brute.
- En arabe : même exigence pour les clés déjà utilisées dans l’app.
- Changement de langue dans les paramètres : toute l’UI se met à jour sans redémarrage.
- Navigation entre onglets/écrans : les libellés restent cohérents avec la locale courante.
- Premier lancement (sans préférence sauvegardée) : interface en français par défaut, ou en locale device si supportée (fr/en/ar).

Ce plan a été rédigé puis implémenté dans le dépôt pour fiabiliser le multi-langue de l’app mobile client.
