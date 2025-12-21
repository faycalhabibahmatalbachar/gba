import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';
import 'dart:math';

class ActivityTrackingService {
  static final ActivityTrackingService _instance = ActivityTrackingService._internal();
  factory ActivityTrackingService() => _instance;
  ActivityTrackingService._internal();

  final _supabase = Supabase.instance.client;
  String? _currentSessionId;
  DateTime? _sessionStartTime;

  String _generateUuidV4() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));

    // Set version to 4
    bytes[6] = (bytes[6] & 0x0F) | 0x40;
    // Set variant to RFC4122
    bytes[8] = (bytes[8] & 0x3F) | 0x80;

    String byteToHex(int b) => b.toRadixString(16).padLeft(2, '0');
    final hex = bytes.map(byteToHex).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }

  // Initialize session
  Future<void> initSession() async {
    _currentSessionId = _generateUuidV4();
    _sessionStartTime = DateTime.now();
    await trackActivity('app_opened');
  }

  // End session
  Future<void> endSession() async {
    if (_currentSessionId != null && _sessionStartTime != null) {
      await trackActivity('app_closed');
      
      // Update session duration
      try {
        final duration = DateTime.now().difference(_sessionStartTime!).inSeconds;
        await _supabase.from('user_sessions').insert({
          'user_id': _supabase.auth.currentUser?.id,
          'session_id': _currentSessionId,
          'started_at': _sessionStartTime!.toIso8601String(),
          'ended_at': DateTime.now().toIso8601String(),
          'duration_seconds': duration,
        });
      } catch (e) {
        debugPrint('Error ending session: $e');
      }
      
      _currentSessionId = null;
      _sessionStartTime = null;
    }
  }

  // Track user activity
  Future<void> trackActivity(
    String actionType, {
    Map<String, dynamic>? actionDetails,
    String? entityType,
    String? entityId,
    String? entityName,
    String? pageName,
  }) async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return;

      final data = {
        'user_id': userId,
        'action_type': actionType,
        'action_details': actionDetails ?? {},
        'entity_type': entityType,
        'entity_id': entityId,
        'entity_name': entityName,
        'page_name': pageName,
        'session_id': _currentSessionId,
      };
      final params = {
        'p_user_id': userId,
        'p_action_type': actionType,
        'p_action_details': actionDetails ?? {},
        'p_entity_type': entityType,
        'p_entity_id': entityId,
        'p_entity_name': entityName,
        'p_page_name': pageName,
        'p_session_id': _currentSessionId,
      };

      try {
        // Prefer the correct RPC name when available.
        await _supabase.rpc('log_user_activity', params: params);
      } catch (rpcError) {
        // Best-effort fallback: do not block the app on tracking failures.
        debugPrint('Fallback to direct insert for activity tracking: $rpcError');
        try {
          await _supabase.from('user_activities').insert(data);
        } catch (insertError) {
          debugPrint('Error tracking activity: $insertError');
        }
      }
      
      debugPrint('📊 Activity tracked: $actionType${entityName != null ? ' - $entityName' : ''}');
    } catch (e) {
      debugPrint('Error tracking activity: $e');
    }
  }

  // Specific tracking methods
  Future<void> trackProductView(String productId, String productName) async {
    await trackActivity(
      'product_view',
      entityType: 'product',
      entityId: productId,
      entityName: productName,
      pageName: 'product_detail',
    );
  }

  Future<void> trackCartAdd(String productId, String productName, int quantity) async {
    await trackActivity(
      'cart_add',
      actionDetails: {'quantity': quantity},
      entityType: 'product',
      entityId: productId,
      entityName: productName,
      pageName: 'cart',
    );
  }

  Future<void> trackCartRemove(String productId, String productName) async {
    await trackActivity(
      'cart_remove',
      entityType: 'product',
      entityId: productId,
      entityName: productName,
      pageName: 'cart',
    );
  }

  Future<void> trackFavoriteAdd(String productId, String productName) async {
    await trackActivity(
      'favorite_add',
      entityType: 'product',
      entityId: productId,
      entityName: productName,
      pageName: 'favorites',
    );
  }

  Future<void> trackFavoriteRemove(String productId, String productName) async {
    await trackActivity(
      'favorite_remove',
      entityType: 'product',
      entityId: productId,
      entityName: productName,
      pageName: 'favorites',
    );
  }

  Future<void> trackSearch(String query, int resultsCount) async {
    await trackActivity(
      'search',
      actionDetails: {
        'query': query,
        'results_count': resultsCount,
      },
      pageName: 'search',
    );
  }

  Future<void> trackLogin() async {
    await trackActivity('login');
  }

  Future<void> trackLogout() async {
    await trackActivity('logout');
  }

  Future<void> trackProfileUpdate() async {
    await trackActivity(
      'profile_update',
      pageName: 'profile',
    );
  }

  Future<void> trackOrderPlaced(String orderId, String orderNumber, double totalAmount) async {
    await trackActivity(
      'order_placed',
      actionDetails: {
        'total_amount': totalAmount,
      },
      entityType: 'order',
      entityId: orderId,
      entityName: orderNumber,
      pageName: 'checkout',
    );
  }

  Future<void> trackMessageSent(String recipientId, String recipientName) async {
    await trackActivity(
      'message_sent',
      entityType: 'user',
      entityId: recipientId,
      entityName: recipientName,
      pageName: 'chat',
    );
  }

  Future<void> trackCategoryView(String categoryId, String categoryName) async {
    await trackActivity(
      'category_view',
      entityType: 'category',
      entityId: categoryId,
      entityName: categoryName,
      pageName: 'categories',
    );
  }

  Future<void> trackCheckoutStarted() async {
    await trackActivity(
      'checkout_started',
      pageName: 'checkout',
    );
  }

  Future<void> trackCheckoutAbandoned() async {
    await trackActivity(
      'checkout_abandoned',
      pageName: 'checkout',
    );
  }

  Future<void> trackPaymentCompleted(String orderId, double amount) async {
    await trackActivity(
      'payment_completed',
      actionDetails: {'amount': amount},
      entityType: 'order',
      entityId: orderId,
      pageName: 'checkout',
    );
  }

  Future<void> trackReviewPosted(String productId, String productName, int rating) async {
    await trackActivity(
      'review_posted',
      actionDetails: {'rating': rating},
      entityType: 'product',
      entityId: productId,
      entityName: productName,
      pageName: 'product_detail',
    );
  }

  Future<void> trackProductShared(String productId, String productName, String platform) async {
    await trackActivity(
      'share_product',
      actionDetails: {'platform': platform},
      entityType: 'product',
      entityId: productId,
      entityName: productName,
      pageName: 'product_detail',
    );
  }
}
