import 'dart:async';
import 'dart:io';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// ─── Constants ────────────────────────────────────────────────────────────────

const _kNotifChannelId = 'gba_background_services';
const _kNotifChannelName = 'GBA — Services en cours';
const _kNotifId = 1001;
const _kMinIntervalSeconds = 10;

// ─── Optimised location settings per platform ────────────────────────────────

LocationSettings _buildLocationSettings() {
  if (Platform.isAndroid) {
    return AndroidSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 10,
      intervalDuration: const Duration(seconds: 10),
      useMSLAltitude: false,
    );
  }
  return const LocationSettings(
    accuracy: LocationAccuracy.medium,
    distanceFilter: 30,
  );
}

// ─── Background isolat entry point ───────────────────────────────────────────

/// Top-level function called in its own isolat by flutter_background_service.
@pragma('vm:entry-point')
Future<void> _onBackgroundStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();

  try {
    await Supabase.initialize(
      url: const String.fromEnvironment(
        'SUPABASE_URL',
        defaultValue: 'https://uvlrgwdbjegoavjfdrzb.supabase.co',
      ),
      anonKey: const String.fromEnvironment(
        'SUPABASE_ANON_KEY',
        defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bHJnd2RiamVnb2F2amZkcnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzI3ODYsImV4cCI6MjA3MTgwODc4Nn0.ZuMcEKbCKo5CtQGdn2KAHqHfBdROpvtLp7nJpJSHOUQ',
      ),
    );
  } catch (e) {
    debugPrint('[BGLocation] Supabase.initialize failed in background isolate: $e');
  }

  // Foreground notification is set once via AndroidConfiguration

  // Mutable state inside isolat
  String? userId;
  String? driverId;
  DateTime lastSent = DateTime.fromMillisecondsSinceEpoch(0);
  StreamSubscription<Position>? posSub;

  // ── Event listeners ───────────────────────────────────────────────────────

  // Set userId when user logs in → data starts flowing to Supabase
  service.on('setUserId').listen((data) {
    userId = data?['userId'] as String?;
    driverId = null;
    debugPrint('[BGLocation] userId set: $userId');
  });

  service.on('setDriverId').listen((data) {
    driverId = data?['driverId'] as String?;
    userId = null;
    debugPrint('[BGLocation] driverId set: $driverId');
  });

  // Clear userId when user logs out → stream keeps running, no Supabase writes
  service.on('clearUserId').listen((_) {
    userId = null;
    debugPrint('[BGLocation] userId cleared — stream still active');
  });

  service.on('clearDriverId').listen((_) {
    driverId = null;
    debugPrint('[BGLocation] driverId cleared — stream still active');
  });

  // ── Location stream (always running, sends only when userId != null) ──────

  void startStream() {
    posSub?.cancel();
    posSub = Geolocator.getPositionStream(
      locationSettings: _buildLocationSettings(),
    ).listen(
      (pos) async {
        if (driverId == null && userId == null) return;
        if (!pos.latitude.isFinite || !pos.longitude.isFinite) return;
        if (pos.latitude.abs() > 90 || pos.longitude.abs() > 180) return;
        final now = DateTime.now();
        if (now.difference(lastSent).inSeconds < _kMinIntervalSeconds) return;
        lastSent = now;
        try {
          if (driverId != null) {
            await Supabase.instance.client.from('driver_locations').upsert({
              'driver_id': driverId,
              'order_id': null,
              'lat': pos.latitude,
              'lng': pos.longitude,
              'accuracy': pos.accuracy,
              'captured_at': now.toUtc().toIso8601String(),
              'created_at': now.toUtc().toIso8601String(),
            }, onConflict: 'driver_id');
          } else if (userId != null) {
            final capturedAt = now.toUtc().toIso8601String();

            await Future.wait([
              // New schema for admin delivery tracking
              Supabase.instance.client.from('user_current_location').upsert({
                'user_id': userId,
                'latitude': pos.latitude,
                'longitude': pos.longitude,
                'accuracy': pos.accuracy,
                'speed': pos.speed < 0 ? 0.0 : pos.speed,
                'heading': pos.heading,
                'updated_at': capturedAt,
              }, onConflict: 'user_id'),

              Supabase.instance.client.from('user_location_history').insert({
                'user_id': userId,
                'latitude': pos.latitude,
                'longitude': pos.longitude,
                'accuracy': pos.accuracy,
                'speed': pos.speed < 0 ? 0.0 : pos.speed,
                'heading': pos.heading,
                'captured_at': capturedAt,
              }),

              // Legacy (compat)
              Supabase.instance.client.from('user_locations').upsert({
                'user_id': userId,
                'latitude': pos.latitude,
                'longitude': pos.longitude,
                'speed': pos.speed < 0 ? 0.0 : pos.speed,
                'heading': pos.heading,
                'accuracy': pos.accuracy,
                'updated_at': capturedAt,
              }, onConflict: 'user_id'),
            ]);
          }

          if (service is AndroidServiceInstance) {
            // Minimal foreground notification required par Android pour garder le service vivant.
            // Aucun détail GPS explicite n'est affiché à l'utilisateur.
            await service.setForegroundNotificationInfo(
              title: 'GBA',
              content: 'Services en cours',
            );
          }
        } catch (e) {
          debugPrint('[BGLocation] upsert error (driver_locations/user_locations): $e');
        }
      },
      onError: (e) {
        debugPrint('[BGLocation] stream error: $e — restarting in 10s');
        posSub?.cancel();
        posSub = null;
        Future.delayed(const Duration(seconds: 10), startStream);
      },
    );
  }

  startStream();

  // ── Heartbeat: self-heal stream (no notification update) ───────────────
  Timer.periodic(const Duration(seconds: 30), (_) async {
    if (posSub == null) startStream();
  });
}

