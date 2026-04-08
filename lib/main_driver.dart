import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart' show ProviderScope;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'localization/app_localizations.dart';
import 'providers/language_provider.dart';
import 'services/location_background_service.dart';
import 'services/driver_notification_service.dart';
import 'config/app_config.dart';
import 'screens/driver/driver_home_screen.dart';

/// Top-level background FCM handler — must be a free function annotated with
/// @pragma('vm:entry-point') so it is not tree-shaken in release mode.
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  try { await Firebase.initializeApp(); } catch (_) {}

  debugPrint('[DriverFCM][BG] background message received: id=${message.messageId} '
      'data=${message.data} notification=${message.notification?.title}');

  final plugin = FlutterLocalNotificationsPlugin();
  const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
  await plugin.initialize(const InitializationSettings(android: androidInit));

  // ── Create the notification channel (required on Android 8+) ──
  final androidPlugin = plugin
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
  if (androidPlugin != null) {
    await androidPlugin.createNotificationChannel(
      const AndroidNotificationChannel(
        'gba_driver_channel',
        'GBA Livreur',
        description: 'Notifications pour les livreurs GBA',
        importance: Importance.max,
      ),
    );
  }

  final title = message.notification?.title ?? message.data['title']?.toString() ?? 'GBA Livreur';
  final body = message.notification?.body ?? message.data['body']?.toString() ?? '';

  debugPrint('[DriverFCM][BG] showing local notification: title="$title" body="$body"');

  await plugin.show(
    message.hashCode,
    title,
    body,
    const NotificationDetails(
      android: AndroidNotificationDetails(
        'gba_driver_channel',
        'GBA Livreur',
        channelDescription: 'Notifications pour les livreurs GBA',
        importance: Importance.max,
        priority: Priority.high,
        icon: '@mipmap/ic_launcher',
      ),
    ),
  );
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Register background FCM handler before Firebase.initializeApp()
  FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);

  try {
    await Firebase.initializeApp();
  } catch (_) {}

  try {
    await Supabase.initialize(
      url: AppConfig.supabaseUrl,
      anonKey: AppConfig.supabaseAnonKey,
    );
  } catch (_) {
    // Already initialized by main.dart — fine when running in shared build
  }

  // Background GPS tracking (driver mode) — configured once at app launch.
  await LocationBackgroundService.instance.initialize();
  
  // Request "Always" permission for 24/7 tracking
  try {
    final hasAlways = await LocationBackgroundService.instance.requestBackgroundLocationPermission();
    if (hasAlways) {
      debugPrint('[DriverMain] Background location permission granted (Always)');
    } else {
      debugPrint('[DriverMain] Background location permission denied - tracking limited to foreground');
    }
  } catch (e) {
    debugPrint('[DriverMain] Background permission request failed: $e');
  }

  // ── Initialize driver notification service EARLY (before runApp) ──
  // This ensures FCM foreground listener, token registration, and realtime
  // order listening are active even before the home screen mounts.
  // Note: initialize() is idempotent — it won't run twice.
  try {
    await DriverNotificationService.instance.initialize();
    debugPrint('[DriverMain] DriverNotificationService initialized in main()');
  } catch (e) {
    debugPrint('[DriverMain] DriverNotificationService init failed: $e');
  }

  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
  ));

  runApp(
    ProviderScope(
      child: ChangeNotifierProvider(
        create: (_) => LanguageProvider(),
        child: const DriverApp(),
      ),
    ),
  );
}

class DriverApp extends StatelessWidget {
  const DriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<LanguageProvider>(
      builder: (context, languageProvider, _) {
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          locale: languageProvider.locale,
          supportedLocales: const [
            Locale('en'),
            Locale('fr'),
            Locale('ar'),
          ],
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          title: 'GBA Livreur',
          theme: ThemeData(
            useMaterial3: true,
            colorScheme:
                ColorScheme.fromSeed(seedColor: const Color(0xFF667eea)),
            textTheme: GoogleFonts.interTextTheme(),
            scaffoldBackgroundColor: const Color(0xFFF5F7FA),
            appBarTheme: const AppBarTheme(
              backgroundColor: Color(0xFF667eea),
              foregroundColor: Colors.white,
              elevation: 0,
              centerTitle: false,
            ),
          ),
          home: const _DriverRoot(),
        );
      },
    );
  }
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

