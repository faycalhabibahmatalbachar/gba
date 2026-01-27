class AppConfig {
  static const String _envSupabaseUrl =
      String.fromEnvironment('SUPABASE_URL');
  static const String _envSupabaseAnonKey =
      String.fromEnvironment('SUPABASE_ANON_KEY');

  static const String _envSiteUrl = String.fromEnvironment('SITE_URL');

  static const String _envBackendUrl = String.fromEnvironment('BACKEND_URL');

  static const String _envFirebaseVapidKey =
      String.fromEnvironment('FIREBASE_VAPID_KEY');

  static const String _fallbackSupabaseUrl =
      'https://uvlrgwdbjegoavjfdrzb.supabase.co';
  static const String _fallbackSupabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bHJnd2RiamVnb2F2amZkcnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzI3ODYsImV4cCI6MjA3MTgwODc4Nn0.ZuMcEKbCKo5CtQGdn2KAHqHfBdROpvtLp7nJpJSHOUQ';

  static const String _fallbackFirebaseVapidKey =
      'BDdYuPBqR6VbwiyiT1xPR4NglaIJo2JUQdgYTxwFpiPatYVDdlWqlDUtz-65ChmnMQ_oeWcAcL9FRF4FdxKDjvw';

  static const String _fallbackSiteUrl = 'http://localhost:8080';

  static const String _fallbackBackendUrl = 'http://localhost:8000';

  static String get supabaseUrl =>
      _envSupabaseUrl.isNotEmpty ? _envSupabaseUrl : _fallbackSupabaseUrl;

  static String get supabaseAnonKey => _envSupabaseAnonKey.isNotEmpty
      ? _envSupabaseAnonKey
      : _fallbackSupabaseAnonKey;

  static String get firebaseVapidKey => _envFirebaseVapidKey.isNotEmpty
      ? _envFirebaseVapidKey
      : _fallbackFirebaseVapidKey;

  static String get siteUrl => _envSiteUrl.isNotEmpty ? _envSiteUrl : _fallbackSiteUrl;

  static String get backendUrl {
    final raw = _envBackendUrl.isNotEmpty ? _envBackendUrl : _fallbackBackendUrl;
    final value = raw.trim();
    if (value.endsWith('/')) {
      return value.substring(0, value.length - 1);
    }
    return value;
  }
}
