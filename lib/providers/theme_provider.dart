import 'package:flutter/material.dart';

class ThemeProvider extends ChangeNotifier {
  bool _isDarkMode = false;
  
  bool get isDarkMode => _isDarkMode;
  
  void toggleTheme() {
    _isDarkMode = !_isDarkMode;
    notifyListeners();
  }
}

// Thèmes personnalisés
class AppThemes {
  static ThemeData lightTheme = ThemeData(
    primaryColor: const Color(0xFF667eea),
    scaffoldBackgroundColor: const Color(0xFFF8F9FA),
    colorScheme: const ColorScheme.light(
      primary: Color(0xFF667eea),
      secondary: Color(0xFF764ba2),
      surface: Colors.white,
      background: Color(0xFFF8F9FA),
      error: Color(0xFFe74c3c),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: Color(0xFF2D3436),
      elevation: 0,
      titleTextStyle: TextStyle(
        color: Color(0xFF2D3436),
        fontSize: 20,
        fontWeight: FontWeight.w600,
      ),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFF667eea),
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      ),
    ),
    textTheme: const TextTheme(
      headlineLarge: TextStyle(
        color: Color(0xFF2D3436),
        fontSize: 32,
        fontWeight: FontWeight.bold,
      ),
      headlineMedium: TextStyle(
        color: Color(0xFF2D3436),
        fontSize: 24,
        fontWeight: FontWeight.w600,
      ),
      bodyLarge: TextStyle(
        color: Color(0xFF2D3436),
        fontSize: 16,
      ),
      bodyMedium: TextStyle(
        color: Color(0xFF636E72),
        fontSize: 14,
      ),
    ),
  );

  static ThemeData darkTheme = ThemeData(
    primaryColor: const Color(0xFF667eea),
    scaffoldBackgroundColor: const Color(0xFF1A1D21),
    colorScheme: const ColorScheme.dark(
      primary: Color(0xFF667eea),
      secondary: Color(0xFF764ba2),
      surface: Color(0xFF2C3036),
      background: Color(0xFF1A1D21),
      error: Color(0xFFe74c3c),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Color(0xFF2C3036),
      foregroundColor: Colors.white,
      elevation: 0,
      titleTextStyle: TextStyle(
        color: Colors.white,
        fontSize: 20,
        fontWeight: FontWeight.w600,
      ),
    ),
    cardTheme: CardThemeData(
      color: const Color(0xFF2C3036),
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFF667eea),
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      ),
    ),
    textTheme: const TextTheme(
      headlineLarge: TextStyle(
        color: Colors.white,
        fontSize: 32,
        fontWeight: FontWeight.bold,
      ),
      headlineMedium: TextStyle(
        color: Colors.white,
        fontSize: 24,
        fontWeight: FontWeight.w600,
      ),
      bodyLarge: TextStyle(
        color: Colors.white,
        fontSize: 16,
      ),
      bodyMedium: TextStyle(
        color: Color(0xFFB2B8BD),
        fontSize: 14,
      ),
    ),
  );
}
