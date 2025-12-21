class AppConfig {
  static const String _envSupabaseUrl =
      String.fromEnvironment('SUPABASE_URL');
  static const String _envSupabaseAnonKey =
      String.fromEnvironment('SUPABASE_ANON_KEY');

  static const String _fallbackSupabaseUrl =
      'https://uvlrgwdbjegoavjfdrzb.supabase.co';
  static const String _fallbackSupabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bHJnd2RiamVnb2F2amZkcnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzI3ODYsImV4cCI6MjA3MTgwODc4Nn0.ZuMcEKbCKo5CtQGdn2KAHqHfBdROpvtLp7nJpJSHOUQ';

  static String get supabaseUrl =>
      _envSupabaseUrl.isNotEmpty ? _envSupabaseUrl : _fallbackSupabaseUrl;

  static String get supabaseAnonKey => _envSupabaseAnonKey.isNotEmpty
      ? _envSupabaseAnonKey
      : _fallbackSupabaseAnonKey;
}
