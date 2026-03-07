import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Handles push notifications for the driver app:
///  - Registers FCM token into `device_tokens` (same table as client app)
///  - Listens for new order assignments via Supabase Realtime
///  - Shows local notifications for "Nouvelle commande assignée"
class DriverNotificationService {
  DriverNotificationService._();
  static final DriverNotificationService instance =
      DriverNotificationService._();

  final _supabase = Supabase.instance.client;
  final _localNotifications = FlutterLocalNotificationsPlugin();
  StreamSubscription? _ordersSub;
  bool _initialized = false;
  final Set<String> _notifiedOrderIds = {};

  static const _channelId = 'gba_driver_channel';
  static const _channelName = 'GBA Livreur';
  static const _deviceIdKey = 'device_tokens_device_id_v1';

  Future<String> _getOrCreateDeviceId() async {
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getString(_deviceIdKey);
    if (existing != null && existing.trim().isNotEmpty) return existing.trim();
    const uuid = Uuid();
    final created = uuid.v4();
    await prefs.setString(_deviceIdKey, created);
    return created;
  }

  /// Initialize everything: Firebase, FCM token, local notifications, realtime.
  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    debugPrint('[DriverNotif] ▶ initialize() start');

    try {
      await Firebase.initializeApp();
      debugPrint('[DriverNotif] ✅ Firebase initialized');
    } catch (e) {
      debugPrint('[DriverNotif] ⚠️ Firebase.initializeApp: $e');
    }

    // Local notifications setup
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    await _localNotifications.initialize(
      const InitializationSettings(android: androidInit),
      onDidReceiveNotificationResponse: (details) {
        debugPrint('[DriverNotif] 🔔 local notif tapped: ${details.payload}');
      },
    );
    debugPrint('[DriverNotif] ✅ local notifications initialized');

    // Create Android notification channel
    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    if (androidPlugin != null) {
      await androidPlugin.createNotificationChannel(
        const AndroidNotificationChannel(
          _channelId,
          _channelName,
          description: 'Notifications pour les livreurs GBA',
          importance: Importance.max,
          playSound: true,
          enableVibration: true,
        ),
      );
      // Also create the channel that FCM background messages use
      // (must match AndroidManifest default_notification_channel_id)
      await androidPlugin.createNotificationChannel(
        const AndroidNotificationChannel(
          'high_importance_channel',
          'Notifications importantes',
          description: 'Canal pour les notifications push FCM',
          importance: Importance.max,
          playSound: true,
          enableVibration: true,
        ),
      );
      debugPrint('[DriverNotif] ✅ Android channels created: $_channelId + high_importance_channel');
    }

    // FCM token
    await _registerFcmToken();

    // Listen for foreground messages
    FirebaseMessaging.onMessage.listen(_onForegroundMessage);
    debugPrint('[DriverNotif] ✅ foreground listener registered');

    // Handle notification tap when app is in background (opened from notif)
    FirebaseMessaging.onMessageOpenedApp.listen((msg) {
      debugPrint('[DriverNotif] 📬 opened from background notif: ${msg.data}');
    });

    // Listen for realtime order assignments
    _listenForNewOrders();

