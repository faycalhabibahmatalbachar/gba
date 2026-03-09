import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Streams the driver's GPS position to the `driver_locations` Supabase table
/// every [intervalSeconds] seconds.
///
/// The web admin's `DeliveryTracking.jsx` already subscribes to this table
/// via Supabase Realtime, so positions appear live on the admin map.
class DriverLocationService {
  DriverLocationService._();
  static final DriverLocationService instance = DriverLocationService._();

  final _supabase = Supabase.instance.client;
  StreamSubscription<Position>? _positionSub;
  Timer? _throttleTimer;
  bool _isTracking = false;

  /// Minimum seconds between upserts (DB write throttle).
  static const int intervalSeconds = 2;

  /// Broadcast stream of live positions (for in-app map).
  final _positionController = StreamController<Position>.broadcast();
  Stream<Position> get positionStream => _positionController.stream;
  Position? _lastPosition;
  Position? get lastPosition => _lastPosition;

  bool get isTracking => _isTracking;

  /// Start streaming the driver's GPS position.
  /// Returns `false` if permissions are denied.
  Future<bool> startTracking() async {
    if (_isTracking) return true;

    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) {
      debugPrint('[DriverGPS] not logged in — cannot start tracking');
      return false;
    }

    // Request permission
    bool granted = false;
    if (kIsWeb) {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      granted = perm != LocationPermission.denied &&
          perm != LocationPermission.deniedForever;
    } else {
      final perm = await Permission.location.request();
      granted = perm.isGranted;
    }

    if (!granted) {
      debugPrint('[DriverGPS] location permission denied');
      return false;
    }

    _isTracking = true;

    // Send an initial position immediately
    try {
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
      await _upsertPosition(userId, pos);
    } catch (e) {
      debugPrint('[DriverGPS] initial position error: $e');
    }

    // Continuous stream — debounced to intervalSeconds
    DateTime lastSent = DateTime.now();

    _positionSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 5, // meters — high responsiveness
      ),
    ).listen((pos) async {
      _lastPosition = pos;
      _positionController.add(pos); // notify in-app map instantly
      final now = DateTime.now();
      if (now.difference(lastSent).inSeconds >= intervalSeconds) {
        lastSent = now;
        await _upsertPosition(userId, pos);
      }
    }, onError: (e) {
      debugPrint('[DriverGPS] stream error: $e');
    });

    debugPrint('[DriverGPS] tracking started');
    return true;
  }

  /// Stop streaming.
  void stopTracking() {
    _positionSub?.cancel();
    _positionSub = null;
    _throttleTimer?.cancel();
    _throttleTimer = null;
    _isTracking = false;
    debugPrint('[DriverGPS] tracking stopped');
  }

  /// Upsert a position into `driver_locations` AND insert into history.
  Future<void> _upsertPosition(String driverId, Position pos) async {
    try {
      final now = DateTime.now().toUtc().toIso8601String();
      
      // Double write: current table + history table
      await Future.wait([
        // Table temps réel (upsert - une seule ligne par driver)
        _supabase.from('driver_locations').upsert({
          'driver_id': driverId,
          'order_id': null,
          'lat': pos.latitude,
          'lng': pos.longitude,
          'accuracy': pos.accuracy,
          'speed': pos.speed,
          'heading': pos.heading,
          'captured_at': now,
          'created_at': now,
        }, onConflict: 'driver_id'),
        
        // Table historique (insert - archive complète)
        _supabase.from('driver_location_history').insert({
          'driver_id': driverId,
          'order_id': null,
          'latitude': pos.latitude,
          'longitude': pos.longitude,
          'accuracy': pos.accuracy,
          'altitude': pos.altitude,
          'speed': pos.speed,
          'heading': pos.heading,
          'battery_level': null, // TODO: add battery_plus package
          'captured_at': now,
        }),
      ]);
      
      debugPrint(
          '[DriverGPS] sent: ${pos.latitude.toStringAsFixed(5)}, ${pos.longitude.toStringAsFixed(5)} (±${pos.accuracy.toStringAsFixed(1)}m)');
    } catch (e) {
      debugPrint('[DriverGPS] upsert error: $e');
    }
  }

  /// Clean up — call in main_driver.dart dispose or on logout.
  void dispose() {
    stopTracking();
    _positionController.close();
  }
}
