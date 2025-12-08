import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'services/activity_tracking_service.dart';
import 'package:google_fonts/google_fonts.dart';
import 'localization/app_localizations.dart';
import 'screens/home_screen_premium.dart';
import 'screens/cart_screen_premium.dart';
import 'screens/favorites_screen_premium.dart';
import 'screens/categories_screen_premium.dart';
import 'screens/profile_screen_ultra.dart';
import 'screens/product/product_detail_screen.dart';
import 'providers/theme_provider.dart';
import 'providers/language_provider.dart';
import 'providers/cart_provider.dart';
import 'providers/favorites_provider.dart';
import 'providers/product_provider.dart';
import 'providers/order_provider.dart';
import 'providers/messaging_provider.dart';
import 'providers/categories_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Supabase
  await Supabase.initialize(
    url: 'https://uvlrgwdbjegoavjfdrzb.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bHJnd2RiamVnb2F2amZkcnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzI3ODYsImV4cCI6MjA3MTgwODc4Nn0.ZuMcEKbCKo5CtQGdn2KAHqHfBdROpvtLp7nJpJSHOUQ',
  );
  
  // Initialize activity tracking
  await ActivityTrackingService().initSession();
  
  runApp(
    MultiProvider(
      providers: [
        // Auth provider will be added when fixed
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => LanguageProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => FavoritesProvider()),
        ChangeNotifierProvider(create: (_) => ProductProvider()),
        ChangeNotifierProvider(create: (_) => OrderProvider()),
        ChangeNotifierProvider(create: (_) => MessagingProvider()),
        ChangeNotifierProvider(create: (_) => CategoriesProvider()),
        ChangeNotifierProvider(create: (_) => MessagingService()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  
  static final GoRouter _router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const HomeScreenPremium(),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomeScreenPremium(),
      ),
      GoRoute(
        path: '/cart',
        builder: (context, state) => const CartScreenPremium(),
      ),
      GoRoute(
        path: '/categories',
        builder: (context, state) => const CategoriesScreenPremium(),
      ),
      GoRoute(
        path: '/favorites',
        builder: (context, state) => const FavoritesScreenPremium(),
      ),
      GoRoute(
        path: '/profile',
        builder: (context, state) => const ProfileScreenUltra(),
      ),
      GoRoute(
        path: '/product/:id',
        builder: (context, state) {
          final productId = state.pathParameters['id'] ?? '';
          return ProductDetailScreen(productId: productId);
        },
      ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    return Consumer<ThemeProvider>(
      builder: (context, themeProvider, child) {
        return MaterialApp.router(
          title: 'GBA Store',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            primarySwatch: Colors.deepPurple,
            fontFamily: GoogleFonts.poppins().fontFamily,
          ),
          routerConfig: _router,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('fr', ''), // French
            Locale('en', ''), // English
            Locale('ar', ''), // Arabic
          ],
        );
      },
    );
  }
}
