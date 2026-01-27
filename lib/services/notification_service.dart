import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';
import '../localization/app_localizations.dart';
import '../providers/notification_preferences_provider.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (kIsWeb) return;

  try {
    await Firebase.initializeApp();
  } catch (_) {}

  if (kDebugMode) {
    debugPrint('[FCM] background message: ${message.messageId} data=${message.data}');
  }
}

class NotificationService {
  static final NotificationService _instance = NotificationService._();
  factory NotificationService() => _instance;
  NotificationService._();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

  String? _currentToken;

  final AndroidNotificationChannel _androidChannel = const AndroidNotificationChannel(
    'default_channel',
    'Notifications',
    description: 'Default notifications channel',
    importance: Importance.high,
  );

  bool _initialized = false;
  GlobalKey<NavigatorState>? _navigatorKey;

  AppLocalizations? _localizations() {
    final context = _navigatorKey?.currentContext;
    if (context == null) return null;
    try {
      return AppLocalizations.of(context);
    } catch (_) {
      return null;
    }
  }

  Future<void> init({required GlobalKey<NavigatorState> navigatorKey}) async {
    if (_initialized) return;

    _navigatorKey = navigatorKey;

    if (kIsWeb) {
      final supported = await _messaging.isSupported();
      if (!supported) {
        if (kDebugMode) {
          debugPrint('[FCM] Firebase Messaging not supported on this browser');
        }
        _initialized = true;
        return;
      }
    }

    await _initLocalNotifications();
    await _requestPermissions();

    try {
      await _messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[FCM] setForegroundNotificationPresentationOptions failed: $e');
      }
    }

    if (!kIsWeb) {
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    }

