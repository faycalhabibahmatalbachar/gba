import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:app_links/app_links.dart';
import 'package:country_picker/country_picker.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'services/notification_service.dart' as ns;
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:provider/provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart'
    show ProviderScope, ConsumerState, ConsumerStatefulWidget;
import 'services/activity_tracking_service.dart';
import 'services/location_background_service.dart';
import 'package:google_fonts/google_fonts.dart';
import 'localization/app_localizations.dart';
import 'config/app_config.dart';
import 'routes/app_routes.dart';
import 'routes/navigation_keys.dart';
import 'providers/auth_provider.dart';
import 'providers/theme_provider.dart';
import 'providers/language_provider.dart';
import 'providers/product_provider.dart';
import 'providers/banner_provider.dart';
import 'providers/order_provider.dart';
import 'providers/messaging_provider.dart';
import 'providers/categories_provider.dart';
import 'providers/notification_preferences_provider.dart';
import 'services/messaging_service.dart';
import 'utils/i18n_audit.dart';
import 'animations/app_animation_registry.dart';
import 'main_driver.dart' as driver_entry;
import 'widgets/back_button_handler.dart';

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

// Top-level background FCM handler — must be registered BEFORE Firebase.initializeApp()
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  try { await Firebase.initializeApp(); } catch (_) {}
  await ns.firebaseMessagingBackgroundHandler(message);
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Register background handler before any Firebase call
  FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);

  // Detect flavor: if 'driver', delegate to the dedicated driver app
  const flavor = String.fromEnvironment('FLUTTER_APP_FLAVOR', defaultValue: '');
  if (flavor == 'driver') {
    // Dynamically import won't work, so use a top-level check
    _runDriverApp();
    return;
  }

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
    authOptions: const FlutterAuthClientOptions(detectSessionInUri: true),
  );

  if (firebaseReady) {
    try {
      await ns.NotificationService().init(navigatorKey: NavigationKeys.rootNavigatorKey);
    } catch (e) {
      debugPrint('[FCM] Notification init skipped/failed: $e');
    }
  }
  
  // Only configure the background GPS service at launch (no permission popup, no stream yet).
  // startService() + permission request happen lazily when user opens order tracking
  // or when a driver logs in (setUserId triggers startService internally).
  await LocationBackgroundService.instance.initialize();

  // Initialize activity tracking
  await ActivityTrackingService().initSession();

  // Preload animation registry so nav icons render instantly
  AppAnimationRegistry.instance.preload();
  
  runApp(
    ProviderScope(
      child: MultiProvider(
        providers: [
          // Auth provider will be added when fixed
          ChangeNotifierProvider(create: (_) => ThemeProvider()),
          ChangeNotifierProvider(create: (_) => LanguageProvider()),
          ChangeNotifierProvider(create: (_) => ProductProvider()),
          ChangeNotifierProvider(create: (_) => BannerProvider()),
          ChangeNotifierProvider(create: (_) => OrderProvider()),
          ChangeNotifierProvider(create: (_) => MessagingProvider()),
          ChangeNotifierProvider(create: (_) => CategoriesProvider()),
          ChangeNotifierProvider(create: (_) => NotificationPreferencesProvider()),
          ChangeNotifierProvider(create: (_) => MessagingService()),
        ],
        child: const AppBootstrap(),
      ),
    ),
  );
}

class AppBootstrap extends ConsumerStatefulWidget {
  const AppBootstrap({super.key});

  @override
  ConsumerState<AppBootstrap> createState() => _AppBootstrapState();
}

class _AppBootstrapState extends ConsumerState<AppBootstrap> {
  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _linkSub;
  String? _lastHandledLink;

  @override
  void initState() {
    super.initState();
    ref.read(authProvider);
    _initDeepLinks();
  }

  Future<void> _initDeepLinks() async {
    final initialUri = await _appLinks.getInitialLink();
    if (initialUri != null) {
      await _handleUri(initialUri);
    }

    _linkSub = _appLinks.uriLinkStream.listen(
      (uri) {
        _handleUri(uri);
      },
      onError: (err) {
        debugPrint('[DeepLink] uriLinkStream error: $err');
      },
    );
  }

  Future<void> _handleUri(Uri uri) async {
    if (uri.scheme != 'com.gba.ecommerce_client' || uri.host != 'login-callback') {
      return;
    }

    final link = uri.toString();
    if (_lastHandledLink == link) return;
    _lastHandledLink = link;

    try {
      await Supabase.instance.client.auth.getSessionFromUrl(uri);
    } catch (e) {
      debugPrint('[DeepLink] getSessionFromUrl failed: $e');
    }
  }

  @override
  void dispose() {
    _linkSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return const MyApp();
  }
}

// ── Driver flavor entry point ─────────────────────────────────────────────────
void _runDriverApp() {
  driver_entry.main();
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
          scaffoldMessengerKey: NavigationKeys.scaffoldMessengerKey,
          theme: AppThemes.lightTheme.copyWith(
            textTheme: GoogleFonts.poppinsTextTheme(AppThemes.lightTheme.textTheme),
          ),
          darkTheme: AppThemes.darkTheme.copyWith(
            textTheme: GoogleFonts.poppinsTextTheme(AppThemes.darkTheme.textTheme),
          ),
          themeMode: themeProvider.isDarkMode ? ThemeMode.dark : ThemeMode.light,
          routerConfig: AppRoutes.router,
          builder: (context, child) {
            // Détect RTL for Arabic
            final isArabic = languageProvider.locale.languageCode == 'ar';
            final textDirection = isArabic ? TextDirection.rtl : TextDirection.ltr;

            return Directionality(
              textDirection: textDirection,
              child: BackButtonHandler(
                scaffoldMessengerKey: NavigationKeys.scaffoldMessengerKey,
                child: I18nAuditOverlay(
                  navigatorKey: NavigationKeys.rootNavigatorKey,
                  router: AppRoutes.router,
                  child: child ?? const SizedBox.shrink(),
                ),
              ),
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
          localeResolutionCallback: (locale, supportedLocales) {
            if (locale == null) return const Locale('fr', '');
            final code = locale.languageCode.toLowerCase();
            if (code == 'fr') return const Locale('fr', '');
            if (code == 'en') return const Locale('en', '');
            if (code == 'ar') return const Locale('ar', '');
            return const Locale('fr', '');
          },
        );
      },
    );
  }
}
