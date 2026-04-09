import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
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

/// Replaces raw URLs (e.g. Supabase storage) in notification body with a short media label.
String sanitizeNotificationBodyForTray(
  String? rawBody,
  Map<String, dynamic> data,
  AppLocalizations? loc,
) {
  final b = rawBody?.trim() ?? '';
  if (b.isEmpty) return '';
  final lower = b.toLowerCase();
  final looksLikeUrl = lower.startsWith('http://') ||
      lower.startsWith('https://') ||
      lower.contains('supabase.co');
  if (!looksLikeUrl) return b;

  final mt = '${data['message_type'] ?? data['type'] ?? ''}'.toLowerCase();
  if (mt.contains('audio')) {
    return loc?.translate('notification_body_audio_message') ?? 'Voice message';
  }
  if (mt.contains('image')) {
    return loc?.translate('notification_body_image_message') ?? 'Image';
  }
  return loc?.translate('notification_body_new_message') ?? 'New message';
}

/// Android notification channel – must match the channel_id sent by the Edge Function.
const String _kChannelId = 'high_importance_channel';
const String _kChannelName = 'GBA Notifications';
const String _kChannelDesc = 'Notifications de commandes, livraisons et messages';

Future<AndroidNotificationDetails> _buildAndroidNotificationDetails({
  required String channelId,
  required String channelName,
  String? channelDesc,
  String? imageUrl,
}) async {
  BigPictureStyleInformation? style;

  if (!kIsWeb &&
      defaultTargetPlatform == TargetPlatform.android &&
      imageUrl != null &&
      imageUrl.trim().isNotEmpty) {
    final uri = imageUrl.trim();
    try {
      final resp = await Dio().get<List<int>>(
            uri,
            options: Options(responseType: ResponseType.bytes),
          );
      final data = resp.data;
      if (data != null && data.isNotEmpty) {
        final bytes = Uint8List.fromList(data);
        final bigPicture = ByteArrayAndroidBitmap(bytes);
        style = BigPictureStyleInformation(
          bigPicture,
          hideExpandedLargeIcon: true,
        );
      }
    } catch (e) {
      debugPrint('[FCM] image download failed ($uri): $e');
    }
  }

  return AndroidNotificationDetails(
    channelId,
    channelName,
    channelDescription: channelDesc,
    importance: Importance.max,
    priority: Priority.high,
    icon: '@mipmap/ic_launcher',
    showWhen: true,
    styleInformation: style,
  );
}