// ─── iOS background fetch handler ────────────────────────────────────────────

@pragma('vm:entry-point')
Future<bool> _iosBackgroundFetch(ServiceInstance service) async {
  return true;
}

// ─── Public singleton ─────────────────────────────────────────────────────────

class LocationBackgroundService {
  LocationBackgroundService._();
  static final LocationBackgroundService instance = LocationBackgroundService._();

  bool _initialized = false;
  bool _permissionRequestInFlight = false;

  /// Call once in main() after Supabase.initialize().
  /// Configures the service; does NOT start it yet.
  Future<void> initialize() async {
    if (kIsWeb) return;
    if (_initialized) return;
    _initialized = true;

    const channel = AndroidNotificationChannel(
      _kNotifChannelId,
      _kNotifChannelName,
      description: 'Services GBA en arrière-plan pour une livraison précise',
      importance: Importance.low,
      playSound: false,
      enableVibration: false,
    );

    final notifPlugin = FlutterLocalNotificationsPlugin();
    await notifPlugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    await FlutterBackgroundService().configure(
      androidConfiguration: AndroidConfiguration(
        onStart: _onBackgroundStart,
        autoStart: true,
        autoStartOnBoot: true,
        isForegroundMode: true,
        notificationChannelId: _kNotifChannelId,
        initialNotificationTitle: 'GBA',
        initialNotificationContent: 'Services en cours',
        foregroundServiceNotificationId: _kNotifId,
        foregroundServiceTypes: [AndroidForegroundType.location],
      ),
      iosConfiguration: IosConfiguration(
        autoStart: false,
        onForeground: _onBackgroundStart,
        onBackground: _iosBackgroundFetch,
      ),
    );
  }

  /// Start the background GPS service (no userId required).
  /// Call at app launch so tracking is always running.
  Future<void> startService() async {
    if (kIsWeb) return;
    await initialize();
    final granted = await _ensurePermissions();
    if (!granted) {
      debugPrint('[BGLocation] permissions denied — service not started');
      return;
    }
    final svc = FlutterBackgroundService();
    if (!await svc.isRunning()) {
      await svc.startService();
      debugPrint('[BGLocation] service started (no userId yet)');
    }
  }

  /// Associate a logged-in [userId] so position data flows to Supabase.
  Future<void> setUserId(String userId) async {
    if (kIsWeb) return;
    await startService();
    final svc = FlutterBackgroundService();
    // Ensure service is running before invoking
    if (!await svc.isRunning()) {
      await svc.startService();
      await Future.delayed(const Duration(milliseconds: 500));
    }
    svc.invoke('setUserId', {'userId': userId});
    debugPrint('[BGLocation] setUserId → $userId');
  }

  /// Associate a logged-in [driverId] so position data flows to `driver_locations`.
  /// This is used by the Driver app.
  Future<void> setDriverId(String driverId) async {
    if (kIsWeb) return;
    await startService();
    final svc = FlutterBackgroundService();
    if (!await svc.isRunning()) {
      await svc.startService();
      await Future.delayed(const Duration(milliseconds: 500));
    }
    // Ensure only one mode is active
    svc.invoke('clearUserId');
    svc.invoke('setDriverId', {'driverId': driverId});
    debugPrint('[BGLocation] setDriverId → $driverId');
  }

  /// Clear userId on logout — service keeps running, no Supabase writes.
  void clearUserId() {
    if (kIsWeb) return;
    FlutterBackgroundService().invoke('clearUserId');
    debugPrint('[BGLocation] clearUserId — GPS stream still active');
  }

  /// Clear driverId on logout — service keeps running, no Supabase writes.
  void clearDriverId() {
    if (kIsWeb) return;
    FlutterBackgroundService().invoke('clearDriverId');
    debugPrint('[BGLocation] clearDriverId — GPS stream still active');
  }

  Future<bool> _ensurePermissions() async {
    if (_permissionRequestInFlight) {
      debugPrint('[BGLocation] permission request already running — skipping');
      return false;
    }
    _permissionRequestInFlight = true;
    try {
      var loc = await Permission.location.status;
      if (loc.isDenied) {
        loc = await Permission.location.request();
      }
      if (!loc.isGranted) {
        debugPrint('[BGLocation] location permission not granted');
        return false;
      }

      // Do NOT auto-request locationAlways here — it often triggers a second
      // permission flow and crashes with "A request for permissions is already running".
      // Background permission should be requested from a dedicated UI moment.
      return true;
    } finally {
      _permissionRequestInFlight = false;
    }
  }

  /// Optional: request "Always" background location permission.
  /// Call this from a screen/button after foreground permission is granted.
  Future<bool> requestBackgroundLocationPermission() async {
    if (kIsWeb) return true;
    if (_permissionRequestInFlight) {
      debugPrint('[BGLocation] permission request already running — skipping');
      return false;
    }
    _permissionRequestInFlight = true;
    try {
      final bg = await Permission.locationAlways.status;
      if (bg.isGranted) return true;
      final res = await Permission.locationAlways.request();
      return res.isGranted;
    } finally {
      _permissionRequestInFlight = false;
    }
  }
}
