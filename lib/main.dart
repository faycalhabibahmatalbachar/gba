import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:country_picker/country_picker.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:provider/provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart' show ProviderScope;
import 'services/activity_tracking_service.dart';
import 'package:google_fonts/google_fonts.dart';
import 'localization/app_localizations.dart';
import 'config/app_config.dart';
import 'routes/app_routes.dart';
import 'providers/theme_provider.dart';
import 'providers/language_provider.dart';
import 'providers/cart_provider.dart';
import 'providers/favorites_provider.dart';
import 'providers/product_provider.dart';
import 'providers/banner_provider.dart';
import 'providers/order_provider.dart';
import 'providers/messaging_provider.dart';
import 'providers/categories_provider.dart';
import 'providers/notification_preferences_provider.dart';
import 'services/messaging_service.dart';
import 'services/notification_service.dart';
import 'utils/i18n_audit.dart';

const FirebaseOptions _webFirebaseOptions = FirebaseOptions(
  apiKey: String.fromEnvironment(
    'FIREBASE_WEB_API_KEY',
    defaultValue: 'AIzaSyAy7cHyAZF9hPDzkhs1fPOTbEeJayruh7w',
  ),
  appId: String.fromEnvironment(
    'FIREBASE_WEB_APP_ID',
    defaultValue: '1:113996075487:android:2bac369101f3c820b7b46a',
  ),
  messagingSenderId: String.fromEnvironment(
    'FIREBASE_MESSAGING_SENDER_ID',
    defaultValue: '113996075487',
  ),
  projectId: String.fromEnvironment(
    'FIREBASE_PROJECT_ID',
    defaultValue: 'globalbusinessamdaradir-fba45',
  ),
  authDomain: String.fromEnvironment(
    'FIREBASE_AUTH_DOMAIN',
    defaultValue: 'globalbusinessamdaradir-fba45.firebaseapp.com',
  ),
  storageBucket: String.fromEnvironment(
    'FIREBASE_STORAGE_BUCKET',
    defaultValue: 'globalbusinessamdaradir-fba45.firebasestorage.app',
  ),
);

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (AppConfig.stripePublishableKey.isNotEmpty) {
    Stripe.publishableKey = AppConfig.stripePublishableKey;
    Stripe.urlScheme = 'flutterstripe';
    await Stripe.instance.applySettings();
  } else {
    debugPrint(
      '[Stripe] STRIPE_PUBLISHABLE_KEY manquant (dart-define). Paiements Stripe désactivés.',
    );
  }

  var firebaseReady = false;
  try {
    if (kIsWeb) {
      if (kDebugMode && _webFirebaseOptions.appId.contains(':android:')) {
        debugPrint(
          '[FCM] WARNING: Web FirebaseOptions.appId looks like an Android appId. '
          'Set --dart-define=FIREBASE_WEB_APP_ID=1:...:web:... for Flutter web.',
        );
      }
      await Firebase.initializeApp(options: _webFirebaseOptions);
    } else {
      await Firebase.initializeApp();
    }
    firebaseReady = true;
  } catch (e) {
    debugPrint('[FCM] Firebase init skipped/failed: $e');
  }
  
  // Initialize Supabase
  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    anonKey: AppConfig.supabaseAnonKey,
  );

  if (firebaseReady) {
    try {
      await NotificationService().init(navigatorKey: AppRoutes.rootNavigatorKey);
    } catch (e) {
      debugPrint('[FCM] Notification init skipped/failed: $e');
    }
  }
  
  // Initialize activity tracking
  await ActivityTrackingService().initSession();
  
  runApp(
    ProviderScope(
      child: MultiProvider(
        providers: [
          // Auth provider will be added when fixed
          ChangeNotifierProvider(create: (_) => ThemeProvider()),
          ChangeNotifierProvider(create: (_) => LanguageProvider()),
          ChangeNotifierProvider(create: (_) => CartProvider()),
          ChangeNotifierProvider(create: (_) => FavoritesProvider()),
          ChangeNotifierProvider(create: (_) => ProductProvider()),
          ChangeNotifierProvider(create: (_) => BannerProvider()),
          ChangeNotifierProvider(create: (_) => OrderProvider()),
          ChangeNotifierProvider(create: (_) => MessagingProvider()),
          ChangeNotifierProvider(create: (_) => CategoriesProvider()),
          ChangeNotifierProvider(create: (_) => NotificationPreferencesProvider()),
          ChangeNotifierProvider(create: (_) => MessagingService()),
        ],
        child: const MyApp(),
      ),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer2<ThemeProvider, LanguageProvider>(
      builder: (context, themeProvider, languageProvider, child) {
        return MaterialApp.router(
          title: 'GBA Store',
          debugShowCheckedModeBanner: false,
          scaffoldMessengerKey: AppRoutes.scaffoldMessengerKey,
          theme: AppThemes.lightTheme.copyWith(
            textTheme: GoogleFonts.poppinsTextTheme(AppThemes.lightTheme.textTheme),
          ),
          darkTheme: AppThemes.darkTheme.copyWith(
            textTheme: GoogleFonts.poppinsTextTheme(AppThemes.darkTheme.textTheme),
          ),
          themeMode: themeProvider.isDarkMode ? ThemeMode.dark : ThemeMode.light,
          routerConfig: AppRoutes.router,
          builder: (context, child) {
            return I18nAuditOverlay(
              navigatorKey: AppRoutes.rootNavigatorKey,
              router: AppRoutes.router,
              child: child ?? const SizedBox.shrink(),
            );
          },
          locale: languageProvider.locale,
          localizationsDelegates: const [
            CountryLocalizations.delegate,
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