    debugPrint('[DriverNotif] ✅ initialized complete');
  }

  Future<void> _registerFcmToken() async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) {
        debugPrint('[DriverNotif] ❌ no user logged in — cannot register FCM token');
        return;
      }
      debugPrint('[DriverNotif] 🔑 registering FCM token for user: $userId');

      final fcm = FirebaseMessaging.instance;
      final settings = await fcm.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        announcement: true,
        criticalAlert: true,
      );
      debugPrint('[DriverNotif] 📋 permission status: ${settings.authorizationStatus}');

      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        debugPrint('[DriverNotif] ⚠️ Notification permission DENIED — push will not work');
        return;
      }

      final token = await fcm.getToken();
      if (token == null || token.isEmpty) {
        debugPrint('[DriverNotif] ❌ FCM token is null/empty — check google-services.json');
        return;
      }
      final suffix = token.length >= 8 ? token.substring(token.length - 8) : token;
      debugPrint('[DriverNotif] 🎟️ FCM token obtained (suffix=...$suffix, length=${token.length})');

      final platform = defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';
      final locale = Intl.getCurrentLocale();
      final deviceId = await _getOrCreateDeviceId();
      final now = DateTime.now().toUtc().toIso8601String();

      for (int attempt = 1; attempt <= 3; attempt++) {
        try {
          await _supabase.from('device_tokens').upsert({
            'user_id': userId,
            'token': token,
            'platform': platform,
            'locale': locale,
            'device_id': deviceId,
            'last_seen_at': now,
            'updated_at': now,
          }, onConflict: 'token');
          debugPrint('[DriverNotif] ✅ FCM token saved to device_tokens (attempt $attempt)');
          break;
        } catch (e) {
          debugPrint('[DriverNotif] ❌ device_tokens upsert FAILED (attempt $attempt/3): $e');
          if (attempt < 3) {
            await Future.delayed(Duration(seconds: attempt * 2));
          } else {
            debugPrint('[DriverNotif] ❌ GAVE UP saving token — driver will NOT receive push notifications');
          }
        }
      }

      // Token refresh
      fcm.onTokenRefresh.listen((newToken) async {
        debugPrint('[DriverNotif] 🔄 FCM token refreshed (length=${newToken.length})');
        final deviceId2 = await _getOrCreateDeviceId();
        final now2 = DateTime.now().toUtc().toIso8601String();
        try {
          await _supabase.from('device_tokens').upsert({
            'user_id': userId,
            'token': newToken,
            'platform': platform,
            'locale': locale,
            'device_id': deviceId2,
            'last_seen_at': now2,
            'updated_at': now2,
          }, onConflict: 'token');
          debugPrint('[DriverNotif] ✅ Refreshed token saved to device_tokens');
        } catch (e) {
          debugPrint('[DriverNotif] ❌ Refreshed token save failed: $e');
        }
      });
    } catch (e) {
      debugPrint('[DriverNotif] ❌ FCM token error: $e');
    }
  }

  void _onForegroundMessage(RemoteMessage message) {
    debugPrint('[DriverNotif] 📩 foreground FCM received — title: ${message.notification?.title}, data: ${message.data}');
    final title = message.notification?.title ?? 'GBA Livreur';
    final body = message.notification?.body ?? '';
    _showLocalNotification(title, body);
  }

  /// Listen for newly assigned orders via Supabase Realtime.
  /// Only notifies once per order ID to avoid spam.
  void _listenForNewOrders() {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;

    _ordersSub?.cancel();
    _ordersSub = _supabase
        .from('orders')
        .stream(primaryKey: ['id'])
        .eq('driver_id', userId)
        .listen((data) {
      for (final order in data) {
        final orderId = (order['id'] ?? '').toString();
        if (_notifiedOrderIds.contains(orderId)) continue;

        // Only notify for newly assigned (not yet seen)
        final status = order['status']?.toString() ?? '';
        if (status == 'pending' || status == 'confirmed' || status == 'shipped') {
          _notifiedOrderIds.add(orderId);
          final shortId = orderId.length > 8
              ? orderId.substring(0, 8).toUpperCase()
              : orderId.toUpperCase();
          final total = (order['total_amount'] as num?)?.toDouble() ?? 0;
          _showLocalNotification(
            '📦 Commande assignée #$shortId',
            'Montant: ${total.toStringAsFixed(0)} FCFA — Appuyez pour naviguer',
          );
        }
      }
    });
  }

  Future<void> _showLocalNotification(String title, String body) async {
    debugPrint('[DriverNotif] 🔔 _showLocalNotification: title="$title" body="$body"');
    try {
      await _localNotifications.show(
        DateTime.now().millisecondsSinceEpoch ~/ 1000,
        title,
        body,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            _channelName,
            channelDescription: 'Notifications pour les livreurs GBA',
            importance: Importance.high,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
          ),
        ),
      );
      debugPrint('[DriverNotif] ✅ local notification shown successfully');
    } catch (e) {
      debugPrint('[DriverNotif] ❌ local notification error: $e');
    }
  }

  void dispose() {
    _ordersSub?.cancel();
  }
}
