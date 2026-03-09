import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_background_service/flutter_background_service.dart';

/// Professional GPS tracking service with background support
/// Tracks user location in real-time for delivery tracking
class BackgroundLocationTrackingService {
  static final BackgroundLocationTrackingService _instance = BackgroundLocationTrackingService._internal();
  factory BackgroundLocationTrackingService() => _instance;
  BackgroundLocationTrackingService._internal();

  final _supabase = Supabase.instance.client;
  StreamSubscription<Position>? _positionStream;
  Timer? _batchTimer;
  final List<Map<String, dynamic>> _locationBatch = [];
  
  static const int _batchSize = 5;
  static const Duration _batchInterval = Duration(seconds: 30);
  static const Duration _updateInterval = Duration(seconds: 10);
  static const int _distanceFilter = 10; // meters
  
  bool _isTracking = false;
  Position? _lastPosition;
  DateTime? _lastUpdateTime;

  /// Initialize and start background location tracking
  Future<void> initialize() async {
    try {
      await _checkAndRequestPermissions();
      await _initializeBackgroundService();
      await startTracking();
      debugPrint('🌍 [BackgroundLocationTracking] Service initialized successfully');
    } catch (e) {
      debugPrint('❌ [BackgroundLocationTracking] Initialization error: $e');
    }
  }