/// Top-level background handler – runs in its own isolate.
/// For data-only FCM messages this shows a local notification.
/// For notification+data messages, Android auto-displays, but this
/// handler still fires on some OEM Android devices, so it's safe to
/// call plugin.show() — the OS will de-duplicate by notification ID.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (kIsWeb) return;

  try {
    await Firebase.initializeApp();
  } catch (_) {}

  debugPrint('[FCM][BG] ── background message received ──');
  debugPrint('[FCM][BG]   messageId : ${message.messageId}');
  debugPrint('[FCM][BG]   data      : ${message.data}');
  debugPrint('[FCM][BG]   notif     : ${message.notification?.title} / ${message.notification?.body}');

  // Create a fresh plugin instance (background isolate has no shared state)
  final plugin = FlutterLocalNotificationsPlugin();
  const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
  await plugin.initialize(const InitializationSettings(android: androidInit));

  // Ensure the notification channel exists (required on Android 8+)
  final androidPlugin = plugin
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
  if (androidPlugin != null) {
    await androidPlugin.createNotificationChannel(
      const AndroidNotificationChannel(
        _kChannelId,
        _kChannelName,
        description: _kChannelDesc,
        importance: Importance.max,
      ),
    );
  }

  // Build title/body from notification payload or data payload
  final notification = message.notification;
  final title = notification?.title ?? message.data['title']?.toString() ?? 'GBA';
  final rawBody = notification?.body ?? message.data['body']?.toString() ?? '';
  final body = sanitizeNotificationBodyForTray(rawBody, message.data, null);

  debugPrint('[FCM][BG] showing local notification: title="$title" body="$body"');

  try {
    AndroidNotificationDetails androidDetails;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      final imageUrl =
          message.notification?.android?.imageUrl ?? // FCM notification image
          message.data['image_url']?.toString() ??
          message.data['image']?.toString();
      androidDetails = await _buildAndroidNotificationDetails(
        channelId: _kChannelId,
        channelName: _kChannelName,
        channelDesc: _kChannelDesc,
        imageUrl: imageUrl,
      );
    } else {
      androidDetails = const AndroidNotificationDetails(
        _kChannelId,
        _kChannelName,
        channelDescription: _kChannelDesc,
        importance: Importance.max,
        priority: Priority.high,
        icon: '@mipmap/ic_launcher',
        showWhen: true,
      );
    }

    await plugin.show(
      message.messageId?.hashCode ?? message.hashCode,
      title,
      body,
      NotificationDetails(android: androidDetails),
      payload: jsonEncode(message.data),
    );
    debugPrint('[FCM][BG] ✅ local notification shown successfully');
  } catch (e) {
    debugPrint('[FCM][BG] ❌ local notification show FAILED: $e');
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
    _kChannelId,
    _kChannelName,
    description: _kChannelDesc,
    importance: Importance.max,
  );

  bool _initialized = false;
  GlobalKey<NavigatorState>? _navigatorKey;

  static const Set<String> _allowedRoutePrefixes = <String>{
    '/home',
    '/cart',
    '/favorites',
    '/orders',
    '/chat',
    '/messages',
    '/promotions',
    '/product/',
    '/settings',
    '/profile',
    '/categories',
  };

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

    debugPrint('[FCM] ── init START (platform: ${kIsWeb ? "web" : "native"}) ──');

    if (kIsWeb) {
      final supported = await _messaging.isSupported();
      if (!supported) {
        debugPrint('[FCM] Firebase Messaging not supported on this browser');
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
      debugPrint('[FCM] foreground presentation options set');
    } catch (e) {
      debugPrint('[FCM] setForegroundNotificationPresentationOptions failed: $e');
    }

    // ── Foreground messages ──────────────────────────────────────────────
    FirebaseMessaging.onMessage.listen((message) async {
      debugPrint('[FCM][FG] foreground message: id=${message.messageId} '
          'data=${message.data} notification=${message.notification?.title}');

      final resolved = _resolveInAppContent(message);
      final category = _resolveCategory(message.data);
      if (_shouldShowForCategory(category)) {
        _showInAppNotification(
          title: resolved.$1,
          body: resolved.$2,
          route: message.data['route']?.toString(),
        );
      }

      // Also show a system-level local notification so it appears in the tray
      final notification = message.notification;
      final fgTitle = notification?.title ?? message.data['title']?.toString() ?? resolved.$1;
      final fgRaw = notification?.body ?? message.data['body']?.toString() ?? resolved.$2;
      final fgBody = sanitizeNotificationBodyForTray(fgRaw, message.data, _localizations());

      if (!kIsWeb) {
        try {
          // Use messageId hash for stable notification ID to avoid duplicates
          final notifId = message.messageId?.hashCode ?? DateTime.now().millisecondsSinceEpoch ~/ 1000;
          AndroidNotificationDetails androidDetails;
          if (defaultTargetPlatform == TargetPlatform.android) {
            final imageUrl =
                notification?.android?.imageUrl ??
                message.data['image_url']?.toString() ??
                message.data['image']?.toString();
            androidDetails = await _buildAndroidNotificationDetails(
              channelId: _androidChannel.id,
              channelName: _androidChannel.name,
              channelDesc: _androidChannel.description,
              imageUrl: imageUrl,
            );
          } else {
            androidDetails = AndroidNotificationDetails(
              _androidChannel.id,
              _androidChannel.name,
              channelDescription: _androidChannel.description,
              importance: Importance.max,
              priority: Priority.high,
              icon: '@mipmap/ic_launcher',
              showWhen: true,
            );
          }
          await _localNotifications.show(
            notifId,
            fgTitle,
            fgBody,
            NotificationDetails(
              android: androidDetails,
            ),
            payload: jsonEncode(message.data),
          );
          debugPrint('[FCM][FG] ✅ local notification shown: "$fgTitle"');
        } catch (e) {
          debugPrint('[FCM][FG] ❌ local notification show failed: $e');
        }
      }
    });

    // ── Notification tap (app was in background) ─────────────────────────
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      debugPrint('[FCM] onMessageOpenedApp: id=${message.messageId} data=${message.data}');
      _handleMessageTap(message);
    });

    // ── Cold-start tap (app was killed) ──────────────────────────────────
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      debugPrint('[FCM] getInitialMessage: id=${initialMessage.messageId} data=${initialMessage.data}');
      _handleMessageTap(initialMessage);
    }

    // ── FCM Token ────────────────────────────────────────────────────────
    String? token;
    if (kIsWeb) {
      final vapidKey = AppConfig.firebaseVapidKey;
      if (vapidKey.isEmpty) {
        debugPrint('[FCM] FIREBASE_VAPID_KEY not set; skipping token request on web');
      } else {
        token = await _messaging.getToken(vapidKey: vapidKey);
      }
    } else {
      token = await _messaging.getToken();
    }

    if (token == null || token.isEmpty) {
      debugPrint('[FCM] WARNING: FCM token is NULL or EMPTY — push will NOT work!');
    } else {
      final suffix = token.length >= 8 ? token.substring(token.length - 8) : token;
      debugPrint('[FCM] token received (suffix=...$suffix, length=${token.length})');
    }

    if (token != null && token.isNotEmpty) {
      _currentToken = token;
      await _upsertDeviceToken(token);
    }

    _messaging.onTokenRefresh.listen((newToken) async {
      if (newToken.isEmpty) {
        debugPrint('[FCM] token refreshed: <empty> — ignoring');
        return;
      }
      final suffix = newToken.length >= 8 ? newToken.substring(newToken.length - 8) : newToken;
      debugPrint('[FCM] token refreshed (suffix=...$suffix)');
      _currentToken = newToken;
      await _upsertDeviceToken(newToken);
    });

    // ── Re-sync token on auth state change (login) ───────────────────────
    try {
      Supabase.instance.client.auth.onAuthStateChange.listen((data) async {
        if (data.session?.user == null) {
          debugPrint('[FCM] auth state change: no user session');
          return;
        }
        debugPrint('[FCM] auth state change: user=${data.session!.user.id} — syncing token');
        String? tokenToSync = _currentToken;
        if (tokenToSync == null || tokenToSync.isEmpty) {
          try {
            if (kIsWeb) {
              final vapidKey = AppConfig.firebaseVapidKey;
              if (vapidKey.isNotEmpty) tokenToSync = await _messaging.getToken(vapidKey: vapidKey);
            } else {
              tokenToSync = await _messaging.getToken();
            }
            if (tokenToSync != null && tokenToSync.isNotEmpty) _currentToken = tokenToSync;
          } catch (e) {
            debugPrint('[FCM] token re-fetch on auth change failed: $e');
          }
        }
        if (tokenToSync == null || tokenToSync.isEmpty) {
          debugPrint('[FCM] WARNING: no token to sync after auth change');
          return;
        }
        await _upsertDeviceToken(tokenToSync);
      });
    } catch (e) {
      debugPrint('[FCM] auth state listener setup failed: $e');
    }

    _initialized = true;
    debugPrint('[FCM] ── init COMPLETE ──');
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

  /// Call after login to force-sync the current FCM token to the backend (e.g. after reconnect).
  Future<void> syncTokenToBackend() async {
    if (kIsWeb) return;
    String? token = _currentToken;
    if (token == null || token.isEmpty) {
      try {
        token = await _messaging.getToken();
        if (token != null && token.isNotEmpty) _currentToken = token;
      } catch (e) {
        debugPrint('[FCM] syncTokenToBackend getToken failed: $e');
      }
    }
    if (token != null && token.isNotEmpty) {
      debugPrint('[FCM] syncTokenToBackend: upserting token');
      await _upsertDeviceToken(token);
    } else {
      debugPrint('[FCM] syncTokenToBackend: no token available');
    }
  }

  Future<void> _upsertDeviceToken(String token) async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) {
      debugPrint('[FCM] _upsertDeviceToken skipped: no user logged in');
      return;
    }

    final now = DateTime.now().toUtc().toIso8601String();
    final platform = _resolvePlatform();
    final locale = await _resolveAppLocale();
    // device_id: use a stable hash of the token prefix so upsert key stays stable
    final deviceId = token.length >= 32 ? token.substring(0, 32) : token;

    debugPrint('[FCM] _upsertDeviceToken: userId=$userId platform=$platform locale=$locale');
    debugPrint('[FCM] _upsertDeviceToken: token length=${token.length}, suffix=...${token.length >= 8 ? token.substring(token.length - 8) : token}');

    for (int attempt = 1; attempt <= 3; attempt++) {
      try {
        await client.from('device_tokens').upsert(
          {
            'user_id': userId,
            'token': token,
            'device_id': deviceId,
            'platform': platform,
            'locale': locale,
            'last_seen_at': now,
            'updated_at': now,
          },
          onConflict: 'token',
        );
        debugPrint('[FCM] ✅ device_tokens upsert OK (attempt $attempt)');
        return;
      } catch (e) {
        debugPrint('[FCM] ❌ device_tokens upsert FAILED (attempt $attempt/3): $e');
        if (attempt < 3) {
          await Future.delayed(Duration(seconds: attempt * 2));
        }
      }
    }
    debugPrint('[FCM] ❌ device_tokens upsert GAVE UP after 3 attempts — NOTIFICATIONS WILL NOT WORK');
  }

  String? _resolveCategory(Map<String, dynamic> data) {
    final explicit = data['category']?.toString();
    if (explicit != null && explicit.isNotEmpty) return explicit;

    final template = data['template']?.toString();
    switch (template) {
      case 'order_status':
      case 'order':
      case 'new_order':
      case 'order_update':
        return 'orders';
      case 'cart_abandoned':
      case 'promotion':
      case 'new_banner':
        return 'promotions';
      case 'message':
      case 'chat':
      case 'new_message':
        return 'chat';
      case 'new_product':
        return 'product';
      case 'delivery_picked_up':
      case 'delivery_completed':
      case 'driver_assigned':
        return 'orders';
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
    final rawBody = notification?.body ?? _templateBody(message.data);
    final body = sanitizeNotificationBodyForTray(rawBody, message.data, localizations);
    return (
      title ?? (localizations?.translate('notification_default_title') ?? 'Notification'),
      body,
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
    if (context == null) {
      debugPrint('[FCM] _showInAppNotification: no context available');
      return;
    }

    final actionLabel = _localizations()?.translate('open') ?? 'Open';

    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) {
      debugPrint('[FCM] _showInAppNotification: no ScaffoldMessenger');
      return;
    }

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
    debugPrint('[FCM] in-app snackbar shown: "$title"');
  }

  /// Public entry point for requesting permissions after showing a rationale dialog.
  Future<void> requestPermissionExplicit() => _requestPermissions();

  Future<void> _requestPermissions() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    debugPrint('[FCM] FCM permission status: ${settings.authorizationStatus}');

    if (!kIsWeb) {
      final androidPlugin = _localNotifications
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      try {
        final granted = await androidPlugin?.requestNotificationsPermission();
        debugPrint('[FCM] Android local notification permission: $granted');
      } catch (e) {
        debugPrint('[FCM] Android notification permission request failed: $e');
      }
    }
  }

  String? _sanitizeRoute(String? rawRoute) {
    if (rawRoute == null) return null;
    final route = rawRoute.trim();
    if (route.isEmpty) return null;

    // Only allow in-app routes.
    if (!route.startsWith('/')) return null;
    if (route.startsWith('//')) return null;
    if (route.contains('://')) return null;
    if (route.contains('..')) return null;

    for (final prefix in _allowedRoutePrefixes) {
      if (prefix.endsWith('/')) {
        if (route.startsWith(prefix)) return route;
      } else {
        if (route == prefix || route.startsWith('$prefix/') || route.startsWith('$prefix?')) return route;
      }
    }

    debugPrint('[FCM] _sanitizeRoute: route "$route" not in allowed prefixes — blocked');
    return null;
  }

  Future<void> _initLocalNotifications() async {
    if (kIsWeb) return;

    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidInit);

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (resp) {
        debugPrint('[FCM] local notification tapped: payload=${resp.payload}');

        final payload = resp.payload;
        if (payload == null || payload.isEmpty) return;
        try {
          final data = jsonDecode(payload);
          if (data is Map) {
            final route = data['route']?.toString();
            if (route != null && route.isNotEmpty) {
              debugPrint('[FCM] navigating from local notification tap to: $route');
              _goTo(route);
            }
          }
        } catch (e) {
          debugPrint('[FCM] local notification payload parse error: $e');
        }
      },
    );

    // Create the notification channel (required on Android 8+)
    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    if (androidPlugin != null) {
      await androidPlugin.createNotificationChannel(_androidChannel);
      debugPrint('[FCM] Android notification channel created: ${_androidChannel.id}');
    }
  }

  /// Navigate using GoRouter (the app uses GoRouter, NOT Navigator named routes).
  void _goTo(String rawRoute) {
    final route = _sanitizeRoute(rawRoute);
    if (route == null) return;

    final context = _navigatorKey?.currentContext;
    if (context == null) {
      debugPrint('[FCM] _goTo: no context — cannot navigate to "$route"');
      return;
    }

    debugPrint('[FCM] _goTo: navigating to "$route" via GoRouter');
    try {
      GoRouter.of(context).push(route);
    } catch (e) {
      debugPrint('[FCM] _goTo: GoRouter.push failed: $e — trying go()');
      try {
        GoRouter.of(context).go(route);
      } catch (e2) {
        debugPrint('[FCM] _goTo: GoRouter.go also failed: $e2');
      }
    }
  }

  void _handleMessageTap(RemoteMessage message) {
    debugPrint('[FCM] message tap: id=${message.messageId} data=${message.data}');

    final route = _sanitizeRoute(message.data['route']?.toString());
    if (route == null) {
      debugPrint('[FCM] message tap: no valid route in data');
      return;
    }

    // Delay slightly to ensure the router is ready (especially on cold start)
    Future.delayed(const Duration(milliseconds: 500), () {
      _goTo(route);
    });
  }

  /// Debug helper: simulate an incoming notification payload for testing
  /// Usage: NotificationService().debugReceive({'title': 'Test', 'body': 'Hello', 'route': '/messages'});
  Future<void> debugReceive(Map<String, dynamic> data) async {
    debugPrint('[FCM][DEBUG] debugReceive payload=$data');
    final title = data['title']?.toString() ?? _templateTitle(data) ?? (AppLocalizations.of(_navigatorKey!.currentContext!)?.translate('notification_default_title') ?? 'Notification');
    final body = data['body']?.toString() ?? _templateBody(data) ?? '';
    final route = data['route']?.toString();

    // Show in-app
    try {
      _showInAppNotification(title: title, body: body, route: route);
    } catch (e) {
      debugPrint('[FCM][DEBUG] _showInAppNotification failed: $e');
    }

    // Also display a local system notification when possible
    if (!kIsWeb) {
      try {
        final id = DateTime.now().millisecondsSinceEpoch ~/ 1000;
        AndroidNotificationDetails androidDetails;
        if (defaultTargetPlatform == TargetPlatform.android) {
          final imageUrl =
              data['image_url']?.toString() ??
              data['image']?.toString();
          androidDetails = await _buildAndroidNotificationDetails(
            channelId: _androidChannel.id,
            channelName: _androidChannel.name,
            channelDesc: _androidChannel.description,
            imageUrl: imageUrl,
          );
        } else {
          androidDetails = AndroidNotificationDetails(
            _androidChannel.id,
            _androidChannel.name,
            channelDescription: _androidChannel.description,
            importance: Importance.max,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
          );
        }
        await _localNotifications.show(
          id,
          title,
          body,
          NotificationDetails(android: androidDetails),
          payload: jsonEncode(data),
        );
      } catch (e) {
        debugPrint('[FCM][DEBUG] local notification failed: $e');
      }
    }
  }
}
