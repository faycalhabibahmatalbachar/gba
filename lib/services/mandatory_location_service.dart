import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../localization/app_localizations.dart';

/// Service that enforces GPS tracking for all users
/// GPS must be enabled before placing orders
class MandatoryLocationService {
  static final MandatoryLocationService _instance = MandatoryLocationService._internal();
  factory MandatoryLocationService() => _instance;
  MandatoryLocationService._internal();

  final _supabase = Supabase.instance.client;
  Timer? _checkTimer;
  bool _isMonitoring = false;

  /// Start monitoring GPS status
  Future<void> startMonitoring(BuildContext context) async {
    if (_isMonitoring) return;
    _isMonitoring = true;

    // Check immediately
    await _checkGPSStatus(context);

    // Check every 30 seconds
    _checkTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _checkGPSStatus(context);
    });
  }

  /// Stop monitoring
  void stopMonitoring() {
    _checkTimer?.cancel();
    _checkTimer = null;
    _isMonitoring = false;
  }

  /// Check if GPS is enabled and has recent position
  Future<bool> _checkGPSStatus(BuildContext context) async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    
    if (!serviceEnabled) {
      if (context.mounted) {
        await _showGPSRequiredDialog(context);
      }
      return false;
    }

    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied || 
        permission == LocationPermission.deniedForever) {
      if (context.mounted) {
        await _showPermissionDialog(context);
      }
      return false;
    }

    return true;
  }

  /// Verify user has recent GPS position (<5 minutes)
  Future<bool> hasRecentPosition() async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return false;

      final response = await _supabase
          .from('user_current_location')
          .select('updated_at')
          .eq('user_id', userId)
          .maybeSingle();

      if (response == null) return false;

      final lastUpdate = DateTime.parse(response['updated_at']);
      final diff = DateTime.now().difference(lastUpdate);

      return diff.inMinutes < 5; // Position récente (<5 min)
    } catch (e) {
      debugPrint('[MandatoryLocation] Error checking recent position: $e');
      return false;
    }
  }

  /// Show GPS required dialog (blocking)
  Future<void> _showGPSRequiredDialog(BuildContext context) async {
    if (!context.mounted) return;

    final localizations = AppLocalizations.of(context);
    
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.location_off, color: Colors.red),
            const SizedBox(width: 12),
            Expanded(
              child: Text(localizations.translate('location_services_disabled')),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(localizations.translate('enable_location_to_continue')),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.orange.shade200),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: Colors.orange.shade700, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Le GPS est obligatoire pour passer commande et suivre vos livraisons.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.orange.shade900,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(localizations.translate('cancel')),
          ),
          ElevatedButton.icon(
            onPressed: () async {
              Navigator.pop(context);
              await Geolocator.openLocationSettings();
            },
            icon: const Icon(Icons.settings),
            label: Text(localizations.translate('open_settings')),
          ),
        ],
      ),
    );
  }

  /// Show permission dialog
  Future<void> _showPermissionDialog(BuildContext context) async {
    if (!context.mounted) return;

    final localizations = AppLocalizations.of(context);
    
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.location_disabled, color: Colors.red),
            const SizedBox(width: 12),
            Expanded(
              child: Text(localizations.translate('location_permission_denied')),
            ),
          ],
        ),
        content: Text(localizations.translate('location_permission_permanently_denied')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(localizations.translate('cancel')),
          ),
          ElevatedButton.icon(
            onPressed: () async {
              Navigator.pop(context);
              await Geolocator.openAppSettings();
            },
            icon: const Icon(Icons.settings),
            label: Text(localizations.translate('open_settings')),
          ),
        ],
      ),
    );
  }

  /// Validate GPS before checkout (blocking)
  Future<bool> validateForCheckout(BuildContext context) async {
    final localizations = AppLocalizations.of(context);

    // Check GPS service
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (context.mounted) {
        final shouldOpen = await showDialog<bool>(
          context: context,
          barrierDismissible: false,
          builder: (context) => AlertDialog(
            title: Text(localizations.translate('location_services_disabled')),
            content: Text(
              'Vous devez activer le GPS pour passer commande.\n\n'
              'Cela permet un suivi précis de votre livraison.',
            ),
            actions: [
              ElevatedButton.icon(
                onPressed: () async {
                  Navigator.pop(context, true);
                  await Geolocator.openLocationSettings();
                },
                icon: const Icon(Icons.settings),
                label: Text(localizations.translate('open_settings')),
              ),
            ],
          ),
        );
      }
      return false;
    }

    // Check permission
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.deniedForever) {
      if (context.mounted) {
        await showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: Text(localizations.translate('location_permission_denied')),
            content: Text(localizations.translate('location_permission_permanently_denied')),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(localizations.translate('cancel')),
              ),
              ElevatedButton(
                onPressed: () async {
                  Navigator.pop(context);
                  await Geolocator.openAppSettings();
                },
                child: Text(localizations.translate('open_settings')),
              ),
            ],
          ),
        );
      }
      return false;
    }

    if (permission == LocationPermission.denied) {
      return false;
    }

    // Check recent position
    final hasRecent = await hasRecentPosition();
    if (!hasRecent) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Acquisition de votre position GPS en cours...'),
            duration: const Duration(seconds: 3),
          ),
        );
      }

      // Try to get current position
      try {
        final position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 15),
        );

        // Save to database
        final userId = _supabase.auth.currentUser?.id;
        if (userId != null) {
          await _supabase.from('user_current_location').upsert({
            'user_id': userId,
            'latitude': position.latitude,
            'longitude': position.longitude,
            'accuracy': position.accuracy,
            'speed': position.speed,
            'heading': position.heading,
            'updated_at': DateTime.now().toIso8601String(),
          });
        }

        return true;
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Impossible d\'obtenir votre position. Réessayez.'),
              backgroundColor: Colors.red,
            ),
          );
        }
        return false;
      }
    }

    return true;
  }

  /// Dispose resources
  void dispose() {
    stopMonitoring();
  }
}