  /// Check and request location permissions
  Future<bool> _checkAndRequestPermissions() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      debugPrint('⚠️ [BackgroundLocationTracking] Location services disabled');
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        debugPrint('❌ [BackgroundLocationTracking] Location permissions denied');
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      debugPrint('❌ [BackgroundLocationTracking] Location permissions permanently denied');
      return false;
    }

    // Request background location permission (Android 10+)
    if (permission == LocationPermission.whileInUse) {
      debugPrint('⚠️ [BackgroundLocationTracking] Only foreground permission granted');
      // On Android, this will prompt for "Allow all the time"
    }

    debugPrint('✅ [BackgroundLocationTracking] Permissions granted');
    return true;
  }

  /// Initialize Flutter background service
  Future<void> _initializeBackgroundService() async {
    final service = FlutterBackgroundService();
    
    await service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: onStart,
        autoStart: true,
        isForegroundMode: true,
        notificationChannelId: 'gba_location_tracking',
        initialNotificationTitle: 'GBA Tracking',
        initialNotificationContent: 'Suivi de position actif',
        foregroundServiceNotificationId: 888,
      ),
      iosConfiguration: IosConfiguration(
        autoStart: true,
        onForeground: onStart,
        onBackground: onIosBackground,
      ),
    );
  }

  /// Background service entry point
  @pragma('vm:entry-point')
  static void onStart(ServiceInstance service) async {
    if (service is AndroidServiceInstance) {
      service.on('setAsForeground').listen((event) {
        service.setAsForegroundService();
      });

      service.on('setAsBackground').listen((event) {
        service.setAsBackgroundService();
      });
    }

    service.on('stopService').listen((event) {
      service.stopSelf();
    });

    // Start location tracking in background
    Timer.periodic(const Duration(seconds: 10), (timer) async {
      if (service is AndroidServiceInstance) {
        if (await service.isForegroundService()) {
          try {
            final position = await Geolocator.getCurrentPosition(
              desiredAccuracy: LocationAccuracy.bestForNavigation,
            );
            
            // Send location to main isolate
            service.invoke(
              'update',
              {
                'latitude': position.latitude,
                'longitude': position.longitude,
                'accuracy': position.accuracy,
                'timestamp': position.timestamp.toIso8601String(),
              },
            );
          } catch (e) {
            debugPrint('❌ [BackgroundService] Error getting position: $e');
          }
        }
      }
    });
  }

  /// iOS background handler
  @pragma('vm:entry-point')
  static Future<bool> onIosBackground(ServiceInstance service) async {
    return true;
  }

  /// Start real-time location tracking
  Future<void> startTracking() async {
    if (_isTracking) {
      debugPrint('⚠️ [BackgroundLocationTracking] Already tracking');
      return;
    }

    final hasPermission = await _checkAndRequestPermissions();
    if (!hasPermission) {
      debugPrint('❌ [BackgroundLocationTracking] Cannot start tracking without permissions');
      return;
    }

    _isTracking = true;
    
    // High-precision location settings
    const LocationSettings locationSettings = LocationSettings(
      accuracy: LocationAccuracy.bestForNavigation,
      distanceFilter: _distanceFilter,
      timeLimit: Duration(seconds: 15),
    );

    _positionStream = Geolocator.getPositionStream(
      locationSettings: locationSettings,
    ).listen(
      _handlePositionUpdate,
      onError: (error) {
        debugPrint('❌ [BackgroundLocationTracking] Stream error: $error');
      },
    );

    // Start batch upload timer
    _batchTimer = Timer.periodic(_batchInterval, (_) => _uploadBatch());

    debugPrint('✅ [BackgroundLocationTracking] Tracking started');
  }

  /// Handle position updates
  void _handlePositionUpdate(Position position) {
    final now = DateTime.now();
    
    // Throttle updates (minimum 10 seconds between updates)
    if (_lastUpdateTime != null && 
        now.difference(_lastUpdateTime!) < _updateInterval) {
      return;
    }

    // Filter by distance (avoid redundant updates)
    if (_lastPosition != null) {
      final distance = Geolocator.distanceBetween(
        _lastPosition!.latitude,
        _lastPosition!.longitude,
        position.latitude,
        position.longitude,
      );
      
      if (distance < _distanceFilter) {
        return;
      }
    }

    _lastPosition = position;
    _lastUpdateTime = now;

    final locationData = {
      'latitude': position.latitude,
      'longitude': position.longitude,
      'accuracy': position.accuracy,
      'altitude': position.altitude,
      'speed': position.speed,
      'heading': position.heading,
      'timestamp': position.timestamp.toIso8601String(),
    };

    _locationBatch.add(locationData);

    debugPrint('📍 [BackgroundLocationTracking] Position: ${position.latitude}, ${position.longitude} (±${position.accuracy.toStringAsFixed(1)}m)');

    // Upload immediately if batch is full
    if (_locationBatch.length >= _batchSize) {
      _uploadBatch();
    }

    // Also update real-time for immediate tracking
    _updateRealtimeLocation(locationData);
  }

  /// Upload batch of locations to Supabase
  Future<void> _uploadBatch() async {
    if (_locationBatch.isEmpty) return;

    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) {
        debugPrint('⚠️ [BackgroundLocationTracking] No user logged in');
        return;
      }

      final batch = List<Map<String, dynamic>>.from(_locationBatch);
      _locationBatch.clear();

      final records = batch.map((loc) => {
        'user_id': userId,
        'latitude': loc['latitude'],
        'longitude': loc['longitude'],
        'accuracy': loc['accuracy'],
        'altitude': loc['altitude'],
        'speed': loc['speed'],
        'heading': loc['heading'],
        'recorded_at': loc['timestamp'],
      }).toList();

      await _supabase.from('user_locations').insert(records);
      
      debugPrint('✅ [BackgroundLocationTracking] Uploaded ${records.length} locations');
    } catch (e) {
      debugPrint('❌ [BackgroundLocationTracking] Upload error: $e');
      // Re-add to batch for retry
      // _locationBatch.addAll(batch); // Optional: retry logic
    }
  }

  /// Update real-time location for live tracking
  Future<void> _updateRealtimeLocation(Map<String, dynamic> locationData) async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return;

      final now = DateTime.now().toIso8601String();

      // Double write: current + history
      await Future.wait([
        // Table temps réel (upsert)
        _supabase.from('user_current_location').upsert({
          'user_id': userId,
          'latitude': locationData['latitude'],
          'longitude': locationData['longitude'],
          'accuracy': locationData['accuracy'],
          'speed': locationData['speed'],
          'heading': locationData['heading'],
          'updated_at': now,
        }),
        
        // Table historique (insert)
        _supabase.from('user_location_history').insert({
          'user_id': userId,
          'order_id': null,
          'latitude': locationData['latitude'],
          'longitude': locationData['longitude'],
          'accuracy': locationData['accuracy'],
          'altitude': locationData['altitude'],
          'speed': locationData['speed'],
          'heading': locationData['heading'],
          'captured_at': locationData['timestamp'],
        }),
      ]);
    } catch (e) {
      debugPrint('❌ [BackgroundLocationTracking] Realtime update error: $e');
    }
  }

  /// Stop location tracking
  Future<void> stopTracking() async {
    if (!_isTracking) return;

    _isTracking = false;
    await _positionStream?.cancel();
    _positionStream = null;
    
    _batchTimer?.cancel();
    _batchTimer = null;

    // Upload remaining locations
    await _uploadBatch();

    debugPrint('🛑 [BackgroundLocationTracking] Tracking stopped');
  }

  /// Get current position (one-time)
  Future<Position?> getCurrentPosition() async {
    try {
      final hasPermission = await _checkAndRequestPermissions();
      if (!hasPermission) return null;

      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.bestForNavigation,
        timeLimit: const Duration(seconds: 15),
      );
    } catch (e) {
      debugPrint('❌ [BackgroundLocationTracking] Get current position error: $e');
      return null;
    }
  }

  /// Check if tracking is active
  bool get isTracking => _isTracking;

  /// Get last known position
  Position? get lastPosition => _lastPosition;

  /// Dispose resources
  void dispose() {
    stopTracking();
  }
}
