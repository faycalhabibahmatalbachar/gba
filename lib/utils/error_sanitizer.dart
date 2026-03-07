/// Utility to sanitize error messages by removing Supabase URLs and technical details
class ErrorSanitizer {
  /// Sanitize error message to hide Supabase URLs and technical details
  static String sanitize(String error) {
    String sanitized = error;
    
    // Remove Supabase URLs
    sanitized = sanitized.replaceAll(
      RegExp(r'https?://[^\s]+\.supabase\.co[^\s]*'),
      '[Serveur]',
    );
    
    // Remove PGRST error codes
    sanitized = sanitized.replaceAll(
      RegExp(r'PGRST\d+'),
      'Erreur serveur',
    );
    
    // Remove PostgreSQL error codes
    sanitized = sanitized.replaceAll(
      RegExp(r'ERROR:\s*\d+:'),
      'Erreur:',
    );
    
    // Remove technical stack traces
    sanitized = sanitized.replaceAll(
      RegExp(r'at\s+[\w\.]+\s*\([^\)]+\)', multiLine: true),
      '',
    );
    
    // Remove line numbers
    sanitized = sanitized.replaceAll(
      RegExp(r'LINE\s+\d+:'),
      '',
    );
    
    // Clean up multiple spaces
    sanitized = sanitized.replaceAll(RegExp(r'\s+'), ' ').trim();
    
    return sanitized;
  }
  
  /// Get user-friendly error message
  static String getUserFriendlyMessage(String error) {
    final sanitized = sanitize(error);
    
    // Common error patterns
    if (sanitized.contains('network') || sanitized.contains('fetch')) {
      return 'Erreur de connexion. Vérifiez votre internet.';
    }
    
    if (sanitized.contains('auth') || sanitized.contains('unauthorized')) {
      return 'Erreur d\'authentification. Reconnectez-vous.';
    }
    
    if (sanitized.contains('not found') || sanitized.contains('404')) {
      return 'Ressource introuvable.';
    }
    
    if (sanitized.contains('timeout')) {
      return 'Délai d\'attente dépassé. Réessayez.';
    }
    
    // Return sanitized error if no pattern matched
    return sanitized.isEmpty ? 'Une erreur est survenue.' : sanitized;
  }
}
