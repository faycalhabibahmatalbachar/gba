import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Client app: silently publishes the user's GPS to `user_locations`
/// while they have an active order being delivered (status = 'shipped').
class UserLocationService {
  UserLocationService._();
  static final UserLocationService instance = UserLocationService._();

  final _supabase = Supabase.instance.client;
  StreamSubscription<Position>? _posSub;
  bool _isTracking = false;

  static const int _intervalSeconds = 5;

  bool get isTracking => _isTracking;

  Future<bool> startTracking() async {
    if (_isTracking) return true;
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return false;

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
    if (!granted) return false;

    _isTracking = true;
    DateTime lastSent = DateTime.fromMillisecondsSinceEpoch(0);

    _posSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.medium,
        distanceFilter: 10,
      ),
    ).listen((pos) async {
      final now = DateTime.now();
      if (now.difference(lastSent).inSeconds < _intervalSeconds) return;
      lastSent = now;
      try {
        await _supabase.from('user_locations').upsert({
          'user_id': userId,
          'lat': pos.latitude,
          'lng': pos.longitude,
          'speed': pos.speed < 0 ? 0 : pos.speed,
          'heading': pos.heading,
          'accuracy': pos.accuracy,
          'captured_at': DateTime.now().toUtc().toIso8601String(),
        }, onConflict: 'user_id');
      } catch (e) {
        debugPrint('[UserGPS] upsert error: $e');
      }
    }, onError: (e) => debugPrint('[UserGPS] stream error: $e'));

    debugPrint('[UserGPS] tracking started');
    return true;
  }

  void stopTracking() {
    _posSub?.cancel();
    _posSub = null;
    _isTracking = false;
    debugPrint('[UserGPS] tracking stopped');
  }

  void dispose() => stopTracking();
}