class _DriverRoot extends StatefulWidget {
  const _DriverRoot();

  @override
  State<_DriverRoot> createState() => _DriverRootState();
}

class _DriverRootState extends State<_DriverRoot> {
  bool _checkingRole = false;
  bool _roleVerified = false;
  String? _roleError;
  bool _suspended = false;
  String? _suspensionReason;

  Future<void> _verifyDriverRole(String userId) async {
    if (_checkingRole) return;
    setState(() {
      _checkingRole = true;
      _roleError = null;
      _suspended = false;
      _suspensionReason = null;
    });
    try {
      final response = await Supabase.instance.client
          .from('profiles')
          .select('role, is_suspended, is_blocked, suspension_reason')
          .eq('id', userId)
          .maybeSingle();
      final role = response?['role']?.toString().toLowerCase();
      if (role == 'driver') {
        final driverRow = await Supabase.instance.client
            .from('drivers')
            .select('is_active')
            .eq('user_id', userId)
            .maybeSingle();
        final profSuspended =
            response?['is_suspended'] == true || response?['is_blocked'] == true;
        final driverInactive = driverRow != null && driverRow['is_active'] == false;
        final suspended = profSuspended || driverInactive;
        final reason = (response?['suspension_reason'] as String?)?.trim();
        if (mounted) {
          setState(() {
            _roleVerified = true;
            _checkingRole = false;
            _suspended = suspended;
            _suspensionReason = reason?.isNotEmpty == true
                ? reason
                : (driverInactive
                    ? 'Votre fiche livreur est désactivée. Contactez l’administration.'
                    : 'Votre compte est suspendu. Contactez l’administration.');
          });
        }
      } else {
        // Not a driver — sign out
        await Supabase.instance.client.auth.signOut();
        if (mounted) {
          setState(() {
            _roleVerified = false;
            _checkingRole = false;
            _roleError = 'Ce compte n\'est pas un compte livreur. Contactez l\'administrateur.';
          });
        }
      }
    } catch (e) {
      debugPrint('[DriverRoot] role check error: $e');
      if (mounted) {
        setState(() {
          _checkingRole = false;
          _roleError = 'Erreur de vérification du rôle: $e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: Supabase.instance.client.auth.onAuthStateChange,
      builder: (context, snap) {
        final session = snap.data?.session ??
            Supabase.instance.client.auth.currentSession;
        if (session == null) {
          // Reset role state on logout
          if (_roleVerified) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) setState(() { _roleVerified = false; _checkingRole = false; });
            });
          }
          LocationBackgroundService.instance.clearDriverId();
          return _DriverLoginScreen(roleError: _roleError);
        }

        // Verify driver role before granting access
        if (!_roleVerified && !_checkingRole) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _verifyDriverRole(session.user.id);
          });
          return Scaffold(
            body: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                ),
              ),
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: Colors.white),
                    SizedBox(height: 16),
                    Text('Vérification du compte...', style: TextStyle(color: Colors.white, fontSize: 16)),
                  ],
                ),
              ),
            ),
          );
        }

        if (!_roleVerified) {
          LocationBackgroundService.instance.clearDriverId();
          return _DriverLoginScreen(roleError: _roleError);
        }

        if (_suspended) {
          LocationBackgroundService.instance.clearDriverId();
          return _DriverSuspendedGate(reason: _suspensionReason);
        }

        // Associate driverId so background tracking writes into driver_locations.
        // This is safe: in background service we clear userId when driverId is set.
        LocationBackgroundService.instance.setDriverId(session.user.id);
        return const DriverHomeScreen();
      },
    );
  }
}

// ─── Suspension (aligné comportement client) ───────────────────────────────────

