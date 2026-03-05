import 'package:flutter/material.dart';

import 'app_localizations.dart';

/// Extension pour accéder rapidement aux traductions depuis [BuildContext].
/// Utiliser [tr] pour une clé simple et [trParams] pour une clé avec paramètres.
/// L'UI se reconstruit automatiquement quand la locale change (contexte sous
/// [Localizations]).
extension AppLocalizationsExtension on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);

  /// Traduit une clé. Équivalent à `AppLocalizations.of(context).translate(key)`.
  String tr(String key) => l10n.translate(key);

  /// Traduit une clé avec paramètres. Équivalent à
  /// `AppLocalizations.of(context).translateParams(key, params)`.
  String trParams(String key, Map<String, String> params) =>
      l10n.translateParams(key, params);
}