    FirebaseMessaging.onMessage.listen((message) async {
      if (kDebugMode) {
        debugPrint('[FCM] foreground message: ${message.messageId} data=${message.data}');
      }

      final resolved = _resolveInAppContent(message);
      final category = _resolveCategory(message.data);
      if (_shouldShowForCategory(category)) {
        _showInAppNotification(
          title: resolved.$1,
          body: resolved.$2,
          route: message.data['route']?.toString(),
        );
      }

      final notification = message.notification;
      if (notification != null && !kIsWeb) {
        await _localNotifications.show(
          notification.hashCode,
          notification.title,
          notification.body,
          NotificationDetails(
            android: AndroidNotificationDetails(
              _androidChannel.id,
              _androidChannel.name,
              channelDescription: _androidChannel.description,
              importance: Importance.high,
              priority: Priority.high,
            ),
          ),
          payload: jsonEncode(message.data),
        );
      }
    });

    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      _handleMessageTap(message, navigatorKey);
    });

    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleMessageTap(initialMessage, navigatorKey);
    }

    String? token;
    if (kIsWeb) {
      final vapidKey = AppConfig.firebaseVapidKey;
      if (vapidKey.isEmpty) {
        if (kDebugMode) {
          debugPrint('[FCM] FIREBASE_VAPID_KEY not set; skipping token request on web');
        }
      } else {
        token = await _messaging.getToken(vapidKey: vapidKey);
      }
    } else {
      token = await _messaging.getToken();
    }
    if (kDebugMode) {
      debugPrint('[FCM] token: $token');
    }

    if (token != null && token.isNotEmpty) {
      _currentToken = token;
      await _upsertDeviceToken(token);
    }

    _messaging.onTokenRefresh.listen((newToken) async {
      if (kDebugMode) {
        debugPrint('[FCM] token refreshed: $newToken');
      }
      if (newToken.isEmpty) return;
      _currentToken = newToken;
      await _upsertDeviceToken(newToken);
    });

    try {
      Supabase.instance.client.auth.onAuthStateChange.listen((data) async {
        if (data.session?.user == null) return;
        final tokenToSync = _currentToken;
        if (tokenToSync == null || tokenToSync.isEmpty) return;
        await _upsertDeviceToken(tokenToSync);
      });
    } catch (_) {}

    _initialized = true;
  }

  String _resolvePlatform() {
    if (kIsWeb) return 'web';
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'android';
      case TargetPlatform.iOS:
        return 'ios';
      case TargetPlatform.macOS:
        return 'macos';
      case TargetPlatform.windows:
        return 'windows';
      case TargetPlatform.linux:
        return 'linux';
      case TargetPlatform.fuchsia:
        return 'fuchsia';
    }
  }

  Future<String> _resolveAppLocale() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getString('app_locale');
      if (stored != null && stored.trim().isNotEmpty) {
        return stored.trim();
      }
    } catch (_) {}
    return 'fr';
  }

  Future<void> _upsertDeviceToken(String token) async {
    try {
      final client = Supabase.instance.client;
      final userId = client.auth.currentUser?.id;
      if (userId == null) return;

      final locale = await _resolveAppLocale();
      final now = DateTime.now().toIso8601String();

      await client.from('device_tokens').upsert(
        {
          'user_id': userId,
          'token': token,
          'platform': _resolvePlatform(),
          'locale': locale,
          'last_seen_at': now,
          'updated_at': now,
        },
        onConflict: 'token',
      );
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[FCM] device_tokens upsert failed: $e');
      }
    }
  }

  String? _resolveCategory(Map<String, dynamic> data) {
    final explicit = data['category']?.toString();
    if (explicit != null && explicit.isNotEmpty) return explicit;

    final template = data['template']?.toString();
    switch (template) {
      case 'order_status':
        return 'orders';
      case 'cart_abandoned':
        return 'promotions';
      case 'promotion':
        return 'promotions';
      default:
        return null;
    }
  }

  bool _shouldShowForCategory(String? category) {
    final context = _navigatorKey?.currentContext;
    if (context == null) return true;
    try {
      final prefs = Provider.of<NotificationPreferencesProvider>(context, listen: false);
      return prefs.isCategoryEnabled(category);
    } catch (_) {
      return true;
    }
  }

  (String title, String body) _resolveInAppContent(RemoteMessage message) {
    final localizations = _localizations();
    final notification = message.notification;
    final title = notification?.title ?? _templateTitle(message.data);
    final body = notification?.body ?? _templateBody(message.data);
    return (
      title ?? (localizations?.translate('notification_default_title') ?? 'Notification'),
      body ?? '',
    );
  }

  String? _templateTitle(Map<String, dynamic> data) {
    final localizations = _localizations();
    final template = data['template']?.toString();
    switch (template) {
      case 'order_status':
        return localizations?.translate('push_title_order_status') ?? 'Order update';
      case 'cart_abandoned':
        return localizations?.translate('push_title_cart_abandoned') ?? 'Cart reminder';
      case 'promotion':
        return localizations?.translate('push_title_promotion') ?? 'Promotion';
      default:
        return null;
    }
  }

  String? _templateBody(Map<String, dynamic> data) {
    final localizations = _localizations();
    final template = data['template']?.toString();
    switch (template) {
      case 'order_status':
        final orderNumber = data['order_number']?.toString();
        final status = data['status']?.toString();
        final orderLabel = (orderNumber != null && orderNumber.isNotEmpty)
            ? ' $orderNumber'
            : '';
        final normalizedStatus = status?.trim().toLowerCase();
        final statusKey = (normalizedStatus != null && normalizedStatus.isNotEmpty)
            ? 'order_status_$normalizedStatus'
            : null;
        final translatedStatus = (statusKey != null) ? localizations?.translate(statusKey) : null;
        final statusLabel = (translatedStatus != null && statusKey != null && translatedStatus != statusKey)
            ? translatedStatus
            : (status != null && status.isNotEmpty)
                ? status
                : (localizations?.translate('push_order_status_default_status') ?? 'updated');
        return localizations?.translateParams(
              'push_body_order_status',
              {
                'orderLabel': orderLabel,
                'status': statusLabel,
              },
            ) ??
            'Order$orderLabel: $statusLabel';
      case 'cart_abandoned':
        final count = data['items_count']?.toString();
        if (count != null && count.isNotEmpty) {
          return localizations?.translateParams(
                'push_body_cart_abandoned_with_count',
                {'count': count},
              ) ??
              'You have $count item(s) in your cart.';
        }
        return localizations?.translate('push_body_cart_abandoned') ?? 'You have items in your cart.';
      case 'promotion':
        final promo = data['promo']?.toString();
        if (promo != null && promo.isNotEmpty) return promo;
        return localizations?.translate('push_body_promotion') ?? 'Discover our offers.';
      default:
        return null;
    }
  }

  void _showInAppNotification({
    required String title,
    required String body,
    required String? route,
  }) {
    final context = _navigatorKey?.currentContext;
    if (context == null) return;

    final actionLabel = _localizations()?.translate('open') ?? 'Open';

    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;

    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text(body.isEmpty ? title : '$title\n$body'),
        duration: const Duration(seconds: 4),
        action: (route != null && route.isNotEmpty)
            ? SnackBarAction(
                label: actionLabel,
                onPressed: () => _goTo(route),
              )
            : null,
      ),
    );
  }

  Future<void> _requestPermissions() async {
    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (!kIsWeb) {
      final androidPlugin = _localNotifications
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.requestNotificationsPermission();
    }
  }

  Future<void> _initLocalNotifications() async {
    if (kIsWeb) return;

    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidInit);

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (resp) {
        if (kDebugMode) {
          debugPrint('[FCM] local notification tapped payload=${resp.payload}');
        }

        final payload = resp.payload;
        if (payload == null || payload.isEmpty) return;
        try {
          final data = jsonDecode(payload);
          if (data is Map) {
            final route = data['route']?.toString();
            if (route != null && route.isNotEmpty) {
              _goTo(route);
            }
          }
        } catch (_) {}
      },
    );

    final androidPlugin = _localNotifications.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(_androidChannel);
  }

  void _handleMessageTap(RemoteMessage message, GlobalKey<NavigatorState> navigatorKey) {
    if (kDebugMode) {
      debugPrint('[FCM] message opened: ${message.messageId} data=${message.data}');
    }

    final route = message.data['route']?.toString();
    if (route == null || route.isEmpty) return;

    _goTo(route);
  }

  void _goTo(String route) {
    final context = _navigatorKey?.currentContext;
    if (context == null) return;
    context.go(route);
  }
}
