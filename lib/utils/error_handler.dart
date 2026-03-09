import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';

/// Utility class to sanitize error messages and hide sensitive URLs
class ErrorHandler {
  /// Sanitizes error messages to hide Supabase URLs and sensitive information
  static String sanitizeError(dynamic error, {String? fallbackMessage}) {
    if (error == null) return fallbackMessage ?? 'Une erreur est survenue';

    String errorMessage = error.toString();

    // Check for network/connection errors
    if (errorMessage.contains('SocketException') || 
        errorMessage.contains('Failed host lookup') ||
        errorMessage.contains('No address associated with hostname')) {
      return 'Erreur de connexion. Vérifiez votre connexion internet.';
    }

    // Check for Supabase/Postgrest errors
    if (error is PostgrestException) {
      return _sanitizePostgrestError(error);
    }

    // Check for ClientException with Supabase URLs
    if (errorMessage.contains('.supabase.co')) {
      // Remove the URL completely
      errorMessage = errorMessage.replaceAll(
        RegExp(r'https?://[a-zA-Z0-9-]+\.supabase\.co[^\s]*'),
        '[URL masquée]'
      );
      
      // If it's a connection error, return generic message
      if (errorMessage.contains('ClientException')) {
        return 'Erreur de connexion. Vérifiez votre connexion internet.';
      }
    }

    // Remove any remaining URLs
    errorMessage = errorMessage.replaceAll(
      RegExp(r'https?://[^\s]+'),
      '[URL masquée]'
    );

    // Remove technical stack traces in production
    if (kReleaseMode) {
      errorMessage = errorMessage.split('\n').first;
    }

    return errorMessage.isEmpty 
        ? (fallbackMessage ?? 'Une erreur est survenue') 
        : errorMessage;
  }

  static String _sanitizePostgrestError(PostgrestException error) {
    final code = error.code;
    final message = error.message;

    // Map common error codes to user-friendly messages
    switch (code) {
      case '42P01': // relation does not exist
        return 'Erreur de base de données. Veuillez réessayer plus tard.';
      case '23505': // unique violation
        return 'Cette donnée existe déjà.';
      case '23503': // foreign key violation
        return 'Opération impossible. Données liées manquantes.';
      case '42501': // insufficient privilege
        return 'Vous n\'avez pas les permissions nécessaires.';
      case 'PGRST301': // JWT expired
        return 'Session expirée. Veuillez vous reconnecter.';
      default:
        // Return sanitized message without technical details
        if (message.contains('.supabase.co')) {
          return 'Erreur de base de données. Veuillez réessayer.';
        }
        return message.split('\n').first;
    }
  }

  /// Checks if an error is a network connectivity issue
  static bool isNetworkError(dynamic error) {
    if (error == null) return false;
    
    final errorString = error.toString();
    return errorString.contains('SocketException') ||
           errorString.contains('Failed host lookup') ||
           errorString.contains('No address associated with hostname') ||
           errorString.contains('Network is unreachable') ||
           errorString.contains('Connection refused') ||
           errorString.contains('Connection timed out');
  }

  /// Checks if an error is a database/server error
  static bool isDatabaseError(dynamic error) {
    return error is PostgrestException || 
           error.toString().contains('PostgrestException');
  }

  /// Gets a localized error message based on error type
  static String getLocalizedError(dynamic error, String languageCode) {
    if (isNetworkError(error)) {
      switch (languageCode) {
        case 'ar':
          return 'خطأ في الاتصال. تحقق من اتصالك بالإنترنت.';
        case 'en':
          return 'Connection error. Check your internet connection.';
        case 'fr':
        default:
          return 'Erreur de connexion. Vérifiez votre connexion internet.';
      }
    }

    if (isDatabaseError(error)) {
      switch (languageCode) {
        case 'ar':
          return 'خطأ في قاعدة البيانات. يرجى المحاولة مرة أخرى.';
        case 'en':
          return 'Database error. Please try again.';
        case 'fr':
        default:
          return 'Erreur de base de données. Veuillez réessayer.';
      }
    }

    return sanitizeError(error);
  }
}
