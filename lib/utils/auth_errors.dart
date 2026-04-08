import 'package:supabase_flutter/supabase_flutter.dart';

/// Basic RFC‑5322‑style check (practical, not exhaustive).
final RegExp kReasonableEmailRegex = RegExp(
  r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$',
);

bool _looksLikeGarbledUtf16Bug(String s) {
  final lower = s.toLowerCase();
  return lower.contains('smail') ||
      lower.contains('adaress') ||
      lower.contains('tormat');
}

/// Maps Supabase / GoTrue errors to clear French messages for end users.
String localizeAuthError(
  Object error, {
  String? fallback,
}) {
  if (error is AuthApiException) {
    final code = error.code?.toLowerCase().trim();
    final raw = error.message.trim();

    if (code == 'email_address_invalid' || code == 'validation_failed') {
      if (_looksLikeGarbledUtf16Bug(raw) || raw.length < 8) {
        return 'Adresse e-mail invalide. Verifiez le format (ex. prenom@domaine.com) et supprimez les espaces.';
      }
      return 'Adresse e-mail invalide ou non acceptee. Verifiez la syntaxe et reessayez.';
    }
    if (code == 'user_already_registered' || code == 'signup_disabled') {
      return 'Cette adresse e-mail est deja utilisee ou les inscriptions sont desactivees.';
    }
    if (code == 'weak_password') {
      return 'Mot de passe trop faible. Utilisez au moins 8 caracteres avec lettres et chiffres.';
    }
    if (code == 'over_request_rate_limit') {
      return 'Trop de tentatives. Patientez quelques minutes avant de reessayer.';
    }
    if (_looksLikeGarbledUtf16Bug(raw)) {
      return fallback ??
          'Une erreur d\'authentification s\'est produite. Verifiez vos informations et reessayez.';
    }
    if (raw.isNotEmpty) return raw;
  }
  if (error is AuthException) {
    final m = error.message.trim();
    if (_looksLikeGarbledUtf16Bug(m)) {
      return fallback ??
          'Une erreur d\'authentification s\'est produite. Verifiez vos informations et reessayez.';
    }
    if (m.isNotEmpty) return m;
  }
  return fallback ?? 'Une erreur s\'est produite. Reessayez.';
}

String? validateSignupEmail(String? value) {
  final v = value?.trim() ?? '';
  if (v.isEmpty) return null;
  final cleaned = v.replaceAll(RegExp(r'[\u200B-\u200D\uFEFF]'), '').toLowerCase();
  if (!kReasonableEmailRegex.hasMatch(cleaned)) {
    return 'Format d\'e-mail invalide.';
  }
  return null;
}