class _DriverSuspendedGate extends StatelessWidget {
  final String? reason;
  const _DriverSuspendedGate({this.reason});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF667eea), Color(0xFF764ba2)],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.pause_circle_filled, size: 72, color: Colors.white),
                const SizedBox(height: 20),
                Text(
                  'Compte suspendu',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  reason ??
                      'Votre accès livreur est temporairement indisponible. Contactez l’administration GBA.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    height: 1.45,
                    color: Colors.white.withValues(alpha: 0.9),
                  ),
                ),
                const SizedBox(height: 32),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF667eea),
                    padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                  ),
                  onPressed: () => Supabase.instance.client.auth.signOut(),
                  child: const Text('Se déconnecter'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Lightweight driver login ─────────────────────────────────────────────────

class _DriverLoginScreen extends StatefulWidget {
  final String? roleError;
  const _DriverLoginScreen({this.roleError});

  @override
  State<_DriverLoginScreen> createState() => _DriverLoginScreenState();
}

class _DriverLoginScreenState extends State<_DriverLoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.roleError != null) {
      _error = widget.roleError;
    }
  }

  @override
  void didUpdateWidget(covariant _DriverLoginScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.roleError != oldWidget.roleError && widget.roleError != null) {
      setState(() => _error = widget.roleError);
    }
  }

  static const _purple = Color(0xFF667eea);
  static const _violet = Color(0xFF764ba2);

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.signInWithPassword(
        email: _emailCtrl.text.trim(),
        password: _passCtrl.text.trim(),
      );
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_purple, _violet],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Logo
                  Container(
                    width: 88,
                    height: 88,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      shape: BoxShape.circle,
                      border: Border.all(
                          color: Colors.white.withValues(alpha: 0.4), width: 2),
                    ),
                    child: const Icon(Icons.delivery_dining,
                        color: Colors.white, size: 44),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    l10n.translate('driver_app_title'),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 30,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    l10n.translate('driver_login_subtitle'),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.8),
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 40),

                  // Form card
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(28),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.15),
                          blurRadius: 30,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (_error != null)
                            Container(
                              margin: const EdgeInsets.only(bottom: 16),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.red.shade50,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                    color: Colors.red.shade200),
                              ),
                              child: Text(
                                _error!,
                                style: TextStyle(
                                    color: Colors.red.shade700,
                                    fontSize: 13),
                              ),
                            ),
                          // Email
                          TextFormField(
                            controller: _emailCtrl,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            decoration: InputDecoration(
                              labelText: l10n.translate('driver_email_label'),
                              prefixIcon: const Icon(Icons.email_outlined,
                                  color: _purple),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(16),
                                borderSide:
                                    BorderSide(color: Colors.grey.shade200),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(16),
                                borderSide:
                                    const BorderSide(color: _purple, width: 2),
                              ),
                              filled: true,
                              fillColor: Colors.grey.shade50,
                            ),
                            validator: (v) {
                              if (v == null || v.trim().isEmpty) {
                                return l10n.translate(
                                    'driver_email_required');
                              }
                              if (!v.contains('@')) {
                                return l10n.translate(
                                    'driver_email_invalid');
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),
                          // Password
                          TextFormField(
                            controller: _passCtrl,
                            obscureText: _obscure,
                            textInputAction: TextInputAction.done,
                            onFieldSubmitted: (_) => _login(),
                            decoration: InputDecoration(
                              labelText: l10n.translate('driver_password_label'),
                              prefixIcon: const Icon(Icons.lock_outline,
                                  color: _purple),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscure
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                  color: Colors.grey,
                                ),
                                onPressed: () =>
                                    setState(() => _obscure = !_obscure),
                              ),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(16),
                                borderSide:
                                    BorderSide(color: Colors.grey.shade200),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(16),
                                borderSide:
                                    const BorderSide(color: _purple, width: 2),
                              ),
                              filled: true,
                              fillColor: Colors.grey.shade50,
                            ),
                            validator: (v) {
                              if (v == null || v.trim().isEmpty) {
                                return l10n.translate(
                                    'driver_password_required');
                              }
                              if (v.length < 6) {
                                return l10n.translate(
                                    'driver_password_min');
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 24),
                          // Login button
                          _loading
                              ? const Center(
                                  child: CircularProgressIndicator(
                                      color: _purple),
                                )
                              : GestureDetector(
                                  onTap: _login,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                        vertical: 16),
                                    decoration: BoxDecoration(
                                      gradient: const LinearGradient(
                                          colors: [_purple, _violet]),
                                      borderRadius:
                                          BorderRadius.circular(16),
                                      boxShadow: [
                                        BoxShadow(
                                          color: _purple.withValues(
                                              alpha: 0.4),
                                          blurRadius: 14,
                                          offset: const Offset(0, 6),
                                        ),
                                      ],
                                    ),
                                    child: Center(
                                      child: Text(
                                        l10n.translate('driver_login_button'),
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 16,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
